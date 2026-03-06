import { fetchAmazonPrice } from './fetchers/amazon-paapi.js'
import { getUsdKrwRate } from './fx-rate.js'
import {
  createNotificationEvent,
  listActiveWatchJobs,
  markWatchError,
  saveSnapshotForWatch,
} from './repository.js'
import { notifyPriceHit } from './notifier.js'

function convertToKrw(price, currency, usdKrwRate) {
  const numericPrice = Number(price)
  if (!Number.isFinite(numericPrice)) {
    throw new Error(`invalid price value: ${price}`)
  }

  const normalized = String(currency || '').toUpperCase()
  if (normalized === 'KRW') {
    return Math.round(numericPrice)
  }
  if (normalized === 'USD') {
    return Math.round(numericPrice * usdKrwRate)
  }

  throw new Error(`unsupported currency for KRW comparison: ${currency || 'unknown'}`)
}

function toFetchItem(watch) {
  return {
    source: watch.source,
    externalId: watch.externalId,
    title: `[${watch.source}] ${watch.externalId}`,
    affiliateUrl: watch.productUrl,
  }
}

async function fetchCurrentPrice(watch) {
  const item = toFetchItem(watch)
  if (watch.source === 'amazon') {
    return fetchAmazonPrice(item)
  }
  if (watch.source === 'coupang') {
    throw new Error('coupang fetch is temporarily paused')
  }
  throw new Error(`unsupported source: ${watch.source}`)
}

function evaluateHit({ watch, previousMinPrice, latestPrice, latestPriceKrw }) {
  const isNewLowest = previousMinPrice === null || latestPrice < previousMinPrice
  const isTargetHit = watch.targetPrice !== null && latestPriceKrw <= watch.targetPrice

  if (isTargetHit) {
    return { hit: true, reason: 'target_price' }
  }
  if (isNewLowest) {
    return { hit: true, reason: 'new_lowest' }
  }
  return { hit: false, reason: null }
}

async function processOneWatch(watch, usdKrwRate) {
  try {
    const snapshot = await fetchCurrentPrice(watch)
    const latestPriceKrw = convertToKrw(snapshot.price, snapshot.currency, usdKrwRate)
    const saved = await saveSnapshotForWatch({ watchJob: watch, snapshot })
    if (!saved.enabled) {
      console.log(`[worker] DATABASE_URL not set. skip watch#${watch.id}`)
      return
    }

    const decision = evaluateHit({
      watch,
      previousMinPrice: saved.previousMinPrice,
      latestPrice: saved.latestPrice,
      latestPriceKrw,
    })

    if (!decision.hit) {
      console.log(
        `[worker] watch#${watch.id} no hit (${saved.latestPrice} ${snapshot.currency}, ${latestPriceKrw} KRW)`,
      )
      return
    }

    const message =
      decision.reason === 'target_price'
        ? `목표가 도달(KRW): ${latestPriceKrw} <= ${watch.targetPrice} (원가 ${saved.latestPrice} ${snapshot.currency})`
        : `신규 최저가 갱신: ${saved.latestPrice} ${snapshot.currency} (환산 ${latestPriceKrw} KRW)`

    const notifyResult = await notifyPriceHit({
      watchJob: watch,
      snapshot,
      reason: decision.reason,
    })

    await createNotificationEvent({
      watchJobId: watch.id,
      productId: saved.productId,
      type: decision.reason,
      message,
      payload: notifyResult.payload,
      status: notifyResult.ok ? 'sent' : 'failed',
    })
  } catch (error) {
    await markWatchError(watch.id, error.message)
    console.error(`[worker] watch#${watch.id} failed:`, error.message)
  }
}

async function run() {
  const fx = await getUsdKrwRate()
  if (fx.warning) {
    console.warn(`[worker] USD_KRW fallback reason: ${fx.warning}`)
  }
  console.log(
    `[worker] USD_KRW rate=${fx.rate} source=${fx.source}${fx.fetchedAt ? ` fetchedAt=${fx.fetchedAt}` : ''}`,
  )

  const watches = await listActiveWatchJobs()
  console.log(`[worker] fetched ${watches.length} active watch jobs`)

  for (const watch of watches) {
    await processOneWatch(watch, fx.rate)
  }
}

run().catch((error) => {
  console.error('[worker] fatal:', error)
  process.exit(1)
})
