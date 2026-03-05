import { NextResponse } from 'next/server'
import { getPriceHistory } from '../../../../lib/products-service'

export async function GET(_request, context) {
  const { productId } = context.params
  const history = await getPriceHistory(productId, 30)
  return NextResponse.json({ productId, history })
}
