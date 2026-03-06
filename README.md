# Rare Pick MVP

쿠팡/아마존 상품 URL 등록 기반의 가격 추적 + 최저가 알림 MVP입니다.

## 포함된 것

- Next.js(App Router) 대시보드: URL 등록 + 감시 목록 조회
- DB 스키마: `products`, `price_history`, `click_events`, `affiliate_reports`
- URL 감시 스키마: `watch_jobs`, `notifications`
- 단일 Web Service 배포 모드:
  - Next 앱과 API(`/api/*`)를 같은 서비스에서 운영
  - DB 미연결/백엔드 오류 시 등록 데이터는 브라우저 `localStorage` fallback
- 수집 배치 스크립트:
  - 가격 스냅샷 수집
  - PostgreSQL 직접 적재(`DATABASE_URL` 있을 때)
  - NDJSON 백업 저장
- 워커 스크립트:
  - 활성 watch 조회
  - 가격 수집/히스토리 저장
  - 최저가 조건 체크
  - 알림 기록/발송

## 실행

```bash
npm install
npm run dev
```

브라우저: `http://localhost:3000`

## Render 배포 (단일 Web Service)

`render.yaml` 기준으로 Next 페이지 + API를 하나의 Web Service로 배포합니다.

1. Render Blueprint로 `render.yaml` 배포
2. Web Service(`rare-pick`) 설정:
   - Build command: `npm ci && npm run build`
   - Start command: `npm run start`
3. 환경변수:
   - `DATABASE_URL` (권장)
4. 헬스체크:
   - `GET /api/health`

## API 경로 (Next Route Handler)

API 서버는 Next 앱 내부 라우트로 동작합니다.

API 파일:
- `app/api/click/route.js`
- `app/api/watch/route.js`
- `app/api/health/route.js`

프론트 호출 경로:
- `components/product-dashboard.js` -> `POST /api/click` (클릭 로그)
- `components/watch-dashboard.js` -> `POST /api/watch` (등록 데이터 저장)

## 동작 흐름

1. 사용자 상품 URL 등록
2. 기본적으로 `POST /api/watch`로 DB 저장 시도
3. DB 미연결/서버 오류 시 `localStorage` fallback
4. 페이지 재방문 시 로컬 저장 목록 조회

## 가격 수집 배치 실행

```bash
npm run collect:prices
```

기본값은 `collector/out/price-history.ndjson` 에 기록되고, `DATABASE_URL`이 설정되면 DB에도 적재됩니다.

## URL 기반 워커 실행

```bash
npm run worker:watch
```

브라우저 크롤링(Playwright) 사용 시 1회 설치:

```bash
npm install
npx playwright install chromium
```

크론 예시(5분 간격):

```bash
*/5 * * * * cd /home/user/rare-pick && /usr/bin/npm run worker:watch >> /tmp/rare-pick-worker.log 2>&1
```

30분 간격 예시:

```bash
*/30 * * * * cd /home/user/rare-pick && /usr/bin/npm run worker:watch >> /tmp/rare-pick-worker.log 2>&1
```

## 실제 API 연동 방식

- Amazon/Coupang 상품 URL HTML을 직접 요청해 가격을 파싱합니다.
  - 파일: `collector/fetchers/amazon-paapi.js`, `collector/fetchers/coupang-openapi.js`
  - 공통 유틸: `collector/fetchers/html-price.js`
- 파싱/요청 실패 시 해당 watch는 `last_error`에 실패 원인이 기록됩니다.
- 알림은 `NOTIFY_WEBHOOK_URL`이 설정된 경우 웹훅으로 발송됩니다.

## 환경변수

`.env.example` 참고:

```bash
cp .env.example .env
```

- `DATABASE_URL`이 없으면 앱은 로컬 fallback 모드로 동작하고, 워커는 DB 저장을 건너뜁니다.
- `ALLOWED_ORIGINS`는 쉼표(,)로 여러 도메인 허용 가능
- 프론트는 기본적으로 같은 도메인의 `/api/*`를 호출합니다.
- 외부 API를 쓰고 싶으면 `NEXT_PUBLIC_API_BASE_URL`(또는 기존 호환 변수)로 오버라이드할 수 있습니다.
- `NOTIFY_WEBHOOK_URL` 설정 시 조건 충족 알림을 웹훅으로 발송합니다.
- `PRICE_FETCH_MODE`:
  - `browser-first`(기본): Playwright 우선, 실패 시 HTTP fallback
  - `browser-only`: Playwright만 사용
  - `http-only`: 브라우저 없이 HTTP만 사용
- `PRICE_FETCH_TIMEOUT_MS`로 상품 페이지 요청 타임아웃(ms)을 조정할 수 있습니다.
- `USD_KRW_RATE`는 USD 가격을 KRW로 환산할 때 사용하는 기본/폴백 환율입니다(기본값 `1350`).
- 워커는 USD->KRW 환율을 하루 1회 자동 갱신합니다.
  - `USD_KRW_RATE_API_URL` (기본 `https://open.er-api.com/v6/latest/USD`)
  - `USD_KRW_RATE_TIMEOUT_MS` (기본 `10000`)
  - `USD_KRW_RATE_CACHE_FILE` (기본 `collector/out/usd-krw-rate.json`)
  - API 실패 시: 캐시 값(있으면) -> `USD_KRW_RATE` 순으로 폴백
  - 가격 히스토리(`price_history`)와 상품 원본 가격(`watch_jobs.last_price`)은 URL 원본 통화(예: USD) 그대로 저장됩니다.

## DB 스키마 적용

PostgreSQL에 아래 파일을 적용하세요.

`db/schema.sql`

## Next.js 전환 안내

권장 폴더 구조와 API 경로는 다음 문서에 정리했습니다.

`docs/nextjs-mvp-structure.md`
