import { NextResponse } from 'next/server'
import { hasDatabase, query } from '../../../../lib/db'

export async function GET() {
  const envConfigured = hasDatabase()
  if (!envConfigured) {
    return NextResponse.json(
      { ok: false, envConfigured: false, error: 'DATABASE_URL missing' },
      { status: 500 },
    )
  }

  try {
    const result = await query('SELECT current_database() AS db, current_user AS user')
    return NextResponse.json({
      ok: true,
      envConfigured: true,
      db: result.rows[0].db,
      user: result.rows[0].user,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        envConfigured: true,
        error: error.message,
      },
      { status: 500 },
    )
  }
}
