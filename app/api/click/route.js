import { NextResponse } from 'next/server'
import { insertClickEvent } from '../../../lib/products-service'

export async function POST(request) {
  const body = await request.json()
  const productId = body?.productId

  if (!productId) {
    return NextResponse.json({ error: 'productId is required' }, { status: 400 })
  }

  await insertClickEvent({
    productId,
    referrer: body?.referrer,
    sessionId: body?.sessionId,
  })

  return NextResponse.json({ ok: true })
}
