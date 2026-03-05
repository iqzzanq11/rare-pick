# Next.js MVP Structure

아래는 현재 Vite MVP를 Next.js로 전환할 때 권장 디렉터리 구조입니다.

```text
app/
  page.tsx
  products/[source]/[id]/page.tsx
  api/
    products/route.ts
    prices/[productId]/route.ts
    click/route.ts
lib/
  db.ts
  pricing/
    summarize.ts
jobs/
  collect-prices.ts
  import-affiliate-reports.ts
db/
  schema.sql
collector/
  fetchers/
```

핵심 API 책임:
- `GET /api/products`: 추적 대상 상품 목록
- `GET /api/prices/:productId`: 기간별 가격 히스토리
- `POST /api/click`: 제휴 링크 클릭 로그
