import { getSupportedSourcesErrorText, isSupportedSource } from '../../../lib/market-registry.js'
import { parseProductUrl } from '../../../lib/url-parser.js'

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST,GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  }
}

function resolveAllowedOrigin(request, env) {
  if (!env.ALLOWED_ORIGIN || env.ALLOWED_ORIGIN === '*') {
    return '*'
  }

  const origin = request.headers.get('Origin')
  if (origin && origin === env.ALLOWED_ORIGIN) {
    return origin
  }

  return 'null'
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...headers,
    },
  })
}

function isValidEmail(value) {
  if (!value) {
    return true
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const allowedOrigin = resolveAllowedOrigin(request, env)
    const headers = corsHeaders(allowedOrigin)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers })
    }

    if (url.pathname === '/health' && request.method === 'GET') {
      return json({ ok: true }, 200, headers)
    }

    if (url.pathname !== '/click') {
      if (url.pathname !== '/watch') {
        return json({ error: 'not found' }, 404, headers)
      }
    }

    if (request.method !== 'POST') {
      return json({ error: 'method not allowed' }, 405, headers)
    }

    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return json({ error: 'worker secrets are not configured' }, 500, headers)
    }

    let body
    try {
      body = await request.json()
    } catch {
      return json({ error: 'invalid json body' }, 400, headers)
    }

    if (url.pathname === '/click') {
      const productId = Number(body?.productId)
      if (!Number.isFinite(productId)) {
        return json({ error: 'productId must be a number' }, 400, headers)
      }

      const insertResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/click_events`, {
        method: 'POST',
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          product_id: productId,
          referrer: body?.referrer ?? null,
          session_id: body?.sessionId ?? null,
        }),
      })

      if (!insertResponse.ok) {
        const errorText = await insertResponse.text()
        return json(
          {
            error: 'failed to insert click event',
            details: errorText.slice(0, 500),
          },
          502,
          headers,
        )
      }

      return json({ ok: true }, 200, headers)
    }

    if (!body?.productUrl || typeof body.productUrl !== 'string') {
      return json({ error: 'productUrl is required' }, 400, headers)
    }
    if (!isValidEmail(body?.notifyEmail)) {
      return json({ error: 'notifyEmail is invalid' }, 400, headers)
    }

    const targetPrice =
      body?.targetPrice === null || body?.targetPrice === undefined || body?.targetPrice === ''
        ? null
        : Number(body.targetPrice)

    if (targetPrice !== null && !Number.isFinite(targetPrice)) {
      return json({ error: 'targetPrice must be a number' }, 400, headers)
    }

    let parsed
    try {
      parsed = parseProductUrl(body.productUrl)
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : 'failed to parse productUrl' },
        400,
        headers,
      )
    }

    const source = body?.source && isSupportedSource(body.source) ? body.source : parsed.source
    const externalId =
      typeof body?.externalId === 'string' && body.externalId.trim() ? body.externalId.trim() : parsed.externalId

    if (!isSupportedSource(source)) {
      return json({ error: getSupportedSourcesErrorText() }, 400, headers)
    }
    if (!externalId) {
      return json({ error: 'externalId is required' }, 400, headers)
    }

    const insertResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/watch_jobs`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        source,
        external_id: externalId,
        product_url: parsed.canonicalUrl,
        target_price: targetPrice,
        notify_email: body?.notifyEmail ?? null,
        is_active: true,
      }),
    })

    if (!insertResponse.ok) {
      const errorText = await insertResponse.text()
      return json(
        {
          error: 'failed to insert watch job',
          details: errorText.slice(0, 500),
        },
        502,
        headers,
      )
    }

    const row = await insertResponse.json()
    const inserted = Array.isArray(row) ? row[0] : row
    return json(
      {
        ok: true,
        watch: inserted
          ? {
              id: inserted.id,
              source: inserted.source,
              externalId: inserted.external_id,
              productUrl: inserted.product_url,
              targetPrice: inserted.target_price,
              notifyEmail: inserted.notify_email,
              isActive: inserted.is_active,
              lastCheckedAt: inserted.last_checked_at,
              lastPrice: inserted.last_price,
              lastError: inserted.last_error,
              createdAt: inserted.created_at,
            }
          : null,
      },
      200,
      headers,
    )
  },
}
