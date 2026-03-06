import { hasDatabase, query } from './db'
import { sampleProducts } from './mock-data'

function summarizeHistory(history) {
  const prices = history.map((point) => point.price)
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  const currentPrice = prices[prices.length - 1]
  return { minPrice, maxPrice, currentPrice }
}

export async function listProductsWithStats() {
  if (!hasDatabase()) {
    return sampleProducts.map((product) => {
      const stats = summarizeHistory(product.history)
      return {
        id: product.id,
        source: product.source,
        title: product.title,
        category: product.category,
        imageUrl: product.image_url ?? null,
        affiliateUrl: product.affiliate_url,
        ...stats,
      }
    })
  }

  const result = await query(
    `
      SELECT
        p.id,
        p.source,
        p.title,
        p.category,
        p.image_url,
        p.affiliate_url,
        COALESCE(MIN(ph.price), 0) AS min_price,
        COALESCE(MAX(ph.price), 0) AS max_price,
        COALESCE((
          SELECT ph2.price
          FROM price_history ph2
          WHERE ph2.product_id = p.id
          ORDER BY ph2.captured_at DESC
          LIMIT 1
        ), 0) AS current_price
      FROM products p
      LEFT JOIN price_history ph ON ph.product_id = p.id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `,
  )

  return result.rows.map((row) => ({
    id: String(row.id),
    source: row.source,
    title: row.title,
    category: row.category,
    imageUrl: row.image_url,
    affiliateUrl: row.affiliate_url,
    minPrice: Number(row.min_price),
    maxPrice: Number(row.max_price),
    currentPrice: Number(row.current_price),
  }))
}

export async function getPriceHistory(productId, days = 7) {
  if (!hasDatabase()) {
    const product = sampleProducts.find((item) => item.id === productId) ?? sampleProducts[0]
    return product.history.map((point) => ({ date: point.date, price: point.price }))
  }

  const result = await query(
    `
      SELECT
        DATE_TRUNC('day', captured_at) AS day,
        MIN(price) AS price
      FROM price_history
      WHERE product_id = $1
        AND captured_at >= NOW() - ($2 || ' days')::INTERVAL
      GROUP BY day
      ORDER BY day ASC
    `,
    [productId, String(days)],
  )

  return result.rows.map((row) => ({
    date: row.day.toISOString().slice(0, 10),
    price: Number(row.price),
  }))
}

export async function insertClickEvent({ productId, referrer, sessionId }) {
  if (!hasDatabase()) {
    return
  }

  await query(
    `
      INSERT INTO click_events (product_id, referrer, session_id)
      VALUES ($1, $2, $3)
    `,
    [productId, referrer ?? null, sessionId ?? null],
  )
}
