export function getConfig() {
  return {
    trackItems: [
      {
        source: 'amazon',
        externalId: 'B0EXAMPLE01',
        title: '27" 165Hz IPS Monitor',
        affiliateUrl: 'https://www.amazon.com/dp/B0EXAMPLE01?tag=YOUR_TAG',
      },
      {
        source: 'coupang',
        externalId: '8200000001',
        title: 'ANC Bluetooth Earbuds',
        affiliateUrl: 'https://link.coupang.com/a/YOUR_ID',
      },
    ],
    outputFile: process.env.COLLECTOR_OUTPUT_FILE ?? 'collector/out/price-history.ndjson',
  }
}
