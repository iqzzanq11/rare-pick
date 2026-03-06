import http from 'node:http'
import pg from 'pg'

const { Pool } = pg

const PORT = Number(process.env.PORT || 10000)
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)

let pool

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured')
  }
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL })
  }
  return pool
}

function isAllowedOrigin(origin) {
  if (!origin) {
    return false
  }
  if (ALLOWED_ORIGINS.includes('*')) {
    return true
  }
  return ALLOWED_ORIGINS.includes(origin)
}

function buildCorsHeaders(origin) {
  const allowOrigin = ALLOWED_ORIGINS.includes('*')
    ? '*'
    : isAllowedOrigin(origin)
      ? origin
      : 'null'

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  }
}

function sendJson(res, status, body, headers = {}) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    ...headers,
  })
  res.end(payload)
}

async function readJson(req) {
  let raw = ''
  for await (const chunk of req) {
    raw += chunk
    if (raw.length > 1_000_000) {
      throw new Error('payload too large')
    }
  }
  if (!raw) {
    return {}
  }
  return JSON.parse(raw)
}

function isValidEmail(value) {
  if (!value) {
    return true
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

async function handleClick(body) {
  const productId = Number(body?.productId)
  if (!Number.isFinite(productId)) {
    return { status: 400, body: { error: 'productId must be a number' } }
  }

  await getPool().query(
    `
      INSERT INTO click_events (product_id, referrer, session_id)
      VALUES ($1, $2, $3)
    `,
    [productId, body?.referrer ?? null, body?.sessionId ?? null],
  )

  return { status: 200, body: { ok: true } }
}

async function handleWatch(body) {
  if (!['amazon', 'coupang'].includes(body?.source)) {
    return { status: 400, body: { error: 'source must be amazon or coupang' } }
  }
  if (!body?.externalId || typeof body.externalId !== 'string') {
    return { status: 400, body: { error: 'externalId is required' } }
  }
  if (!body?.productUrl || typeof body.productUrl !== 'string') {
    return { status: 400, body: { error: 'productUrl is required' } }
  }
  if (!isValidEmail(body?.notifyEmail)) {
    return { status: 400, body: { error: 'notifyEmail is invalid' } }
  }

  const targetPrice =
    body?.targetPrice === null || body?.targetPrice === undefined || body?.targetPrice === ''
      ? null
      : Number(body.targetPrice)

  if (targetPrice !== null && !Number.isFinite(targetPrice)) {
    return { status: 400, body: { error: 'targetPrice must be a number' } }
  }

  const result = await getPool().query(
    `
      INSERT INTO watch_jobs (source, external_id, product_url, target_price, notify_email, is_active)
      VALUES ($1, $2, $3, $4, $5, TRUE)
      RETURNING id, source, external_id, product_url, target_price, notify_email,
        is_active, last_checked_at, last_price, last_error, created_at
    `,
    [body.source, body.externalId, body.productUrl, targetPrice, body?.notifyEmail ?? null],
  )

  const row = result.rows[0]
  return {
    status: 200,
    body: {
      ok: true,
      watch: {
        id: row.id,
        source: row.source,
        externalId: row.external_id,
        productUrl: row.product_url,
        targetPrice: row.target_price === null ? null : Number(row.target_price),
        notifyEmail: row.notify_email,
        isActive: row.is_active,
        lastCheckedAt: row.last_checked_at,
        lastPrice: row.last_price === null ? null : Number(row.last_price),
        lastError: row.last_error,
        createdAt: row.created_at,
      },
    },
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`)
  const corsHeaders = buildCorsHeaders(req.headers.origin)

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders)
    res.end()
    return
  }

  try {
    if (url.pathname === '/health' && req.method === 'GET') {
      await getPool().query('SELECT 1')
      sendJson(res, 200, { ok: true }, corsHeaders)
      return
    }

    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'method not allowed' }, corsHeaders)
      return
    }

    const body = await readJson(req)
    if (url.pathname === '/click') {
      const result = await handleClick(body)
      sendJson(res, result.status, result.body, corsHeaders)
      return
    }

    if (url.pathname === '/watch') {
      const result = await handleWatch(body)
      sendJson(res, result.status, result.body, corsHeaders)
      return
    }

    sendJson(res, 404, { error: 'not found' }, corsHeaders)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unexpected error'
    sendJson(res, 500, { error: message }, corsHeaders)
  }
})

server.listen(PORT, () => {
  console.log(`[render-api] listening on port ${PORT}`)
})
