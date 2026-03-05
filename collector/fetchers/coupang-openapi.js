import { extractByRegexList, extractJsonLdPrice, fetchHtml } from './html-price.js'

function extractCoupangHtmlPrice(html) {
  const byJsonLd = extractJsonLdPrice(html)
  if (byJsonLd !== null) {
    return byJsonLd
  }

  const byRegex = extractByRegexList(html, [
    /"finalPrice"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i,
    /"salePrice"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i,
    /"discountedPrice"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i,
    /"originalPrice"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i,
    /class=["'][^"']*price-value[^"']*["'][^>]*>\s*([0-9,]+)/i,
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

  const html = await fetchHtml(item.affiliateUrl, { language: 'ko-KR,ko;q=0.9,en-US;q=0.8' })
  const price = extractCoupangHtmlPrice(html)

  if (price === null) {
    throw new Error('coupang price not found from page html')
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
