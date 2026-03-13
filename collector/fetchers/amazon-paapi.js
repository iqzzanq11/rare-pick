import { extractByRegexList, extractJsonLdPrice, fetchHtmlDocument } from './html-price.js'

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

function isValidPrice(value) {
  return Number.isFinite(value) && value > 0
}

function normalizeCurrency(raw) {
  const token = String(raw || '').trim().toUpperCase()
  if (!token) {
    return null
  }
  if (token === '$' || token === 'US$' || token === 'USD') {
    return 'USD'
  }
  if (token === '₩' || token === 'KRW' || token === '원') {
    return 'KRW'
  }
  return /^[A-Z]{3}$/.test(token) ? token : null
}

function detectCurrencyFromPage(html) {
  const byJson = html.match(/"priceCurrency"\s*:\s*"([A-Z]{3})"/i)
  if (byJson) {
    return normalizeCurrency(byJson[1]) || 'USD'
  }
  if (/\bKRW\b|₩|원/.test(html)) {
    return 'KRW'
  }
  return 'USD'
}


function stripTags(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
}

function normalizeTitle(value) {
  const stripped = stripTags(decodeHtmlEntities(value))
  if (!stripped) {
    return null
  }
  return stripped.replace(/\s*[:\-|]\s*amazon.*$/i, '').trim() || null
}

function isPlaceholderTitle(value) {
  return /^\[(amazon|coupang)\]\s+[A-Z0-9]+$/i.test(String(value || '').trim())
}

function parseJsonLdObjects(html) {
  const objects = []
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  for (const match of html.matchAll(regex)) {
    const script = match[1]
    try {
      objects.push(JSON.parse(script.trim()))
    } catch {
      continue
    }
  }
  return objects
}

function findOfferNode(value) {
  if (!value || typeof value !== 'object') {
    return null
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findOfferNode(item)
      if (found) {
        return found
      }
    }
    return null
  }

  const currency = normalizeCurrency(value?.priceCurrency)
  const numericPrice =
    typeof value?.price === 'number'
      ? value.price
      : typeof value?.price === 'string'
        ? normalizeNumber(value.price)
        : null

  if (currency && isValidPrice(numericPrice)) {
    return { price: numericPrice, currency }
  }

  for (const nested of Object.values(value)) {
    const found = findOfferNode(nested)
    if (found) {
      return found
    }
  }

  return null
}

function extractJsonLdOffer(html) {
  const parsedObjects = parseJsonLdObjects(html)
  for (const parsed of parsedObjects) {
    const found = findOfferNode(parsed)
    if (found) {
      return found
    }
  }
  return null
}

function findProductNode(value) {
  if (!value || typeof value !== 'object') {
    return null
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findProductNode(item)
      if (found) {
        return found
      }
    }
    return null
  }

  const type = String(value['@type'] || '')
  if (/product/i.test(type) && typeof value?.name === 'string') {
    return value
  }

  for (const nested of Object.values(value)) {
    const found = findProductNode(nested)
    if (found) {
      return found
    }
  }

  return null
}

function extractAmazonMetadata(html, fallbackTitle = null) {
  const parsedObjects = parseJsonLdObjects(html)

  let title = null
  let imageUrl = null
  let category = null

  for (const parsed of parsedObjects) {
    const product = findProductNode(parsed)
    if (!product) {
      continue
    }

    if (!title && typeof product.name === 'string') {
      title = normalizeTitle(product.name)
    }
    if (!imageUrl) {
      if (typeof product.image === 'string') {
        imageUrl = product.image
      } else if (Array.isArray(product.image) && typeof product.image[0] === 'string') {
        imageUrl = product.image[0]
      }
    }
    if (!category && typeof product.category === 'string') {
      category = product.category.trim()
    }
  }

  if (!title) {
    const byProductTitle = html.match(/id=["']productTitle["'][^>]*>\s*([^<]+)\s*</i)
    if (byProductTitle) {
      title = normalizeTitle(byProductTitle[1])
    }
  }
  if (!title) {
    const byOg = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
    if (byOg) {
      title = normalizeTitle(byOg[1])
    }
  }
  if (!title) {
    const byTitleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    if (byTitleTag) {
      title = normalizeTitle(byTitleTag[1])
    }
  }
  if (!title) {
    const byFeatureBullets = html.match(/id=["']feature-bullets["'][\s\S]{0,300}?<h1[^>]*>([\s\S]*?)<\/h1>/i)
    if (byFeatureBullets) {
      title = normalizeTitle(byFeatureBullets[1])
    }
  }
  if (!title && typeof fallbackTitle === 'string' && fallbackTitle.trim()) {
    title = normalizeTitle(fallbackTitle)
  }

  if (!imageUrl) {
    const byOgImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    if (byOgImage) {
      imageUrl = byOgImage[1].trim()
    }
  }
  if (!imageUrl) {
    const byDataOldHires = html.match(/data-old-hires=["']([^"']+)["']/i)
    if (byDataOldHires) {
      imageUrl = byDataOldHires[1].trim()
    }
  }

  if (!category) {
    const crumbMatches = [...html.matchAll(/id=["'][^"']*wayfinding-breadcrumbs[^"']*["'][\s\S]*?<\/ul>/gi)]
    if (crumbMatches.length > 0) {
      const crumbText = stripTags(crumbMatches[0][0])
      const tokens = crumbText
        .split(/\s{2,}|›|>|\/|\\/)
        .map((item) => item.trim())
        .filter(Boolean)
      if (tokens.length > 0) {
        category = tokens[tokens.length - 1]
      }
    }
  }

  return {
    title: title || null,
    imageUrl: imageUrl || null,
    category: category || null,
  }
}

function looksLikeAmazonProductPage({ html, finalUrl, title }) {
  if (typeof finalUrl === 'string' && /\/(?:dp|gp\/product|gp\/aw\/d)\/[A-Z0-9]{10}/i.test(finalUrl)) {
    return true
  }
  if (typeof html === 'string' && /"asin"\s*:\s*"[A-Z0-9]{10}"/i.test(html)) {
    return true
  }
  if (typeof html === 'string' && /id=["']ASIN["']/i.test(html)) {
    return true
  }
  if (typeof title === 'string' && /amazon/i.test(title)) {
    return true
  }
  return false
}

function detectBlockedPage({ html, title }) {
  const blob = `${title || ''}\n${html || ''}`.toLowerCase()
  if (
    blob.includes('captcha') ||
    blob.includes('automated access') ||
    blob.includes('enter the characters you see below') ||
    blob.includes('sorry, we just need to make sure') ||
    blob.includes('api-services-support@amazon.com')
  ) {
    return true
  }
  return false
}

function extractAmazonHtmlPrice(html) {
  const byJsonLdOffer = extractJsonLdOffer(html)
  if (byJsonLdOffer) {
    return byJsonLdOffer
  }

  const currencyAware = [
    /"priceCurrency"\s*:\s*"([A-Z]{3})"[\s\S]{0,200}?"price"\s*:\s*"([0-9.,]+)"/i,
    /"price"\s*:\s*"([0-9.,]+)"[\s\S]{0,200}?"priceCurrency"\s*:\s*"([A-Z]{3})"/i,
    /class=["'][^"']*a-offscreen[^"']*["'][^>]*>\s*(US\$|\$|₩|KRW)\s*([0-9.,]+)/i,
  ]
  for (const regex of currencyAware) {
    const match = html.match(regex)
    if (!match) {
      continue
    }
    const candidates = [match[1], match[2]]
    const currency = candidates.map(normalizeCurrency).find(Boolean) || null
    const price = candidates.map(normalizeNumber).find((value) => value !== null)
    if (currency && price !== null && isValidPrice(price)) {
      return { price, currency }
    }
  }

  const byJsonLd = extractJsonLdPrice(html)
  if (byJsonLd !== null && isValidPrice(byJsonLd)) {
    return { price: byJsonLd, currency: detectCurrencyFromPage(html) }
  }

  const byRegex = extractByRegexList(html, [
    /"priceToPay"\s*:\s*\{"priceAmount"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i,
    /"priceAmount"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i,
    /data-a-price=["']([0-9]+(?:\.[0-9]+)?)["']/i,
    /id=["']corePriceDisplay_desktop_feature_div["'][\s\S]*?class=["'][^"']*a-offscreen[^"']*["'][^>]*>\s*[$]?([0-9.,]+)/i,
    /id=["']priceblock_ourprice["'][^>]*>\s*[$]?([0-9.,]+)/i,
    /id=["']priceblock_dealprice["'][^>]*>\s*[$]?([0-9.,]+)/i,
    /id=["']price_inside_buybox["'][^>]*>\s*[$]?([0-9.,]+)/i,
    /<meta[^>]+property=["']product:price:amount["'][^>]+content=["']([0-9,]+(?:\.[0-9]+)?)["']/i,
    /<meta[^>]+itemprop=["']price["'][^>]+content=["']([0-9,]+(?:\.[0-9]+)?)["']/i,
  ])
  if (byRegex !== null && isValidPrice(byRegex)) {
    return { price: byRegex, currency: detectCurrencyFromPage(html) }
  }

  return null
}

export async function fetchAmazonPrice(item) {
  if (!item?.affiliateUrl) {
    throw new Error('amazon item.affiliateUrl is required')
  }

  const doc = await fetchHtmlDocument(item.affiliateUrl, { language: 'en-US,en;q=0.9' })
  let money = extractAmazonHtmlPrice(doc.html)
  let metadata = extractAmazonMetadata(doc.html, doc.title)
  let httpDoc = null

  if (money === null && (detectBlockedPage(doc) || !looksLikeAmazonProductPage(doc))) {
    httpDoc = await fetchHtmlDocument(item.affiliateUrl, {
      language: 'en-US,en;q=0.9',
      mode: 'http-only',
    })
    const retriedMoney = extractAmazonHtmlPrice(httpDoc.html)
    if (retriedMoney !== null) {
      money = retriedMoney
      metadata = extractAmazonMetadata(httpDoc.html, httpDoc.title)
    } else if (detectBlockedPage(httpDoc)) {
      throw new Error(
        `amazon blocked/anti-bot page detected (browser finalUrl=${doc.finalUrl || 'unknown'}, browser title=${doc.title || 'unknown'}, http finalUrl=${httpDoc.finalUrl || 'unknown'})`,
      )
    } else if (!looksLikeAmazonProductPage(httpDoc)) {
      throw new Error(
        `amazon resolved to non-product page (browser finalUrl=${doc.finalUrl || 'unknown'}, browser title=${doc.title || 'unknown'}, http finalUrl=${httpDoc.finalUrl || 'unknown'})`,
      )
    }
  }

  if ((!metadata.imageUrl || !metadata.category || !metadata.title || isPlaceholderTitle(metadata.title)) && !httpDoc) {
    try {
      httpDoc = await fetchHtmlDocument(item.affiliateUrl, {
        language: 'en-US,en;q=0.9',
        mode: 'http-only',
      })
      const enriched = extractAmazonMetadata(httpDoc.html, httpDoc.title)
      metadata = {
        title: !metadata.title || isPlaceholderTitle(metadata.title) ? enriched.title || metadata.title : metadata.title,
        imageUrl: metadata.imageUrl || enriched.imageUrl,
        category: metadata.category || enriched.category,
      }
    } catch {
      // keep primary metadata if http enrichment fails
    }
  }

  if (money === null) {
    throw new Error(
      `amazon price not found from page html (finalUrl=${doc.finalUrl || 'unknown'}, title=${doc.title || 'unknown'})`,
    )
  }
  if (!isValidPrice(money.price)) {
    throw new Error(
      `amazon invalid price extracted: ${money.price} (finalUrl=${doc.finalUrl || 'unknown'}, title=${doc.title || 'unknown'})`,
    )
  }

  return {
    source: 'amazon',
    externalId: item.externalId,
    title: metadata.title || item.title,
    imageUrl: metadata.imageUrl,
    category: metadata.category,
    affiliateUrl: item.affiliateUrl,
    currency: money.currency,
    price: money.price,
    fetchedWith: 'html-scrape',
  }
}
