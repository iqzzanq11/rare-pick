import crypto from 'node:crypto'

const AMAZON_SERVICE = process.env.AMAZON_PAAPI_SERVICE ?? 'ProductAdvertisingAPI'
const AMAZON_REGION = process.env.AMAZON_PAAPI_REGION ?? 'us-east-1'
const AMAZON_HOST = process.env.AMAZON_PAAPI_HOST ?? 'webservices.amazon.com'
const AMAZON_MARKETPLACE = process.env.AMAZON_PAAPI_MARKETPLACE ?? 'www.amazon.com'
const AMAZON_PARTNER_TYPE = process.env.AMAZON_PAAPI_PARTNER_TYPE ?? 'Associates'
const AMAZON_TARGET = 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems'

function randomPrice(base) {
  const delta = Math.floor(Math.random() * 14000) - 7000
  return Math.max(1000, base + delta)
}

function hmac(key, value, encoding = undefined) {
  return crypto.createHmac('sha256', key).update(value, 'utf8').digest(encoding)
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex')
}

function toAmzDate(date = new Date()) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '')
}

function getSigningKey(secretKey, dateStamp, region, service) {
  const kDate = hmac(`AWS4${secretKey}`, dateStamp)
  const kRegion = hmac(kDate, region)
  const kService = hmac(kRegion, service)
  return hmac(kService, 'aws4_request')
}

function extractMoney(responseJson) {
  const item = responseJson?.ItemsResult?.Items?.[0]
  if (!item) {
    return null
  }

  // Support both old Offers and newer OffersV2 trees.
  const offerAmount =
    item?.Offers?.Listings?.[0]?.Price?.Amount ??
    item?.OffersV2?.Listings?.[0]?.Price?.Money?.Amount ??
    item?.OffersV2?.Summaries?.[0]?.LowestPrice?.Amount

  if (typeof offerAmount === 'number') {
    return {
      amount: offerAmount,
      currency:
        item?.Offers?.Listings?.[0]?.Price?.Currency ??
        item?.OffersV2?.Listings?.[0]?.Price?.Money?.Currency ??
        item?.OffersV2?.Summaries?.[0]?.LowestPrice?.Currency ??
        'USD',
    }
  }

  const displayAmount =
    item?.Offers?.Listings?.[0]?.Price?.DisplayAmount ??
    item?.OffersV2?.Listings?.[0]?.Price?.DisplayAmount

  if (typeof displayAmount === 'string') {
    const numeric = Number(displayAmount.replace(/[^\d.]/g, ''))
    return Number.isFinite(numeric) && numeric > 0
      ? {
          amount: numeric,
          currency: 'USD',
        }
      : null
  }

  return null
}

function buildSignedRequest({ accessKey, secretKey, body, amzDate }) {
  const dateStamp = amzDate.slice(0, 8)
  const method = 'POST'
  const canonicalUri = '/paapi5/getitems'
  const canonicalQueryString = ''
  const canonicalHeaders = [
    `content-encoding:amz-1.0`,
    `content-type:application/json; charset=utf-8`,
    `host:${AMAZON_HOST}`,
    `x-amz-date:${amzDate}`,
    `x-amz-target:${AMAZON_TARGET}`,
  ].join('\n')
  const signedHeaders = 'content-encoding;content-type;host;x-amz-date;x-amz-target'
  const payloadHash = sha256Hex(body)
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    `${canonicalHeaders}\n`,
    signedHeaders,
    payloadHash,
  ].join('\n')

  const algorithm = 'AWS4-HMAC-SHA256'
  const credentialScope = `${dateStamp}/${AMAZON_REGION}/${AMAZON_SERVICE}/aws4_request`
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n')

  const signingKey = getSigningKey(secretKey, dateStamp, AMAZON_REGION, AMAZON_SERVICE)
  const signature = hmac(signingKey, stringToSign, 'hex')
  const authorization = [
    `${algorithm} Credential=${accessKey}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`,
  ].join(', ')

  return {
    method,
    url: `https://${AMAZON_HOST}${canonicalUri}`,
    headers: {
      'content-encoding': 'amz-1.0',
      'content-type': 'application/json; charset=utf-8',
      host: AMAZON_HOST,
      'x-amz-date': amzDate,
      'x-amz-target': AMAZON_TARGET,
      authorization,
    },
  }
}

export async function fetchAmazonPrice(item) {
  const accessKey = process.env.AMAZON_PAAPI_ACCESS_KEY
  const secretKey = process.env.AMAZON_PAAPI_SECRET_KEY
  const partnerTag = process.env.AMAZON_ASSOCIATE_TAG

  if (!accessKey || !secretKey || !partnerTag) {
    return {
      source: 'amazon',
      externalId: item.externalId,
      title: item.title,
      affiliateUrl: item.affiliateUrl,
      currency: 'KRW',
      price: randomPrice(310000),
      fetchedWith: 'mock',
    }
  }

  const requestBody = JSON.stringify({
    ItemIds: [item.externalId],
    ItemIdType: 'ASIN',
    Marketplace: AMAZON_MARKETPLACE,
    PartnerTag: partnerTag,
    PartnerType: AMAZON_PARTNER_TYPE,
    Resources: ['ItemInfo.Title', 'Offers.Listings.Price', 'OffersV2.Listings.Price'],
  })

  try {
    const amzDate = toAmzDate()
    const signed = buildSignedRequest({ accessKey, secretKey, body: requestBody, amzDate })
    const response = await fetch(signed.url, {
      method: signed.method,
      headers: signed.headers,
      body: requestBody,
    })

    const data = await response.json()
    if (!response.ok || data?.Errors?.length) {
      const reason = data?.Errors?.[0]?.Message ?? `${response.status} ${response.statusText}`
      throw new Error(reason)
    }

    const money = extractMoney(data)
    if (!money) {
      throw new Error('price amount not found in PA-API response')
    }

    return {
      source: 'amazon',
      externalId: item.externalId,
      title: item.title,
      affiliateUrl: item.affiliateUrl,
      currency: money.currency,
      price: money.amount,
      fetchedWith: 'paapi-v5',
    }
  } catch (error) {
    return {
      source: 'amazon',
      externalId: item.externalId,
      title: item.title,
      affiliateUrl: item.affiliateUrl,
      currency: 'KRW',
      price: randomPrice(300000),
      fetchedWith: `mock-fallback:${error.message}`,
    }
  }
}
