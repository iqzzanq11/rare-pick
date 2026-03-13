import './globals.css'

export const metadata = {
  title: 'Rare Pick',
  description: '쿠팡/아마존 가격 추적 및 제휴 링크 대시보드',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
