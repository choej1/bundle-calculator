// 기본 환율 (KRW/USD)
export const DEFAULT_EXCHANGE_RATE = 1380

// 기본 VAT율 (%)
export const DEFAULT_VAT_RATE = 10

// 기본 수입 비용율 (%)
export const DEFAULT_IMPORT_COST_RATE = 0

// 기본 비용 프리셋
export const DEFAULT_COST_PRESETS = [
  { id: 'preset_001', name: '택배비',       type: 'fixed', value: 3000, vatIncluded: false, memo: '기본 택배비' },
  { id: 'preset_002', name: '플랫폼 수수료', type: 'rate',  value: 20,   vatIncluded: true,  memo: '판매가의 20%' },
  { id: 'preset_003', name: '광고비',       type: 'fixed', value: 5000, vatIncluded: false, memo: '' },
  { id: 'preset_004', name: '포장비',       type: 'fixed', value: 1500, vatIncluded: false, memo: '기본 포장비' },
]

// 샘플 제품 데이터 (5개)
export const sampleProducts = [
  {
    id: 'prod_001',
    name: '홍삼 젤리',
    category: '건강식품',
    costKRW: 8500,
    costUSD: null,
    retailPrice: 19800,
    unit: '박스',
    isActive: true,
  },
  {
    id: 'prod_002',
    name: '비타민C 1000mg',
    category: '건강식품',
    costKRW: null,
    costUSD: 3.5,        // 환율 적용 → costKRW 자동계산
    retailPrice: 12000,
    unit: '병',
    isActive: true,
  },
  {
    id: 'prod_003',
    name: '마스크팩 10매',
    category: '뷰티',
    costKRW: 3200,
    costUSD: null,
    retailPrice: 8900,
    unit: '개',
    isActive: true,
  },
  {
    id: 'prod_004',
    name: '콜라겐 파우더',
    category: '건강식품',
    costKRW: 15000,
    costUSD: null,
    retailPrice: 35000,
    unit: '개',
    isActive: true,
  },
  {
    id: 'prod_005',
    name: '쿠션 파운데이션',
    category: '뷰티',
    costKRW: null,
    costUSD: 8.2,        // 환율 적용 → costKRW 자동계산
    retailPrice: 28000,
    unit: '개',
    isActive: true,
  },
]

// 샘플 번들 데이터 (2개)
export const sampleBundles = [
  {
    id: 'bundle_001',
    name: '건강 케어 세트',
    items: [
      { productId: 'prod_001', quantity: 2 },
      { productId: 'prod_002', quantity: 1 },
    ],
    costItems: [
      { id: 'ci_s001', name: '택배비', type: 'fixed', value: 2000, vatIncluded: false, memo: '' },
    ],
    discountRate: 15,      // 15% 할인 → discountPrice 자동계산
    discountPrice: null,
    memo: '홍삼 2박스 + 비타민C 세트. 건강 선물용',
  },
  {
    id: 'bundle_002',
    name: '뷰티 에센셜 세트',
    items: [
      { productId: 'prod_003', quantity: 1 },
      { productId: 'prod_005', quantity: 1 },
    ],
    costItems: [
      { id: 'ci_s002', name: '포장비',       type: 'fixed', value: 1500, vatIncluded: false, memo: '' },
      { id: 'ci_s003', name: '플랫폼 수수료', type: 'rate',  value: 20,   vatIncluded: true,  memo: '' },
    ],
    discountRate: null,
    discountPrice: 32000,  // 판매가 직접 입력 → discountRate 자동계산
    memo: '마스크팩 + 쿠션 파운데이션 뷰티 세트',
  },
]
