# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 개발 명령어

```bash
npm run dev      # 개발 서버 시작 (HMR 포함)
npm run build    # 프로덕션 빌드 (빌드 성공 여부로 타입/구문 오류 확인)
npm run lint     # ESLint 실행
npm run preview  # 빌드 결과물 로컬 미리보기
```

테스트 프레임워크 없음. 변경 후 반드시 `npm run build`로 오류 여부 확인할 것.

## 아키텍처 개요

번들 상품의 수익성을 계산하는 단일 페이지 React 앱. 서버 없음, 모든 상태는 `localStorage`에 저장.

### 상태 흐름

```
App.jsx (useStore 호출)
  └─ useStore.js (localStorage ↔ React state)
       ├─ products[]
       ├─ bundles[]
       ├─ settings { exchangeRate, vatRate }
       └─ costPresets[]
```

`useStore`가 유일한 전역 상태 관리자. Context 없이 `App.jsx`에서 모든 상태와 CRUD 함수를 props로 자식 페이지에 전달한다.

### 계산 로직 (`src/utils/calculator.js`)

모든 수익성 계산의 핵심. **이 파일의 공식을 변경할 때는 특히 주의.**

- `getProductCostKRW(product, exchangeRate)` — 달러 원가를 환율로 환산
- `calcCostItemExVat(item, salePrice, vatRate)` — 비용 항목 1개의 VAT제외 금액 계산
  - `type='fixed'`: `vatIncluded=true`면 `value ÷ (1+vatRate/100)`, 아니면 그대로
  - `type='rate'`: `salePrice × value% ÷ (1+vatRate/100)`
- `calcBundle(bundle, products, exchangeRate, vatRate)` — 번들 전체 계산. 반환값:
  - `bundleRetailPrice`, `salePrice` — VAT **포함** 가격
  - `salePriceExVat` — 판매가 ÷ (1+vatRate/100)
  - `totalCost` — 원가 합계 (VAT제외)
  - `totalEventCostExVat` — 비용 항목 합계 (VAT제외)
  - `grossProfit`, `grossMargin` — `salePriceExVat` 기준
  - `contributionMargin`, `contributionMarginRate` — `salePriceExVat` 기준

### VAT 처리 원칙

- **판매가** (`retailPrice`, `salePrice`): VAT **포함**
- **원가** (`costKRW`, `costUSD`): VAT **제외**
- **비용** (`costItems`): `vatIncluded` 필드로 개별 관리
- 이익/이익률은 반드시 `salePriceExVat` 기준으로 계산

### 번들 데이터 구조

```js
{
  id, name, memo,
  items: [{ productId, quantity }],
  costItems: [{ id, name, type, value, vatIncluded, memo }], // 'fixed' | 'rate'
  discountRate: number | null,   // 둘 중 하나만 사용
  discountPrice: number | null,  //
}
```

구형 번들(`eventCost` 필드)은 `calcBundle`에서 하위호환 처리됨. `handleSelectBundle`에서 로드 시 `costItems`로 변환.

### 비용 프리셋 (`costPresets`)

`useStore`에서 별도 관리 (`bundle-calc-cost-presets` 키). 번들 저장 시 실제 값이 `costItems`에 복사되므로 프리셋 수정이 기존 번들에 영향 없음.

### 페이지 구조

| 파일 | 역할 |
|------|------|
| `BundleBuilderPage.jsx` | 번들 구성 + 실시간 계산 결과 표시 |
| `ComparePage.jsx` | 최대 4개 번들 비교 (Recharts 차트 포함) |
| `SettingsPage.jsx` | 환율/VAT 설정 + 비용 프리셋 CRUD (탭 2개) |
| `ProductsPage.jsx` | 제품 CRUD + CSV 가져오기/내보내기 |

### 색상 기준 (이익률)

```js
rate >= 25%  → emerald (초록)
rate >= 15%  → amber (주황)
rate < 15%   → red (빨강)  // 경고 배너 표시
```

`rateColor()`, `rateBg()` 함수가 각 페이지에 로컬로 정의되어 있음.

### 엑셀 내보내기 (`src/utils/exportExcel.js`)

`calcBundle` 결과를 직접 참조하므로 `calculator.js` 반환 키를 바꾸면 함께 수정 필요.
