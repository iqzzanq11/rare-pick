import { extractByRegexList, extractJsonLdPrice, fetchHtml } from './html-price.js'

function extractAmazonHtmlPrice(html) {
  const byJsonLd = extractJsonLdPrice(html)
  if (byJsonLd !== null) {
    return byJsonLd
  }

  const byRegex = extractByRegexList(html, [
    /"priceToPay"\s*:\s*\{"priceAmount"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i,
    /"priceAmount"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i,
    /id=["']priceblock_ourprice["'][^>]*>\s*[$]?([0-9.,]+)/i,
    /id=["']priceblock_dealprice["'][^>]*>\s*[$]?([0-9.,]+)/i,
    /class=["'][^"']*a-offscreen[^"']*["'][^>]*>\s*[$]?([0-9.,]+)/i,
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

  const html = await fetchHtml(item.affiliateUrl, { language: 'en-US,en;q=0.9' })
  const price = extractAmazonHtmlPrice(html)

  if (price === null) {
    throw new Error('amazon price not found from page html')
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
