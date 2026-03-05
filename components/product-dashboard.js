'use client'

import { useMemo, useState } from 'react'

async function trackClick(productId) {
  await fetch('/api/click', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      productId,
      referrer: document.referrer || null,
      sessionId: crypto.randomUUID(),
    }),
  })
}

function formatMoney(value) {
  return `₩${Number(value).toLocaleString('ko-KR')}`
}

export default function ProductDashboard({ products, historiesById }) {
  const [selectedId, setSelectedId] = useState(products[0]?.id ?? null)
  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedId) ?? products[0],
    [products, selectedId],
  )
  const points = historiesById[selectedProduct.id] ?? []
  const prices = points.map((point) => Number(point.price))
  const minPrice = prices.length ? Math.min(...prices) : 0
  const maxPrice = prices.length ? Math.max(...prices) : 0
  const currentPrice = prices.length ? prices[prices.length - 1] : 0

  const chartPoints = points
    .map((point, index) => {
      const x = (index / (points.length - 1 || 1)) * 100
      const y = 90 - ((point.price - minPrice) / (maxPrice - minPrice || 1)) * 70
      return `${x},${y}`
    })
    .join(' ')

  return (
    <main className="app">
      <header className="hero">
        <p className="eyebrow">Rare Pick MVP</p>
        <h1>쿠팡/아마존 가격 비교 추적 대시보드</h1>
        <p>API 기반 가격 히스토리와 클릭 로그 저장이 연결된 Next.js 앱입니다.</p>
      </header>

      <section className="product-list">
        {products.map((product) => (
          <button
            key={product.id}
            type="button"
            className={`product-card ${selectedId === product.id ? 'active' : ''}`}
            onClick={() => setSelectedId(product.id)}
          >
            <p className="source">{product.source}</p>
            <h2>{product.title}</h2>
            <p>{product.category}</p>
          </button>
        ))}
      </section>

      <section className="detail">
        <div className="price-stats">
          <article>
            <p>현재가</p>
            <strong>{formatMoney(currentPrice)}</strong>
          </article>
          <article>
            <p>최저가</p>
            <strong>{formatMoney(minPrice)}</strong>
          </article>
          <article>
            <p>최고가</p>
            <strong>{formatMoney(maxPrice)}</strong>
          </article>
          <article>
            <p>변동폭</p>
            <strong>{formatMoney(maxPrice - minPrice)}</strong>
          </article>
        </div>

        <div className="chart-card">
          <h3>최근 7일 가격 추이</h3>
          <svg viewBox="0 0 100 100" className="chart" role="img" aria-label="price chart">
            <polyline
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={chartPoints}
            />
          </svg>
          <div className="axis">
            {points.map((point) => (
              <span key={point.date}>{point.date.slice(5)}</span>
            ))}
          </div>
        </div>

        <div className="actions">
          <a
            href={selectedProduct.affiliateUrl}
            target="_blank"
            rel="noreferrer"
            onClick={() => trackClick(selectedProduct.id)}
          >
            제휴 링크로 구매하기
          </a>
          <p>클릭 시 `click_events` 테이블에 이벤트가 저장됩니다.</p>
        </div>
      </section>
    </main>
  )
}
