'use client'

import { useEffect, useState } from 'react'
import { parseProductUrl } from '../lib/url-parser'

const STORAGE_KEY = 'rare-pick-watches-v1'
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ||
  process.env.NEXT_PUBLIC_WORKER_API_BASE_URL?.replace(/\/$/, '') ||
  process.env.NEXT_PUBLIC_CLICK_API_BASE_URL?.replace(/\/$/, '')

function getWatchEndpoint() {
  if (API_BASE_URL) {
    return `${API_BASE_URL}/watch`
  }
  return '/api/watch'
}

function formatMoney(value) {
  if (value === null || value === undefined) {
    return '-'
  }
  return `₩${Number(value).toLocaleString('ko-KR')}`
}

export default function WatchDashboard({ initialWatches, dbError }) {
  const [productUrl, setProductUrl] = useState('')
  const [targetPrice, setTargetPrice] = useState('')
  const [notifyEmail, setNotifyEmail] = useState('')
  const [watches, setWatches] = useState(initialWatches)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) {
        return
      }
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        setWatches(parsed)
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(watches))
  }, [watches])

  async function submitWatchToWorker(payload) {
    const endpoint = getWatchEndpoint()
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        if (response.status >= 500) {
          return null
        }
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody?.error || 'watch 등록 API 호출에 실패했습니다.')
      }

      const data = await response.json().catch(() => ({}))
      return data?.watch ?? null
    } catch {
      return null
    }
  }

  async function onSubmit(event) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const parsed = parseProductUrl(productUrl)
      const normalizedTargetPrice =
        targetPrice === undefined || targetPrice === null || targetPrice === ''
          ? null
          : Number(targetPrice)

      if (normalizedTargetPrice !== null && !Number.isFinite(normalizedTargetPrice)) {
        throw new Error('targetPrice는 숫자여야 합니다.')
      }

      const nowIso = new Date().toISOString()
      const watch = {
        id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`,
        source: parsed.source,
        externalId: parsed.externalId,
        title: `[${parsed.source}] ${parsed.externalId}`,
        productUrl: parsed.canonicalUrl,
        targetPrice: normalizedTargetPrice,
        notifyEmail: notifyEmail || null,
        isActive: true,
        lastCheckedAt: null,
        lastPrice: null,
        lowestPrice: 0,
        lastError: null,
        createdAt: nowIso,
      }
      const inserted = await submitWatchToWorker({
        source: parsed.source,
        externalId: parsed.externalId,
        productUrl: parsed.canonicalUrl,
        targetPrice: normalizedTargetPrice,
        notifyEmail: notifyEmail || null,
      })

      if (inserted) {
        setWatches((prev) => [
          {
            id: String(inserted.id),
            source: inserted.source,
            externalId: inserted.externalId,
            title: `[${inserted.source}] ${inserted.externalId}`,
            productUrl: inserted.productUrl,
            targetPrice: inserted.targetPrice,
            notifyEmail: inserted.notifyEmail,
            isActive: inserted.isActive,
            lastCheckedAt: inserted.lastCheckedAt,
            lastPrice: inserted.lastPrice,
            lowestPrice: 0,
            lastError: inserted.lastError,
            createdAt: inserted.createdAt,
          },
          ...prev,
        ])
      } else {
        setWatches((prev) => [watch, ...prev])
      }

      setProductUrl('')
      setTargetPrice('')
      setNotifyEmail('')
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="app">
      <header className="hero">
        <p className="eyebrow">Rare Pick Watcher</p>
        <h1>상품 URL 입력 기반 최저가 알림 시스템</h1>
        <p>
          API가 연결되면 등록 데이터는 DB에 저장되고, 미연결 상태에서는 브라우저 로컬 저장소에
          저장됩니다.
        </p>
        {dbError ? <p className="error">DB 연결 오류: {dbError}</p> : null}
      </header>

      <section className="watch-form-card">
        <h2>감시 대상 등록</h2>
        <form className="watch-form" onSubmit={onSubmit}>
          <label>
            상품 URL
            <input
              required
              type="url"
              placeholder="https://www.amazon.com/dp/ASIN 또는 https://www.coupang.com/vp/products/ID"
              value={productUrl}
              onChange={(event) => setProductUrl(event.target.value)}
            />
          </label>
          <label>
            목표가(선택)
            <input
              type="number"
              min="1"
              step="1"
              placeholder="예: 199000"
              value={targetPrice}
              onChange={(event) => setTargetPrice(event.target.value)}
            />
          </label>
          <label>
            알림 이메일(선택)
            <input
              type="email"
              placeholder="you@example.com"
              value={notifyEmail}
              onChange={(event) => setNotifyEmail(event.target.value)}
            />
          </label>
          <button disabled={isSubmitting} type="submit">
            {isSubmitting ? '등록 중...' : '등록하기'}
          </button>
          {error ? <p className="error">{error}</p> : null}
        </form>
      </section>

      <section className="watch-list-card">
        <h2>등록된 감시 목록</h2>
        <div className="watch-list">
          {watches.length === 0 ? (
            <p className="empty">아직 등록된 URL이 없습니다.</p>
          ) : (
            watches.map((watch) => (
              <article key={watch.id} className="watch-row">
                <p>
                  <strong>{watch.title ?? `${watch.source}:${watch.externalId}`}</strong>
                </p>
                <p>
                  소스: {watch.source} / ID: {watch.externalId}
                </p>
                <p>현재 수집가: {formatMoney(watch.lastPrice)}</p>
                <p>최저가: {formatMoney(watch.lowestPrice)}</p>
                <p>목표가: {formatMoney(watch.targetPrice)}</p>
                <p>최근 체크: {watch.lastCheckedAt ?? '-'}</p>
                <p>오류: {watch.lastError ?? '-'}</p>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  )
}
