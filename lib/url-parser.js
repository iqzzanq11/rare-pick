import { getSupportedMarketsText } from './market-registry.js'

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

function parse11stExternalId(url) {
  const queryValue = url.searchParams.get('prdNo')
  if (queryValue) {
    return queryValue
  }

  const pathMatch = url.pathname.match(/\/products\/(\d+)/i)
  return pathMatch?.[1] ?? null
}

function parseGmarketExternalId(url) {
  const queryValue = url.searchParams.get('goodscode')
  if (queryValue) {
    return queryValue
  }

  const pathMatch = url.pathname.match(/\/(?:item|goods)\/(\d+)/i)
  return pathMatch?.[1] ?? null
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
    return { source: 'coupang', externalId, canonicalUrl: url.toString() }
  }

  if (host.includes('11st.co.kr')) {
    const externalId = parse11stExternalId(url)
    if (!externalId) {
      throw new Error('11번가 URL에서 상품 ID를 찾을 수 없습니다.')
    }
    return { source: '11st', externalId, canonicalUrl: url.toString() }
  }

  if (host.includes('gmarket.co.kr')) {
    const externalId = parseGmarketExternalId(url)
    if (!externalId) {
      throw new Error('G마켓 URL에서 상품 ID를 찾을 수 없습니다.')
    }
    return { source: 'gmarket', externalId, canonicalUrl: url.toString() }
  }

  throw new Error(`현재 지원하는 마켓 URL이 아닙니다. 지원 마켓: ${getSupportedMarketsText()}`)
}
