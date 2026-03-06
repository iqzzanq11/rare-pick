function parseAmazonExternalId(url) {
  const patterns = [/\/dp\/([A-Z0-9]{10})/i, /\/gp\/product\/([A-Z0-9]{10})/i, /\/product\/([A-Z0-9]{10})/i]
  for (const pattern of patterns) {
    const match = url.pathname.match(pattern)
    if (match) {
      return match[1].toUpperCase()
    }
  }
  return null
}

function toCanonicalAmazonUrl(url, externalId) {
  const hostname = url.hostname.toLowerCase()
  return `https://${hostname}/dp/${externalId}`
}

function parseCoupangExternalId(url) {
  const match = url.pathname.match(/\/vp\/products\/(\d+)/i)
  return match?.[1] ?? null
}

export function parseProductUrl(rawUrl) {
  const url = new URL(rawUrl)
  const host = url.hostname.toLowerCase()

  if (host.includes('amazon.')) {
    const externalId = parseAmazonExternalId(url)
    if (!externalId) {
      throw new Error('amazon URL에서 ASIN을 찾을 수 없습니다.')
    }
    return { source: 'amazon', externalId, canonicalUrl: toCanonicalAmazonUrl(url, externalId) }
  }

  if (host.includes('coupang.com')) {
    const externalId = parseCoupangExternalId(url)
    if (!externalId) {
      throw new Error('coupang URL에서 상품 ID를 찾을 수 없습니다.')
    }
    throw new Error('현재 coupang URL 수집은 임시 보류 상태입니다. amazon URL을 사용해 주세요.')
  }

  throw new Error('현재는 amazon URL만 지원합니다.')
}
