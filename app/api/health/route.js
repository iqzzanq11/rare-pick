import { NextResponse } from 'next/server'
import { hasDatabase, query } from '../../../lib/db'

export async function GET() {
  try {
    if (!hasDatabase()) {
      return NextResponse.json({ ok: true, database: 'disabled' })
    }

    await query('SELECT 1')
    return NextResponse.json({ ok: true, database: 'connected' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unexpected error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
