import * as XLSX from 'xlsx'
import { calcBundle, getProductCostKRW } from './calculator'

// ─── 숫자 포맷 상수 ────────────────────────────────────────────────
// xlsx 커뮤니티 에디션은 셀 배경색을 지원하지 않으므로
// 숫자 포맷 + 열 너비 + 행 높이 + 셀 병합으로 서식을 구성한다.
const FMT_KRW  = '#,##0'          // 원화 정수 (₩ 기호는 열 헤더에 표기)
const FMT_USD  = '#,##0.00'        // 달러 소수 2자리
const FMT_PCT  = '0.0"%"'          // % 기호 리터럴 (값 자체가 0~100 범위)
const FMT_DATE = 'yyyy-mm-dd hh:mm'

// ─── 셀 생성 헬퍼 ─────────────────────────────────────────────────
function cell(value, fmt) {
  if (value == null || value === '') return { t: 's', v: '-' }
  if (typeof value === 'number') {
    return fmt ? { t: 'n', v: value, z: fmt } : { t: 'n', v: value }
  }
  return { t: 's', v: String(value) }
}

// 헤더 셀 (문자열, 특별 표시 없이 텍스트만 — 커뮤니티판 제한)
function hCell(label) {
  return { t: 's', v: label }
}

// 시트에 2D 배열을 쓰는 헬퍼 (startRow/startCol 0-based)
function writeGrid(ws, grid, startRow = 0, startCol = 0) {
  grid.forEach((row, r) => {
    row.forEach((cellObj, c) => {
      const addr = XLSX.utils.encode_cell({ r: startRow + r, c: startCol + c })
      ws[addr] = cellObj
    })
  })
}

// 셀 범위 ref 업데이트
function updateRef(ws, data, startRow, startCol) {
  const rows = data.length
  const cols = Math.max(...data.map((r) => r.length))
  const existing = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : null
  const newRange = {
    s: { r: existing ? Math.min(existing.s.r, startRow) : startRow,
         c: existing ? Math.min(existing.s.c, startCol) : startCol },
    e: { r: existing ? Math.max(existing.e.r, startRow + rows - 1) : startRow + rows - 1,
         c: existing ? Math.max(existing.e.c, startCol + cols - 1) : startCol + cols - 1 },
  }
  ws['!ref'] = XLSX.utils.encode_range(newRange)
}

// ─── Sheet1: 번들 비교 ─────────────────────────────────────────────
function buildCompareSheet(selected, calcs, products, exchangeRate) {
  const ws = {}

  const productMap = Object.fromEntries(products.map((p) => [p.id, p]))
  const now = new Date()
  const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`

  // ── 타이틀 행 ──────────────────────────────────────────────────
  const titleGrid = [
    [hCell('번들 비교 리포트')],
    [hCell(`기준환율: ₩${exchangeRate.toLocaleString('ko-KR')}/USD    출력일시: ${dateStr}`)],
    [hCell('')],
  ]

  // ── 핵심 지표 섹션 ─────────────────────────────────────────────
  const metricHeaders = [
    hCell('항목'),
    ...selected.map((b) => hCell(b.name)),
  ]

  const METRIC_ROWS = [
    { label: '── 가격 구조 ──', key: null },
    { label: '번들 정상가 (원)',        key: 'bundleRetailPrice',      fmt: FMT_KRW  },
    { label: '행사 판매가 (원)',        key: 'salePrice',              fmt: FMT_KRW  },
    { label: '할인율 (%)',             key: 'discountRate',           fmt: FMT_PCT  },
    { label: '할인액 (원)',            key: 'discountAmount',         fmt: FMT_KRW  },
    { label: '── 원가 / 이익 ──', key: null },
    { label: '총 원가 (원)',           key: 'totalCost',              fmt: FMT_KRW  },
    { label: '매출총이익 (원)',         key: 'grossProfit',            fmt: FMT_KRW  },
    { label: '매출총이익률 (%)',        key: 'grossMargin',            fmt: FMT_PCT  },
    { label: '공헌이익 (원)',          key: 'contributionMargin',     fmt: FMT_KRW  },
    { label: '공헌이익률 (%)',         key: 'contributionMarginRate', fmt: FMT_PCT  },
    { label: '── 기타 ──', key: null },
    { label: '총 비용 VAT제외 (원)',    key: 'totalEventCostExVat',    fmt: FMT_KRW  },
    { label: '구성 제품 수',           key: '__itemCount__',          fmt: null     },
  ]

  const metricRows = METRIC_ROWS.map(({ label, key, fmt }) => {
    if (key === null) {
      // 구분선 행 — 레이블만, 나머지 빈 셀
      return [hCell(label), ...selected.map(() => hCell(''))]
    }
    const vals = calcs.map((calc, i) => {
      if (key === '__itemCount__') return cell(selected[i].items.length)
      return cell(calc[key], fmt)
    })
    return [hCell(label), ...vals]
  })

  const metricGrid = [metricHeaders, ...metricRows]

  // ── 구성 제품 상세 섹션 ────────────────────────────────────────
  const maxItems = Math.max(...selected.map((b) => b.items.length))
  const productSectionHeader = [
    hCell('구성 제품'),
    ...selected.map((b) => hCell(b.name)),
  ]
  const productRows = Array.from({ length: maxItems }, (_, i) =>
    [
      hCell(`제품 ${i + 1}`),
      ...selected.map((b) => {
        const item = b.items[i]
        if (!item) return hCell('')
        const p = productMap[item.productId]
        return hCell(p ? `${p.name} ×${item.quantity}` : '(삭제된 제품)')
      }),
    ]
  )
  const productLineCostHeader = [
    hCell('  └ 라인 원가 (원)'),
    ...selected.map(() => hCell('')),
  ]
  const productLineCostRows = Array.from({ length: maxItems }, (_, i) =>
    [
      hCell(`  제품 ${i + 1} 원가`),
      ...selected.map((b) => {
        const item = b.items[i]
        if (!item) return cell(null)
        const p = productMap[item.productId]
        if (!p) return cell(null)
        return cell(getProductCostKRW(p, exchangeRate) * item.quantity, FMT_KRW)
      }),
    ]
  )

  // ── 시트에 기록 ───────────────────────────────────────────────
  const allSections = [
    ...titleGrid,
    ...metricGrid,
    [hCell('')],
    [hCell('▶ 구성 제품 상세')],
    productSectionHeader,
    ...productRows,
    [hCell('')],
    [hCell('▶ 구성 제품 라인 원가')],
    productLineCostHeader,
    ...productLineCostRows,
  ]

  writeGrid(ws, allSections, 0, 0)
  updateRef(ws, allSections, 0, 0)

  // ── 열 너비 ───────────────────────────────────────────────────
  ws['!cols'] = [
    { wch: 24 },                                    // 항목 레이블
    ...selected.map(() => ({ wch: 18 })),           // 번들별 값 열
  ]

  // ── 행 높이 (타이틀 강조) ─────────────────────────────────────
  ws['!rows'] = [
    { hpt: 22 },  // 타이틀 행
    { hpt: 14 },  // 부제목
    { hpt: 6  },  // 여백
    { hpt: 16 },  // 헤더
  ]

  // ── 틀 고정: 3행·1열 ──────────────────────────────────────────
  ws['!freeze'] = { xSplit: 1, ySplit: 3 + 1 }  // 항목 열 + 헤더 행까지 고정

  return ws
}

// ─── Sheet2: 제품 원가 ─────────────────────────────────────────────
function buildProductSheet(products, exchangeRate) {
  const ws = {}

  const headers = [
    hCell('제품명'),
    hCell('카테고리'),
    hCell('원가 입력방식'),
    hCell('달러 원가 ($)'),
    hCell('원화 원가 (원)'),
    hCell('정상판매가 (원)'),
    hCell('마진율 (%)'),
    hCell('단위'),
    hCell('메모'),
    hCell('활성 여부'),
  ]

  const rows = products.map((p) => {
    const costKRW = getProductCostKRW(p, exchangeRate)
    const margin = p.retailPrice > 0
      ? ((p.retailPrice - costKRW) / p.retailPrice) * 100
      : null

    return [
      hCell(p.name),
      hCell(p.category),
      hCell(p.costUSD != null ? '달러($)' : '원화(₩)'),
      p.costUSD != null ? cell(p.costUSD, FMT_USD) : hCell('-'),
      cell(costKRW, FMT_KRW),
      cell(p.retailPrice, FMT_KRW),
      margin != null ? cell(Math.round(margin * 10) / 10, FMT_PCT) : hCell('-'),
      hCell(p.unit ?? ''),
      hCell(p.memo ?? ''),
      hCell(p.isActive ? '활성' : '비활성'),
    ]
  })

  const grid = [headers, ...rows]
  writeGrid(ws, grid, 0, 0)
  updateRef(ws, grid, 0, 0)

  // 열 너비
  ws['!cols'] = [
    { wch: 22 }, // 제품명
    { wch: 12 }, // 카테고리
    { wch: 12 }, // 입력방식
    { wch: 14 }, // 달러 원가
    { wch: 16 }, // 원화 원가
    { wch: 16 }, // 정상판매가
    { wch: 12 }, // 마진율
    { wch: 8  }, // 단위
    { wch: 24 }, // 메모
    { wch: 10 }, // 활성
  ]

  // 행 높이 (헤더)
  ws['!rows'] = [{ hpt: 18 }]

  // 자동 필터 (헤더 행 전체)
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 0, c: 9 } }) }

  // 틀 고정: 헤더 1행
  ws['!freeze'] = { xSplit: 0, ySplit: 1 }

  return ws
}

// ─── 메인 export 함수 ──────────────────────────────────────────────
/**
 * 번들 비교 데이터를 xlsx 파일로 다운로드한다.
 *
 * @param {Object[]} selected   - 비교 대상 번들 배열
 * @param {Object[]} calcs      - 각 번들의 calcBundle 결과 배열
 * @param {Object[]} products   - 전체 제품 배열
 * @param {number}   exchangeRate - 현재 환율
 */
export function exportBundleCompareXlsx(selected, calcs, products, exchangeRate) {
  const wb = XLSX.utils.book_new()

  // Sheet1: 번들 비교
  const wsCompare = buildCompareSheet(selected, calcs, products, exchangeRate)
  XLSX.utils.book_append_sheet(wb, wsCompare, '번들 비교')

  // Sheet2: 제품 원가
  const wsProducts = buildProductSheet(products, exchangeRate)
  XLSX.utils.book_append_sheet(wb, wsProducts, '제품 원가')

  // 파일 다운로드
  const dateTag = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `번들비교_${dateTag}.xlsx`, {
    bookType: 'xlsx',
    compression: true,
  })
}
