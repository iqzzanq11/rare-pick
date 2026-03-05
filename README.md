# Rare Pick MVP

쿠팡/아마존 상품 URL 등록 기반의 가격 추적 + 최저가 알림 MVP입니다.

## 포함된 것

- Next.js(App Router) 대시보드: URL 등록 + 감시 목록 조회
- DB 스키마: `products`, `price_history`, `click_events`, `affiliate_reports`
- URL 감시 스키마: `watch_jobs`, `notifications`
- 정적 배포 모드:
  - 등록 데이터는 브라우저 `localStorage`에 저장
  - 서버 API 라우트는 `legacy-api/app-api`로 분리 보관
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

## Cloudflare Pages 배포

이 저장소는 `next.config.mjs`에서 `output: 'export'`를 사용하므로 정적 파일(`out`)로 배포됩니다.

1. 대시보드에서 이 저장소를 **Pages** 프로젝트로 연결
2. Build command: `npm run build`
3. Build output directory: `out`
4. Node.js 버전은 20 이상 권장

## 동작 흐름

1. 사용자 상품 URL 등록 (브라우저 내 처리)
2. 등록 목록을 `localStorage`에 저장
3. 페이지 재방문 시 로컬 저장 목록 조회

## 가격 수집 배치 실행

```bash
npm run collect:prices
```

기본값은 `collector/out/price-history.ndjson` 에 기록되고, `DATABASE_URL`이 설정되면 DB에도 적재됩니다.

## URL 기반 워커 실행

```bash
npm run worker:watch
```

크론 예시(5분 간격):

```bash
*/5 * * * * cd /home/user/rare-pick && /usr/bin/npm run worker:watch >> /tmp/rare-pick-worker.log 2>&1
```

## 실제 API 연동 방식

- Amazon: PA-API v5 `GetItems`를 AWS SigV4로 서명해 호출
  - 파일: `collector/fetchers/amazon-paapi.js`
  - 필수: `AMAZON_PAAPI_ACCESS_KEY`, `AMAZON_PAAPI_SECRET_KEY`, `AMAZON_ASSOCIATE_TAG`
- Coupang: Open API 요청을 HMAC(`CEA algorithm=HmacSHA256`)로 서명해 호출
  - 파일: `collector/fetchers/coupang-openapi.js`
  - 필수: `COUPANG_ACCESS_KEY`, `COUPANG_SECRET_KEY`

키 또는 응답 파싱 실패 시 자동으로 mock 가격 fallback으로 동작하며, 원인은 `fetchedWith` 로그에 남습니다.

## 환경변수

`.env.example` 참고:

```bash
cp .env.example .env
```

- `DATABASE_URL`이 없으면 앱/수집기 모두 mock/fallback 모드로 동작합니다.
- 아마존/쿠팡 API 키가 없으면 수집기는 mock 가격으로 동작합니다.
- 쿠팡 API 경로가 계정/권한에 따라 다르면 `COUPANG_OPENAPI_PATH_TEMPLATE`를 수정하세요.
- `NOTIFY_WEBHOOK_URL` 설정 시 조건 충족 알림을 웹훅으로 발송합니다.

## DB 스키마 적용

PostgreSQL에 아래 파일을 적용하세요.

`db/schema.sql`

## Next.js 전환 안내

권장 폴더 구조와 API 경로는 다음 문서에 정리했습니다.

`docs/nextjs-mvp-structure.md`
