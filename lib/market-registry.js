/** @typedef {'amazon' | 'coupang' | '11st' | 'gmarket'} MarketSource */

/** @typedef {{
 * supportsRegistration: boolean,
 * supportsWatchWorker: boolean,
 * supportsInitialCollect: boolean,
 * defaultCurrency: string,
 * label: string,
 * }} MarketConfig
 */

/** @type {readonly [MarketSource, MarketSource, MarketSource, MarketSource]} */
export const SUPPORTED_SOURCES = ['amazon', 'coupang', '11st', 'gmarket']

/** @type {Record<MarketSource, string>} */
export const MARKET_LABELS = {
  amazon: '아마존',
  coupang: '쿠팡',
  '11st': '11번가',
  gmarket: 'G마켓',
}

/** @type {Record<MarketSource, MarketConfig>} */
export const MARKET_REGISTRY = {
  amazon: {
    supportsRegistration: true,
    supportsWatchWorker: true,
    supportsInitialCollect: true,
    defaultCurrency: 'USD',
    label: MARKET_LABELS.amazon,
  },
  coupang: {
    supportsRegistration: true,
    supportsWatchWorker: true,
    supportsInitialCollect: true,
    defaultCurrency: 'KRW',
    label: MARKET_LABELS.coupang,
  },
  '11st': {
    supportsRegistration: true,
    supportsWatchWorker: true,
    supportsInitialCollect: true,
    defaultCurrency: 'KRW',
    label: MARKET_LABELS['11st'],
  },
  gmarket: {
    supportsRegistration: true,
    supportsWatchWorker: true,
    supportsInitialCollect: true,
    defaultCurrency: 'KRW',
    label: MARKET_LABELS.gmarket,
  },
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function getSupportedSources() {
  return [...SUPPORTED_SOURCES]
}

export function isSupportedSource(value) {
  return SUPPORTED_SOURCES.includes(/** @type {MarketSource} */ (value))
}

export function getMarketConfig(source) {
  if (!isSupportedSource(source)) {
    throw new Error(`unsupported source: ${String(source)}`)
  }
  return MARKET_REGISTRY[source]
}

export function getMarketLabel(source) {
  if (!isSupportedSource(source)) {
    return String(source)
  }
  return MARKET_LABELS[source]
}

export function getPlaceholderTitle(source, externalId) {
  return `[${source}] ${externalId}`
}

export function getPlaceholderTitleRegex() {
  return new RegExp(`^\\[(${SUPPORTED_SOURCES.map(escapeRegex).join('|')})\\]\\s+[A-Za-z0-9_-]+$`, 'i')
}

export function getSupportedSourcePattern() {
  return SUPPORTED_SOURCES.map(escapeRegex).join('|')
}

export function isPlaceholderTitle(value) {
  return getPlaceholderTitleRegex().test(String(value || '').trim())
}

export function getSupportedMarketsText() {
  return SUPPORTED_SOURCES.map((source) => getMarketLabel(source)).join(', ')
}

export function getSupportedSourcesErrorText() {
  return `source must be one of ${SUPPORTED_SOURCES.join(', ')}`
}
