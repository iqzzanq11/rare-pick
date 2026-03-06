import fs from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_RATE = 1350
const DEFAULT_API_URL = 'https://open.er-api.com/v6/latest/USD'
const DEFAULT_TIMEOUT_MS = 10000
const DEFAULT_CACHE_FILE = 'collector/out/usd-krw-rate.json'
const DAY_MS = 24 * 60 * 60 * 1000

function readPositiveNumber(raw, fallback) {
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }
  return parsed
}

function getFallbackRate() {
  return readPositiveNumber(process.env.USD_KRW_RATE, DEFAULT_RATE)
}

function getCacheFilePath() {
  return process.env.USD_KRW_RATE_CACHE_FILE || DEFAULT_CACHE_FILE
}

function getApiUrl() {
  return process.env.USD_KRW_RATE_API_URL || DEFAULT_API_URL
}

function getTimeoutMs() {
  return readPositiveNumber(process.env.USD_KRW_RATE_TIMEOUT_MS, DEFAULT_TIMEOUT_MS)
}

function parseRateFromPayload(payload) {
  const byRates = payload?.rates?.KRW
  const byDirect = payload?.KRW
  const rate = readPositiveNumber(byRates ?? byDirect, NaN)
  if (!Number.isFinite(rate)) {
    throw new Error('KRW rate is missing in API response')
  }
  return rate
}

async function readCache(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw)
    const rate = readPositiveNumber(parsed?.rate, NaN)
    const fetchedAt = Date.parse(parsed?.fetchedAt || '')
    if (!Number.isFinite(rate) || !Number.isFinite(fetchedAt)) {
      return null
    }
    return { rate, fetchedAt, source: 'cache' }
  } catch {
    return null
  }
}

async function writeCache(filePath, rate) {
  const dirPath = path.dirname(filePath)
  await fs.mkdir(dirPath, { recursive: true })
  await fs.writeFile(
    filePath,
    JSON.stringify({ rate, fetchedAt: new Date().toISOString() }, null, 2),
    'utf8',
  )
}

function isFresh(cache) {
  if (!cache) {
    return false
  }
  const age = Date.now() - cache.fetchedAt
  return age >= 0 && age < DAY_MS
}

async function fetchRateFromApi(url, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
      },
    })
    if (!response.ok) {
      throw new Error(`request failed: ${response.status} ${response.statusText}`)
    }
    const payload = await response.json()
    return parseRateFromPayload(payload)
  } finally {
    clearTimeout(timer)
  }
}

export async function getUsdKrwRate() {
  const cacheFile = getCacheFilePath()
  const apiUrl = getApiUrl()
  const timeoutMs = getTimeoutMs()
  const fallbackRate = getFallbackRate()
  const cache = await readCache(cacheFile)

  if (isFresh(cache)) {
    return { rate: cache.rate, source: 'cache', fetchedAt: new Date(cache.fetchedAt).toISOString() }
  }

  try {
    const latestRate = await fetchRateFromApi(apiUrl, timeoutMs)
    await writeCache(cacheFile, latestRate)
    return { rate: latestRate, source: 'api', fetchedAt: new Date().toISOString() }
  } catch (error) {
    if (cache) {
      return {
        rate: cache.rate,
        source: 'cache-stale',
        fetchedAt: new Date(cache.fetchedAt).toISOString(),
        warning: error instanceof Error ? error.message : String(error),
      }
    }
    return {
      rate: fallbackRate,
      source: 'env-fallback',
      fetchedAt: null,
      warning: error instanceof Error ? error.message : String(error),
    }
  }
}
