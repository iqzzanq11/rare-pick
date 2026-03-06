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

async function sendTargetPriceEmail({ watchJob, snapshot, latestPriceKrw }) {
  if (!watchJob?.notifyEmail) {
    return { delivered: false, channel: 'email-skipped' }
  }

  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.NOTIFY_FROM_EMAIL
  if (!apiKey || !fromEmail) {
    return { delivered: false, channel: 'email-not-configured' }
  }

  const subject = `[Rare Pick] 목표가 도달 알림 (${latestPriceKrw} KRW)`
  const text = [
    '설정한 목표가에 도달했습니다.',
    `- 상품 URL: ${watchJob.productUrl}`,
    `- 현재가(원본): ${snapshot.price} ${snapshot.currency}`,
    `- 현재가(환산): ${latestPriceKrw} KRW`,
    `- 목표가: ${watchJob.targetPrice} KRW`,
  ].join('\n')

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [watchJob.notifyEmail],
      subject,
      text,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`email notify failed: ${response.status} ${response.statusText} ${body}`)
  }

  return { delivered: true, channel: 'email' }
}

export async function notifyPriceHit({ watchJob, snapshot, reason, latestPriceKrw = null }) {
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
    latestPriceKrw,
    targetPrice: watchJob.targetPrice ?? null,
    timestamp: new Date().toISOString(),
  }

  let webhookOk = true
  let emailOk = true
  let channel = 'console'

  try {
    const result = await sendWebhook(payload)
    channel = result.channel
  } catch (error) {
    webhookOk = false
    console.error(`[notify] failed watch#${watchJob.id}:`, error.message)
  }

  if (reason === 'target_price') {
    try {
      const emailResult = await sendTargetPriceEmail({
        watchJob,
        snapshot,
        latestPriceKrw: latestPriceKrw ?? payload.latestPriceKrw ?? 0,
      })
      channel = channel === 'console' ? emailResult.channel : `${channel}+${emailResult.channel}`
    } catch (error) {
      emailOk = false
      console.error(`[notify] email failed watch#${watchJob.id}:`, error.message)
    }
  }

  const ok = webhookOk && emailOk
  return { ok, channel, payload, error: ok ? null : 'one or more notification channels failed' }
}
