import { NextResponse } from 'next/server'
import { listProductsWithStats } from '../../../lib/products-service'

export async function GET() {
  const products = await listProductsWithStats()
  return NextResponse.json({ products })
}
