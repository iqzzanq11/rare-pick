async function sendWebhook(payload) {
  const webhook = process.env.NOTIFY_WEBHOOK_URL
  if (!webhook) {
    return { delivered: false, channel: 'console' }
  }

  const response = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    throw new Error(`webhook notify failed: ${response.status} ${response.statusText}`)
  }
  return { delivered: true, channel: 'webhook' }
}

export async function notifyPriceHit({ watchJob, snapshot, reason }) {
  const payload = {
    type: 'price_hit',
    reason,
    watchJobId: watchJob.id,
    source: snapshot.source,
    externalId: snapshot.externalId,
    productUrl: watchJob.productUrl,
    notifyEmail: watchJob.notifyEmail ?? null,
    price: snapshot.price,
    currency: snapshot.currency,
    timestamp: new Date().toISOString(),
  }

  try {
    const result = await sendWebhook(payload)
    console.log(`[notify] ${reason} watch#${watchJob.id} ${snapshot.price} (${result.channel})`)
    return { ok: true, channel: result.channel, payload }
  } catch (error) {
    console.error(`[notify] failed watch#${watchJob.id}:`, error.message)
    return { ok: false, channel: 'error', payload, error: error.message }
  }
}
