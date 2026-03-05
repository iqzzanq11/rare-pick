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
    return { source: 'amazon', externalId, canonicalUrl: url.toString() }
  }

  if (host.includes('coupang.com')) {
    const externalId = parseCoupangExternalId(url)
    if (!externalId) {
      throw new Error('coupang URL에서 상품 ID를 찾을 수 없습니다.')
    }
    return { source: 'coupang', externalId, canonicalUrl: url.toString() }
  }

  throw new Error('현재는 amazon/coupang URL만 지원합니다.')
}
