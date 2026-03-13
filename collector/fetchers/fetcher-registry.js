import { getMarketConfig } from '../../lib/market-registry.js'
import { fetch11stPrice } from './11st-html.js'
import { fetchAmazonPrice } from './amazon-paapi.js'
import { fetchCoupangPrice } from './coupang-openapi.js'
import { fetchGmarketPrice } from './gmarket-html.js'

/** @typedef {{
 * source: string,
 * externalId: string,
 * title: string,
 * affiliateUrl: string,
 * }} FetchItem
 */

/** @typedef {{
 * source: string,
 * externalId: string,
 * title: string | null,
 * imageUrl?: string | null,
 * category?: string | null,
 * affiliateUrl: string,
 * currency: string,
 * price: number,
 * fetchedWith: string,
 * }} PriceSnapshot
 */

/** @typedef {(item: FetchItem) => Promise<PriceSnapshot>} FetcherFn */

/** @type {Record<string, FetcherFn>} */
export const FETCHER_REGISTRY = {
  amazon: fetchAmazonPrice,
  coupang: fetchCoupangPrice,
  '11st': fetch11stPrice,
  gmarket: fetchGmarketPrice,
}

export function getFetcherBySource(source) {
  getMarketConfig(source)
  const fetcher = FETCHER_REGISTRY[source]
  if (!fetcher) {
    throw new Error(`unsupported source: ${source}`)
  }
  return fetcher
}
