import { NextResponse } from 'next/server'
import { insertClickEvent } from '../../../lib/products-service'

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
    const productId = Number(body?.productId)

    if (!Number.isFinite(productId)) {
      return NextResponse.json({ error: 'productId must be a number' }, { status: 400 })
    }

    await insertClickEvent({
      productId,
      referrer: body?.referrer ?? null,
      sessionId: body?.sessionId ?? null,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
