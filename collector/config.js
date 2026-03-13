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
      {
        source: '11st',
        externalId: '2039485721',
        title: 'Wireless Mechanical Keyboard',
        affiliateUrl: 'https://www.11st.co.kr/products/2039485721',
      },
      {
        source: 'gmarket',
        externalId: '3012456789',
        title: 'USB-C Docking Station',
        affiliateUrl: 'https://item.gmarket.co.kr/Item?goodscode=3012456789',
      },
    ],
    outputFile: process.env.COLLECTOR_OUTPUT_FILE ?? 'collector/out/price-history.ndjson',
  }
}
