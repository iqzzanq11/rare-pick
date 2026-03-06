import { extractByRegexList, extractJsonLdPrice, fetchHtmlDocument } from './html-price.js'

function looksLikeProductPage({ html, finalUrl, title }) {
  if (typeof finalUrl === 'string' && /\/vp\/products\/\d+/i.test(finalUrl)) {
    return true
  }
  if (typeof html === 'string' && /"productId"\s*:\s*"?\d+/i.test(html)) {
    return true
  }
  if (typeof title === 'string' && /쿠팡|coupang/i.test(title) && /상품|product/i.test(title)) {
    return true
  }
  return false
}

function detectBlockedPage({ html, title }) {
  const blob = `${title || ''}\n${html || ''}`.toLowerCase()
  if (blob.includes('access denied') || blob.includes('captcha') || blob.includes('bot')) {
    return true
  }
  return false
}

function extractCoupangHtmlPrice(html) {
  const byJsonLd = extractJsonLdPrice(html)
  if (byJsonLd !== null) {
    return byJsonLd
  }

  const byRegex = extractByRegexList(html, [
    /\\"finalPrice\\"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i,
    /\\"salePrice\\"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i,
    /\\"discountedPrice\\"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i,
    /\\"originalPrice\\"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i,
    /"finalPrice"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i,
    /"salePrice"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i,
    /"discountedPrice"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i,
    /"originalPrice"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i,
    /"(?:sellingPrice|basePrice|unitPrice|couponPrice|instantDiscountPrice)"\s*:\s*"?([0-9,]+(?:\.[0-9]+)?)"?/i,
    /(?:data-price|data-sale-price|data-final-price)=["']([0-9,]+(?:\.[0-9]+)?)["']/i,
    /<meta[^>]+property=["']product:price:amount["'][^>]+content=["']([0-9,]+(?:\.[0-9]+)?)["']/i,
    /<meta[^>]+itemprop=["']price["'][^>]+content=["']([0-9,]+(?:\.[0-9]+)?)["']/i,
    /id=["'][^"']*price-number[^"']*["'][^>]*>\s*([0-9,]+)/i,
    /class=["'][^"']*price-value[^"']*["'][^>]*>\s*([0-9,]+)/i,
    /([0-9][0-9,]{2,})\s*원/i,
  ])
  if (byRegex !== null) {
    return byRegex
  }

  return null
}

export async function fetchCoupangPrice(item) {
  if (!item?.affiliateUrl) {
    throw new Error('coupang item.affiliateUrl is required')
  }

  const doc = await fetchHtmlDocument(item.affiliateUrl, { language: 'ko-KR,ko;q=0.9,en-US;q=0.8' })
  let price = extractCoupangHtmlPrice(doc.html)

  if (price === null && (detectBlockedPage(doc) || !looksLikeProductPage(doc))) {
    const httpDoc = await fetchHtmlDocument(item.affiliateUrl, {
      language: 'ko-KR,ko;q=0.9,en-US;q=0.8',
      mode: 'http-only',
    })
    const retriedPrice = extractCoupangHtmlPrice(httpDoc.html)
    if (retriedPrice !== null) {
      price = retriedPrice
    } else if (detectBlockedPage(httpDoc)) {
      throw new Error(
        `coupang blocked/anti-bot page detected (browser finalUrl=${doc.finalUrl || 'unknown'}, browser title=${doc.title || 'unknown'}, http finalUrl=${httpDoc.finalUrl || 'unknown'})`,
      )
    } else if (!looksLikeProductPage(httpDoc)) {
      throw new Error(
        `coupang resolved to non-product page (browser finalUrl=${doc.finalUrl || 'unknown'}, browser title=${doc.title || 'unknown'}, http finalUrl=${httpDoc.finalUrl || 'unknown'})`,
      )
    }
  }

  if (price === null) {
    throw new Error(
      `coupang price not found from page html (finalUrl=${doc.finalUrl || 'unknown'}, title=${doc.title || 'unknown'})`,
    )
  }

  return {
    source: 'coupang',
    externalId: item.externalId,
    title: item.title,
    affiliateUrl: item.affiliateUrl,
    currency: 'KRW',
    price,
    fetchedWith: 'html-scrape',
  }
}
