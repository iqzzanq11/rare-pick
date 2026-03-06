import { hasDatabase, query } from './db'
import { parseProductUrl } from './url-parser'
import { fetchAmazonPrice } from '../collector/fetchers/amazon-paapi.js'

async function tryCollectInitialAmazonPrice({ watchId, productId, externalId, productUrl }) {
  try {
    const snapshot = await fetchAmazonPrice({
      source: 'amazon',
      externalId,
      title: `[amazon] ${externalId}`,
      affiliateUrl: productUrl,
    })

    await query(
      `
        UPDATE products
        SET
          title = $2,
          image_url = COALESCE($3, image_url),
          category = COALESCE($4, category),
          affiliate_url = $5,
          updated_at = NOW()
        WHERE id = $1
      `,
      [productId, snapshot.title, snapshot.imageUrl ?? null, snapshot.category ?? null, snapshot.affiliateUrl],
    )

    await query(
      `
        INSERT INTO price_history (product_id, price, currency)
        VALUES ($1, $2, $3)
      `,
      [productId, snapshot.price, snapshot.currency],
    )

    await query(
      `
        UPDATE watch_jobs
        SET
          last_checked_at = NOW(),
          last_price = $2,
          last_error = NULL,
          updated_at = NOW()
        WHERE id = $1
      `,
      [watchId, snapshot.price],
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'amazon initial crawl failed'
    await query(
      `
        UPDATE watch_jobs
        SET
          last_checked_at = NOW(),
          last_error = $2,
          updated_at = NOW()
        WHERE id = $1
      `,
      [watchId, message],
    )
  }
}

function toWatchDto(row) {
  return {
    id: String(row.id),
    source: row.source,
    externalId: row.external_id,
    productUrl: row.product_url,
    targetPrice: row.target_price === null ? null : Number(row.target_price),
    notifyEmail: row.notify_email,
    isActive: row.is_active,
    lastCheckedAt: row.last_checked_at?.toISOString() ?? null,
    lastPrice: row.last_price === null ? null : Number(row.last_price),
    lastError: row.last_error,
    createdAt: row.created_at.toISOString(),
  }
}

export async function createWatchJob({ productUrl, targetPrice, notifyEmail }) {
  if (!hasDatabase()) {
    throw new Error('DATABASE_URL이 설정되지 않았거나 DB 연결이 불가능합니다.')
  }

  const parsed = parseProductUrl(productUrl)
  const normalizedTargetPrice =
    targetPrice === undefined || targetPrice === null || targetPrice === ''
      ? null
      : Number(targetPrice)

  if (normalizedTargetPrice !== null && !Number.isFinite(normalizedTargetPrice)) {
    throw new Error('targetPrice는 숫자여야 합니다.')
  }

  const productRow = await query(
    `
      INSERT INTO products (source, external_id, title, affiliate_url)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (source, external_id)
      DO UPDATE SET updated_at = NOW()
      RETURNING id
    `,
    [parsed.source, parsed.externalId, `[${parsed.source}] ${parsed.externalId}`, parsed.canonicalUrl],
  )

  const watchRow = await query(
    `
      INSERT INTO watch_jobs (
        product_id, source, external_id, product_url, target_price, notify_email
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING
        id,
        source,
        external_id,
        product_url,
        target_price,
        notify_email,
        is_active,
        last_checked_at,
        last_price,
        last_error,
        created_at
    `,
    [
      productRow.rows[0].id,
      parsed.source,
      parsed.externalId,
      parsed.canonicalUrl,
      normalizedTargetPrice,
      notifyEmail || null,
    ],
  )

  const row = watchRow.rows[0]

  if (parsed.source === 'amazon') {
    await tryCollectInitialAmazonPrice({
      watchId: row.id,
      productId: productRow.rows[0].id,
      externalId: parsed.externalId,
      productUrl: parsed.canonicalUrl,
    })
  }

  const refreshedWatchRow = await query(
    `
      SELECT
        id,
        source,
        external_id,
        product_url,
        target_price,
        notify_email,
        is_active,
        last_checked_at,
        last_price,
        last_error,
        created_at
      FROM watch_jobs
      WHERE id = $1
    `,
    [row.id],
  )

  return toWatchDto(refreshedWatchRow.rows[0])
}

export async function listWatchJobs() {
  if (!hasDatabase()) {
    return []
  }

  const result = await query(
    `
      SELECT
        w.id,
        w.source,
        w.external_id,
        w.product_url,
        w.target_price,
        w.notify_email,
        w.is_active,
        w.last_checked_at,
        w.last_price,
        w.last_error,
        w.created_at,
        p.title,
        COALESCE(MIN(ph.price), 0) AS lowest_price
      FROM watch_jobs w
      LEFT JOIN products p ON p.id = w.product_id
      LEFT JOIN price_history ph ON ph.product_id = w.product_id
      GROUP BY w.id, p.title
      ORDER BY w.created_at DESC
    `,
  )

  return result.rows.map((row) => ({
    id: String(row.id),
    source: row.source,
    externalId: row.external_id,
    title: row.title,
    productUrl: row.product_url,
    targetPrice: row.target_price === null ? null : Number(row.target_price),
    lowestPrice: Number(row.lowest_price),
    notifyEmail: row.notify_email,
    isActive: row.is_active,
    lastCheckedAt: row.last_checked_at?.toISOString() ?? null,
    lastPrice: row.last_price === null ? null : Number(row.last_price),
    lastError: row.last_error,
    createdAt: row.created_at.toISOString(),
  }))
}
