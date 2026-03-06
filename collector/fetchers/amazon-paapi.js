import { extractByRegexList, extractJsonLdPrice, fetchHtmlDocument } from './html-price.js'

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
  const byJsonLd = extractJsonLdPrice(html)
  if (byJsonLd !== null) {
    return byJsonLd
  }

  const byRegex = extractByRegexList(html, [
    /"displayPrice"\s*:\s*"[$]?([0-9.,]+)/i,
    /"price"\s*:\s*"[$]?([0-9.,]+)"/i,
    /"priceToPay"\s*:\s*\{"priceAmount"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i,
    /"priceAmount"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i,
    /data-a-price=["']([0-9]+(?:\.[0-9]+)?)["']/i,
    /id=["']corePriceDisplay_desktop_feature_div["'][\s\S]*?class=["'][^"']*a-offscreen[^"']*["'][^>]*>\s*[$]?([0-9.,]+)/i,
    /id=["']priceblock_ourprice["'][^>]*>\s*[$]?([0-9.,]+)/i,
    /id=["']priceblock_dealprice["'][^>]*>\s*[$]?([0-9.,]+)/i,
    /id=["']price_inside_buybox["'][^>]*>\s*[$]?([0-9.,]+)/i,
    /class=["'][^"']*a-offscreen[^"']*["'][^>]*>\s*[$]?([0-9.,]+)/i,
    /<meta[^>]+property=["']product:price:amount["'][^>]+content=["']([0-9,]+(?:\.[0-9]+)?)["']/i,
    /<meta[^>]+itemprop=["']price["'][^>]+content=["']([0-9,]+(?:\.[0-9]+)?)["']/i,
  ])
  if (byRegex !== null) {
    return byRegex
  }

  return null
}

export async function fetchAmazonPrice(item) {
  if (!item?.affiliateUrl) {
    throw new Error('amazon item.affiliateUrl is required')
  }

  const doc = await fetchHtmlDocument(item.affiliateUrl, { language: 'en-US,en;q=0.9' })
  let price = extractAmazonHtmlPrice(doc.html)

  if (price === null && (detectBlockedPage(doc) || !looksLikeAmazonProductPage(doc))) {
    const httpDoc = await fetchHtmlDocument(item.affiliateUrl, {
      language: 'en-US,en;q=0.9',
      mode: 'http-only',
    })
    const retriedPrice = extractAmazonHtmlPrice(httpDoc.html)
    if (retriedPrice !== null) {
      price = retriedPrice
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

  if (price === null) {
    throw new Error(
      `amazon price not found from page html (finalUrl=${doc.finalUrl || 'unknown'}, title=${doc.title || 'unknown'})`,
    )
  }

  return {
    source: 'amazon',
    externalId: item.externalId,
    title: item.title,
    affiliateUrl: item.affiliateUrl,
    currency: 'USD',
    price,
    fetchedWith: 'html-scrape',
  }
}
