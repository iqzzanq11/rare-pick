import { extractByRegexList, extractJsonLdPrice, fetchHtmlDocument } from './html-price.js'

function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
}

function stripTags(value) {
  return decodeHtml(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function looksLike11stProductPage({ html, finalUrl, title }) {
  if (typeof finalUrl === 'string' && /11st\.co\.kr/i.test(finalUrl)) {
    return true
  }
  if (typeof html === 'string' && /11번가|11st/i.test(html) && /상품|product|prdNo/i.test(html)) {
    return true
  }
  if (typeof title === 'string' && /11번가|11st/i.test(title)) {
    return true
  }
  return false
}

function detectBlockedPage({ html, title }) {
  const blob = `${title || ''}\n${html || ''}`.toLowerCase()
  return blob.includes('access denied') || blob.includes('captcha') || blob.includes('bot')
}

function extract11stPrice(html) {
  const byJsonLd = extractJsonLdPrice(html)
  if (byJsonLd !== null) {
    return byJsonLd
  }

  return extractByRegexList(html, [
    /"salePrice"\s*:\s*"?(?:KRW)?\s*([0-9,]+(?:\.[0-9]+)?)"?/i,
    /"finalDscPrc"\s*:\s*"?(?:KRW)?\s*([0-9,]+(?:\.[0-9]+)?)"?/i,
    /"selPrc"\s*:\s*"?(?:KRW)?\s*([0-9,]+(?:\.[0-9]+)?)"?/i,
    /class=["'][^"']*(?:price|sale_price)[^"']*["'][^>]*>\s*([0-9,]+)\s*원/i,
    /([0-9][0-9,]{2,})\s*원/i,
  ])
}

function extract11stMetadata(html, fallbackTitle) {
  /** @type {string | null} */
  let title = null
  /** @type {string | null} */
  let imageUrl = null

  const titleCandidates = [
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ?? null,
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? null,
    fallbackTitle,
  ]

  for (const candidate of titleCandidates) {
    const normalized = stripTags(candidate || '')
    if (normalized) {
      title = normalized.replace(/\s*[-|:]\s*11번가.*$/i, '').trim()
      break
    }
  }

  const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ?? null
  if (ogImage) {
    imageUrl = ogImage.trim()
  }

  return { title, imageUrl, category: null }
}

export async function fetch11stPrice(item) {
  if (!item?.affiliateUrl) {
    throw new Error('11st item.affiliateUrl is required')
  }

  const doc = await fetchHtmlDocument(item.affiliateUrl, { language: 'ko-KR,ko;q=0.9,en-US;q=0.8' })
  let price = extract11stPrice(doc.html)
  let metadata = extract11stMetadata(doc.html, doc.title)

  if (price === null && (detectBlockedPage(doc) || !looksLike11stProductPage(doc))) {
    const httpDoc = await fetchHtmlDocument(item.affiliateUrl, {
      language: 'ko-KR,ko;q=0.9,en-US;q=0.8',
      mode: 'http-only',
    })
    const retriedPrice = extract11stPrice(httpDoc.html)
    if (retriedPrice !== null) {
      price = retriedPrice
      metadata = extract11stMetadata(httpDoc.html, httpDoc.title)
    } else if (detectBlockedPage(httpDoc)) {
      throw new Error(
        `11st blocked/anti-bot page detected (browser finalUrl=${doc.finalUrl || 'unknown'}, http finalUrl=${httpDoc.finalUrl || 'unknown'})`,
      )
    } else if (!looksLike11stProductPage(httpDoc)) {
      throw new Error(
        `11st resolved to non-product page (browser finalUrl=${doc.finalUrl || 'unknown'}, http finalUrl=${httpDoc.finalUrl || 'unknown'})`,
      )
    }
  }

  if (price === null) {
    throw new Error(`11st price not found from page html (finalUrl=${doc.finalUrl || 'unknown'})`)
  }

  return {
    source: '11st',
    externalId: item.externalId,
    title: metadata.title || item.title,
    imageUrl: metadata.imageUrl,
    category: metadata.category,
    affiliateUrl: item.affiliateUrl,
    currency: 'KRW',
    price,
    fetchedWith: 'html-scrape',
  }
}
