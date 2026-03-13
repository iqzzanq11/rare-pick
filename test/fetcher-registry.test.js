import assert from 'node:assert/strict'
import test from 'node:test'

import { getFetcherBySource } from '../collector/fetchers/fetcher-registry.js'
import { getMarketConfig, getSupportedSources } from '../lib/market-registry.js'

test('market registry exposes supported sources', () => {
  assert.deepEqual(getSupportedSources(), ['amazon', 'coupang', '11st', 'gmarket'])
})

test('getFetcherBySource returns a function for each supported source', () => {
  for (const source of getSupportedSources()) {
    assert.equal(typeof getFetcherBySource(source), 'function')
  }
})

test('all markets are enabled for registration and worker collection', () => {
  for (const source of getSupportedSources()) {
    const config = getMarketConfig(source)
    assert.equal(config.supportsRegistration, true)
    assert.equal(config.supportsWatchWorker, true)
    assert.equal(config.supportsInitialCollect, true)
  }
})
