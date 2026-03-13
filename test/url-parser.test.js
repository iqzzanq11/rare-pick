import assert from 'node:assert/strict'
import test from 'node:test'

import { isPlaceholderTitle } from '../lib/market-registry.js'
import { parseProductUrl } from '../lib/url-parser.js'

test('parseProductUrl supports amazon urls', () => {
  const parsed = parseProductUrl('https://www.amazon.com/dp/B0ABC12345?tag=test')
  assert.equal(parsed.source, 'amazon')
  assert.equal(parsed.externalId, 'B0ABC12345')
})

test('parseProductUrl supports coupang urls', () => {
  const parsed = parseProductUrl('https://www.coupang.com/vp/products/8200000001')
  assert.equal(parsed.source, 'coupang')
  assert.equal(parsed.externalId, '8200000001')
})

test('parseProductUrl supports 11st urls', () => {
  const parsed = parseProductUrl('https://www.11st.co.kr/products/2039485721')
  assert.equal(parsed.source, '11st')
  assert.equal(parsed.externalId, '2039485721')
})

test('parseProductUrl supports gmarket urls', () => {
  const parsed = parseProductUrl('https://item.gmarket.co.kr/Item?goodscode=3012456789')
  assert.equal(parsed.source, 'gmarket')
  assert.equal(parsed.externalId, '3012456789')
})

test('parseProductUrl rejects unsupported urls', () => {
  assert.throws(
    () => parseProductUrl('https://example.com/product/1'),
    /지원하는 마켓 URL이 아닙니다/,
  )
})

test('isPlaceholderTitle supports all configured markets', () => {
  assert.equal(isPlaceholderTitle('[amazon] B0ABC12345'), true)
  assert.equal(isPlaceholderTitle('[coupang] 8200000001'), true)
  assert.equal(isPlaceholderTitle('[11st] 2039485721'), true)
  assert.equal(isPlaceholderTitle('[gmarket] 3012456789'), true)
})
