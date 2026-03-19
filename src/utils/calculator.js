import { DEFAULT_EXCHANGE_RATE } from '../data/sampleData'

/**
 * 제품의 원화 원가를 반환
 * - costUSD가 있으면: costUSD × 환율 × (1 + 수입비용율/100)
 * - costKRW가 있으면: costKRW 그대로 (수입비용율 미적용)
 * @param {Object} product
 * @param {number} exchangeRate - KRW/USD 환율
 * @param {number} importCostRate - 수입 비용율 (%), 기본값 0
 */
export function getProductCostKRW(product, exchangeRate = DEFAULT_EXCHANGE_RATE, importCostRate = 0) {
  if (product.costUSD != null) {
    return Math.round(product.costUSD * exchangeRate * (1 + importCostRate / 100))
  }
  return product.costKRW ?? 0
}

/**
 * 비용 항목 1개의 VAT제외 금액을 계산
 * - fixed + vatIncluded=false: value 그대로 (이미 VAT제외)
 * - fixed + vatIncluded=true: value ÷ (1 + vatRate/100)
 * - rate: 판매가(VAT포함) × 비율% → VAT포함 금액을 ÷ (1 + vatRate/100)
 * @param {Object} item - 비용 항목 { type, value, vatIncluded }
 * @param {number} salePrice - 판매가(VAT포함), 정률 계산에 사용
 * @param {number} vatRate - VAT율 (%)
 * @returns {number} VAT제외 금액 (원 단위 정수)
 */
export function calcCostItemExVat(item, salePrice, vatRate = 10) {
  const vatMultiplier = 1 + vatRate / 100
  if (item.type === 'rate') {
    // 정률: 판매가(VAT포함) × 비율% → 그 금액을 VAT제외로 환산
    const vatIncludedAmount = salePrice * (item.value / 100)
    return Math.round(vatIncludedAmount / vatMultiplier)
  }
  // 정액
  if (item.vatIncluded) {
    return Math.round(item.value / vatMultiplier)
  }
  return Math.round(item.value)
}

/**
 * 번들의 계산 결과를 반환
 * - 판매가(retailPrice, salePrice): VAT 포함 가격
 * - 원가(cost), 비용(costItems): VAT 제외 기준으로 계산
 * - 이익 계산은 판매가(VAT제외) 기준으로 수행
 * @param {Object} bundle - 번들 객체 (costItems 또는 하위호환 eventCost)
 * @param {Object[]} products - 전체 제품 목록
 * @param {number} exchangeRate - 환율 (KRW/USD)
 * @param {number} vatRate - VAT율 (%)
 * @returns {Object} 계산 결과
 */
export function calcBundle(bundle, products, exchangeRate = DEFAULT_EXCHANGE_RATE, vatRate = 10, importCostRate = 0) {
  const productMap = Object.fromEntries(products.map(p => [p.id, p]))

  // 번들에 포함된 제품별 원가 / 정상가 합산
  let totalCost = 0
  let bundleRetailPrice = 0

  for (const item of bundle.items) {
    const product = productMap[item.productId]
    if (!product || !product.isActive) continue

    const costKRW = getProductCostKRW(product, exchangeRate, importCostRate)
    totalCost += costKRW * item.quantity
    bundleRetailPrice += product.retailPrice * item.quantity
  }

  // 할인율 / 할인 판매가 상호 계산
  let salePrice
  let discountRate
  let discountPrice

  if (bundle.discountRate != null) {
    discountRate = bundle.discountRate
    salePrice = Math.round(bundleRetailPrice * (1 - discountRate / 100))
    discountPrice = salePrice
  } else if (bundle.discountPrice != null) {
    salePrice = bundle.discountPrice
    discountPrice = bundle.discountPrice
    discountRate = bundleRetailPrice > 0
      ? Math.round(((bundleRetailPrice - salePrice) / bundleRetailPrice) * 100 * 10) / 10
      : 0
  } else {
    salePrice = bundleRetailPrice
    discountRate = 0
    discountPrice = bundleRetailPrice
  }

  const discountAmount = bundleRetailPrice - salePrice

  // VAT 제외 판매가: 판매가(VAT포함) ÷ (1 + VAT율/100)
  const vatMultiplier = 1 + vatRate / 100
  const salePriceExVat = Math.round(salePrice / vatMultiplier)

  // 총 비용(VAT제외) 계산
  // - costItems 배열이 있으면 각 항목 계산 합산
  // - 하위 호환: costItems 없고 eventCost 있으면 그대로 사용
  let totalEventCostExVat = 0
  if (bundle.costItems && bundle.costItems.length > 0) {
    totalEventCostExVat = bundle.costItems.reduce(
      (sum, item) => sum + calcCostItemExVat(item, salePrice, vatRate),
      0
    )
  } else if (bundle.eventCost) {
    totalEventCostExVat = bundle.eventCost
  }

  // 이익 계산은 판매가(VAT제외) 기준
  const grossProfit = salePriceExVat - totalCost
  const grossMargin = salePriceExVat > 0
    ? Math.round((grossProfit / salePriceExVat) * 100 * 10) / 10
    : 0
  const contributionMargin = grossProfit - totalEventCostExVat
  const contributionMarginRate = salePriceExVat > 0
    ? Math.round((contributionMargin / salePriceExVat) * 100 * 10) / 10
    : 0

  return {
    totalCost,
    bundleRetailPrice,
    salePrice,
    salePriceExVat,
    discountRate,
    discountPrice,
    discountAmount,
    totalEventCostExVat,
    grossProfit,
    grossMargin,
    contributionMargin,
    contributionMarginRate,
  }
}
