import fs from 'node:fs/promises'
import path from 'node:path'
import pg from 'pg'

const { Pool } = pg
let pool

function getPool() {
  if (!process.env.DATABASE_URL) {
    return null
  }

  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL })
  }

  return pool
}

export async function appendSnapshots(filePath, snapshots) {
  if (!snapshots.length) {
    return
  }

  const dirPath = path.dirname(filePath)
  await fs.mkdir(dirPath, { recursive: true })

  const lines = snapshots
    .map((snapshot) => JSON.stringify({ ...snapshot, capturedAt: new Date().toISOString() }))
    .join('\n')

  await fs.appendFile(filePath, `${lines}\n`, 'utf8')
}

export async function insertSnapshotsToDb(snapshots) {
  const db = getPool()
  if (!db || !snapshots.length) {
    return { inserted: 0, enabled: false }
  }

  const client = await db.connect()
  try {
    await client.query('BEGIN')

    let inserted = 0
    for (const snapshot of snapshots) {
      const productResult = await client.query(
        `
          INSERT INTO products (source, external_id, title, image_url, affiliate_url, category)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (source, external_id)
          DO UPDATE SET
            title = EXCLUDED.title,
            image_url = COALESCE(EXCLUDED.image_url, products.image_url),
            affiliate_url = EXCLUDED.affiliate_url,
            category = COALESCE(EXCLUDED.category, products.category),
            updated_at = NOW()
          RETURNING id
        `,
        [
          snapshot.source,
          snapshot.externalId,
          snapshot.title,
          snapshot.imageUrl ?? null,
          snapshot.affiliateUrl,
          snapshot.category ?? null,
        ],
      )

      await client.query(
        `
          INSERT INTO price_history (product_id, price, currency)
          VALUES ($1, $2, $3)
        `,
        [productResult.rows[0].id, snapshot.price, snapshot.currency],
      )
      inserted += 1
    }

    await client.query('COMMIT')
    return { inserted, enabled: true }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function listActiveWatchJobs() {
  const db = getPool()
  if (!db) {
    return []
  }

  const result = await db.query(
    `
      SELECT
        id,
        product_id,
        source,
        external_id,
        product_url,
        target_price,
        notify_email
      FROM watch_jobs
      WHERE is_active = TRUE
      ORDER BY created_at ASC
    `,
  )

  return result.rows.map((row) => ({
    id: String(row.id),
    productId: row.product_id ? String(row.product_id) : null,
    source: row.source,
    externalId: row.external_id,
    productUrl: row.product_url,
    targetPrice: row.target_price === null ? null : Number(row.target_price),
    notifyEmail: row.notify_email,
  }))
}

export async function saveSnapshotForWatch({ watchJob, snapshot, errorMessage = null }) {
  const db = getPool()
  if (!db) {
    return {
      enabled: false,
      productId: null,
      previousMinPrice: null,
      latestPrice: Number(snapshot.price),
    }
  }

  const client = await db.connect()
  try {
    await client.query('BEGIN')

    const productResult = await client.query(
      `
        INSERT INTO products (source, external_id, title, image_url, affiliate_url, category)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (source, external_id)
        DO UPDATE SET
          title = EXCLUDED.title,
          image_url = COALESCE(EXCLUDED.image_url, products.image_url),
          affiliate_url = EXCLUDED.affiliate_url,
          category = COALESCE(EXCLUDED.category, products.category),
          updated_at = NOW()
        RETURNING id
      `,
      [
        snapshot.source,
        snapshot.externalId,
        snapshot.title,
        snapshot.imageUrl ?? null,
        snapshot.affiliateUrl,
        snapshot.category ?? null,
      ],
    )
    const productId = productResult.rows[0].id

    const minBeforeResult = await client.query(
      `
        SELECT MIN(price) AS min_price
        FROM price_history
        WHERE product_id = $1
      `,
      [productId],
    )
    const previousMinPrice =
      minBeforeResult.rows[0].min_price === null ? null : Number(minBeforeResult.rows[0].min_price)

    await client.query(
      `
        INSERT INTO price_history (product_id, price, currency)
        VALUES ($1, $2, $3)
      `,
      [productId, snapshot.price, snapshot.currency],
    )

    await client.query(
      `
        UPDATE watch_jobs
        SET
          product_id = $2,
          last_checked_at = NOW(),
          last_price = $3,
          last_error = $4,
          updated_at = NOW()
        WHERE id = $1
      `,
      [watchJob.id, productId, snapshot.price, errorMessage],
    )

    await client.query('COMMIT')
    return {
      enabled: true,
      productId: String(productId),
      previousMinPrice,
      latestPrice: Number(snapshot.price),
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function markWatchError(watchJobId, message) {
  const db = getPool()
  if (!db) {
    return
  }
  await db.query(
    `
      UPDATE watch_jobs
      SET
        last_checked_at = NOW(),
        last_error = $2,
        updated_at = NOW()
      WHERE id = $1
    `,
    [watchJobId, message],
  )
}

export async function createNotificationEvent({
  watchJobId,
  productId,
  type,
  message,
  payload,
  status = 'sent',
}) {
  const db = getPool()
  if (!db) {
    return
  }
  await db.query(
    `
      INSERT INTO notifications (
        watch_job_id,
        product_id,
        notification_type,
        message,
        payload,
        status
      ) VALUES ($1, $2, $3, $4, $5::jsonb, $6)
    `,
    [watchJobId, productId, type, message, JSON.stringify(payload), status],
  )
}
