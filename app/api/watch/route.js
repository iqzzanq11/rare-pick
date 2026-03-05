import { NextResponse } from 'next/server'
import { hasDatabase } from '../../../lib/db'
import { createWatchJob } from '../../../lib/watch-service'

function isValidEmail(value) {
  if (!value) {
    return true
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

async function readBody(request) {
  try {
    return await request.json()
  } catch {
    return {}
  }
}

export async function POST(request) {
  try {
    const body = await readBody(request)

    if (!body?.productUrl || typeof body.productUrl !== 'string') {
      return NextResponse.json({ error: 'productUrl is required' }, { status: 400 })
    }

    if (!isValidEmail(body?.notifyEmail)) {
      return NextResponse.json({ error: 'notifyEmail is invalid' }, { status: 400 })
    }

    if (!hasDatabase()) {
      return NextResponse.json({ error: 'DATABASE_URL is not configured' }, { status: 503 })
    }

    const watch = await createWatchJob({
      productUrl: body.productUrl,
      targetPrice: body?.targetPrice,
      notifyEmail: body?.notifyEmail ?? null,
    })

    return NextResponse.json({ ok: true, watch })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
