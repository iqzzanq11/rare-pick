import pg from 'pg'

const { Pool } = pg

let pool

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL)
}

export function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured')
  }

  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL })
  }

  return pool
}

export async function query(text, params = []) {
  const client = getPool()
  return client.query(text, params)
}
