const DEFAULT_TIMEOUT_MS = Number(process.env.PRICE_FETCH_TIMEOUT_MS || 15000)
const FETCH_MODE = (process.env.PRICE_FETCH_MODE || 'browser-first').toLowerCase()

function normalizeNumber(raw) {
  if (typeof raw !== 'string') {
    return null
  }

  const compact = raw.replace(/\s/g, '').replace(/,/g, '')
  const match = compact.match(/(\d+(?:\.\d+)?)/)
  if (!match) {
    return null
  }

  const parsed = Number(match[1])
  return Number.isFinite(parsed) ? parsed : null
}

function extractJsonScripts(html) {
  const scripts = []
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  for (const match of html.matchAll(regex)) {
    scripts.push(match[1])
  }
  return scripts
}

function walkForPrice(value) {
  if (!value || typeof value !== 'object') {
    return null
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = walkForPrice(item)
      if (found !== null) {
        return found
      }
    }
    return null
  }

  const directPrice = value?.offers?.price ?? value?.price
  if (typeof directPrice === 'number') {
    return directPrice
  }
  if (typeof directPrice === 'string') {
    const parsed = normalizeNumber(directPrice)
    if (parsed !== null) {
      return parsed
    }
  }

  for (const nested of Object.values(value)) {
    const found = walkForPrice(nested)
    if (found !== null) {
      return found
    }
  }

  return null
}

export function extractJsonLdPrice(html) {
  const scripts = extractJsonScripts(html)
  for (const script of scripts) {
    try {
      const parsed = JSON.parse(script.trim())
      const price = walkForPrice(parsed)
      if (price !== null) {
        return price
      }
    } catch {
      continue
    }
  }
  return null
}

export function extractByRegexList(html, regexList) {
  for (const regex of regexList) {
    const matched = html.match(regex)
    if (!matched) {
      continue
    }
    const parsed = normalizeNumber(matched[1] ?? '')
    if (parsed !== null) {
      return parsed
    }
  }
  return null
}

async function fetchHtmlWithHttp(url, { language, timeoutMs }) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': language,
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    })

    if (!response.ok) {
      throw new Error(`request failed: ${response.status} ${response.statusText}`)
    }

    return response.text()
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchHtmlWithBrowser(url, { language, timeoutMs }) {
  let playwright
  try {
    playwright = await import('playwright')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`playwright not available: ${message}`)
  }

  const browser = await playwright.chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  try {
    const context = await browser.newContext({
      locale: language.split(',')[0] || 'en-US',
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 2000 },
    })
    const page = await context.newPage()
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs })
    await page.waitForTimeout(1500)
    return page.content()
  } finally {
    await browser.close()
  }
}

export async function fetchHtml(url, { language = 'en-US,en;q=0.9', timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const mode = FETCH_MODE

  if (mode === 'http-only') {
    return fetchHtmlWithHttp(url, { language, timeoutMs })
  }
  if (mode === 'browser-only') {
    return fetchHtmlWithBrowser(url, { language, timeoutMs })
  }

  try {
    return await fetchHtmlWithBrowser(url, { language, timeoutMs })
  } catch (browserError) {
    try {
      return await fetchHtmlWithHttp(url, { language, timeoutMs })
    } catch (httpError) {
      const browserMessage = browserError instanceof Error ? browserError.message : String(browserError)
      const httpMessage = httpError instanceof Error ? httpError.message : String(httpError)
      throw new Error(`browser+http failed: browser=${browserMessage}; http=${httpMessage}`)
    }
  }
}
