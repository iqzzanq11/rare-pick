import { NextResponse } from 'next/server'
import { createWatchJob, listWatchJobs } from '../../../lib/watch-service'

export async function GET() {
  const watches = await listWatchJobs()
  return NextResponse.json({ watches })
}

export async function POST(request) {
  try {
    const body = await request.json()
    if (!body?.productUrl) {
      return NextResponse.json({ error: 'productUrl is required' }, { status: 400 })
    }

    const watch = await createWatchJob({
      productUrl: body.productUrl,
      targetPrice: body.targetPrice,
      notifyEmail: body.notifyEmail,
    })
    return NextResponse.json({ watch }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
