import crypto from 'node:crypto'

const COUPANG_HOST = process.env.COUPANG_OPENAPI_HOST ?? 'api-gateway.coupang.com'
const COUPANG_PATH_TEMPLATE =
  process.env.COUPANG_OPENAPI_PATH_TEMPLATE ??
  '/v2/providers/affiliate_open_api/apis/openapi/v1/products/{productId}'

function randomPrice(base) {
  const delta = Math.floor(Math.random() * 8000) - 4000
  return Math.max(1000, base + delta)
}

function coupangDatetime(date = new Date()) {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
    .slice(2)
}

function sign({ secretKey, datetime, method, path, query }) {
  const message = `${datetime}${method}${path}${query}`
  return crypto.createHmac('sha256', secretKey).update(message, 'utf8').digest('hex')
}

function buildSignedRequest({ accessKey, secretKey, productId }) {
  const method = 'GET'
  const path = COUPANG_PATH_TEMPLATE.replace('{productId}', encodeURIComponent(String(productId)))
  const query = ''
  const datetime = coupangDatetime()
  const signature = sign({ secretKey, datetime, method, path, query })
  const authorization = `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`

  return {
    url: `https://${COUPANG_HOST}${path}`,
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json;charset=UTF-8',
    },
  }
}

function extractPrice(payload) {
  const data = payload?.data
  if (!data) {
    return null
  }

  if (typeof data?.salePrice === 'number') {
    return data.salePrice
  }

  if (typeof data?.price === 'number') {
    return data.price
  }

  if (Array.isArray(data) && typeof data[0]?.salePrice === 'number') {
    return data[0].salePrice
  }

  return null
}

export async function fetchCoupangPrice(item) {
  const accessKey = process.env.COUPANG_ACCESS_KEY
  const secretKey = process.env.COUPANG_SECRET_KEY

  if (!accessKey || !secretKey) {
    return {
      source: 'coupang',
      externalId: item.externalId,
      title: item.title,
      affiliateUrl: item.affiliateUrl,
      currency: 'KRW',
      price: randomPrice(86000),
      fetchedWith: 'mock',
    }
  }

  try {
    const request = buildSignedRequest({ accessKey, secretKey, productId: item.externalId })
    const response = await fetch(request.url, { method: 'GET', headers: request.headers })
    const payload = await response.json()

    if (!response.ok || payload?.code) {
      const reason =
        payload?.message ?? payload?.code ?? `${response.status} ${response.statusText}`
      throw new Error(reason)
    }

    const price = extractPrice(payload)
    if (!price) {
      throw new Error('price not found in Coupang response')
    }

    return {
      source: 'coupang',
      externalId: item.externalId,
      title: item.title,
      affiliateUrl: item.affiliateUrl,
      currency: 'KRW',
      price,
      fetchedWith: 'coupang-openapi',
    }
  } catch (error) {
    return {
      source: 'coupang',
      externalId: item.externalId,
      title: item.title,
      affiliateUrl: item.affiliateUrl,
      currency: 'KRW',
      price: randomPrice(85000),
      fetchedWith: `mock-fallback:${error.message}`,
    }
  }
}
