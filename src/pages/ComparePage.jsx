import { useState, useMemo, useCallback } from 'react'
import {
  BarChart2, Award, FileDown, FileSpreadsheet,
  X, CheckSquare, Square, TrendingUp, TrendingDown,
  Crown, ChevronUp, ChevronDown as ChevronDownIcon, Minus,
  Package, Tag,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine, LabelList,
} from 'recharts'
import { calcBundle, getProductCostKRW } from '../utils/calculator'
import { exportBundleCompareXlsx } from '../utils/exportExcel'

// ─── 포맷 유틸 ─────────────────────────────────────────────────────
const krw = (n) => (n == null ? '-' : `₩${Math.round(n).toLocaleString('ko-KR')}`)
const pct = (n, d = 1) => (n == null ? '-' : `${Number(n).toFixed(d)}%`)
const plain = (n) => (n == null ? '-' : Math.round(n).toLocaleString('ko-KR'))

// ─── 색상 팔레트 ───────────────────────────────────────────────────
const PALETTE = [
  { border: 'border-blue-500',   bg: 'bg-blue-50',   header: 'bg-blue-500',   text: 'text-blue-700',   chart: '#2563eb' },
  { border: 'border-violet-500', bg: 'bg-violet-50', header: 'bg-violet-500', text: 'text-violet-700', chart: '#7c3aed' },
  { border: 'border-cyan-500',   bg: 'bg-cyan-50',   header: 'bg-cyan-500',   text: 'text-cyan-700',   chart: '#0891b2' },
  { border: 'border-emerald-500',bg: 'bg-emerald-50',header: 'bg-emerald-500',text: 'text-emerald-700',chart: '#059669' },
]

// ─── 이익률 색상 ───────────────────────────────────────────────────
function rateColor(rate) {
  if (rate == null) return 'text-gray-400'
  if (rate >= 25) return 'text-emerald-600'
  if (rate >= 15) return 'text-amber-500'
  return 'text-red-500'
}

// ─── 비교 지표 정의 ────────────────────────────────────────────────
// higherIsBetter: true → 값이 클수록 유리 (강조), false → 값이 작을수록 유리
const METRICS = [
  { key: 'bundleRetailPrice', label: '번들 정상가',    fmt: krw,  higherIsBetter: true,  section: 'price' },
  { key: 'salePrice',         label: '행사 판매가',    fmt: krw,  higherIsBetter: true,  section: 'price', bold: true },
  { key: 'discountRate',      label: '할인율',         fmt: pct,  higherIsBetter: false, section: 'price' },
  { key: 'discountAmount',    label: '할인액',         fmt: krw,  higherIsBetter: false, section: 'price' },
  { key: 'totalCost',         label: '총 원가',        fmt: krw,  higherIsBetter: false, section: 'profit' },
  { key: 'grossProfit',       label: '매출총이익',     fmt: krw,  higherIsBetter: true,  section: 'profit' },
  { key: 'grossMargin',       label: '매출총이익률',   fmt: pct,  higherIsBetter: true,  section: 'profit', isRate: true, bold: true },
  { key: 'contributionMargin',    label: '공헌이익',       fmt: krw,  higherIsBetter: true,  section: 'profit' },
  { key: 'contributionMarginRate',label: '공헌이익률',     fmt: pct,  higherIsBetter: true,  section: 'profit', isRate: true, bold: true },
]

const EVENT_COST_KEY = '__eventCost__'

// ─── PDF 출력 ──────────────────────────────────────────────────────
function printPDF() {
  window.print()
}

// ─── 커스텀 차트 툴팁 ─────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-sm min-w-[160px]">
      <p className="font-semibold text-gray-800 mb-2 truncate">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-gray-500">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: entry.fill }} />
            {entry.name}
          </span>
          <span className="font-bold tabular-nums" style={{ color: entry.fill }}>
            {entry.dataKey.includes('률') || entry.dataKey.includes('율')
              ? pct(entry.value)
              : krw(entry.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── 번들 선택 칩 ─────────────────────────────────────────────────
function BundleChip({ bundle, selected, color, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={!selected && disabled}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all
        ${selected
          ? `${color.border} ${color.bg} ${color.text} shadow-sm`
          : disabled
            ? 'border-gray-200 text-gray-300 cursor-not-allowed bg-gray-50'
            : 'border-gray-200 text-gray-600 hover:border-gray-400 bg-white hover:bg-gray-50'
        }`}
    >
      {selected
        ? <CheckSquare size={14} className={color.text} />
        : <Square size={14} className="text-gray-400" />}
      <span className="truncate max-w-[140px]">{bundle.name}</span>
      <span className="text-xs text-gray-400 shrink-0">{bundle.items.length}개</span>
    </button>
  )
}

// ─── 비교 카드 ────────────────────────────────────────────────────
function CompareCard({ bundle, calc, color, rank, isBest, products, exchangeRate }) {
  const productMap = Object.fromEntries(products.map((p) => [p.id, p]))

  return (
    <div className={`rounded-2xl border-2 ${color.border} overflow-hidden flex flex-col print-card`}>
      {/* 카드 헤더 */}
      <div className={`${color.header} px-4 py-3 text-white`}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium opacity-80">
            {rank === 1 ? '🥇 1위' : rank === 2 ? '🥈 2위' : rank === 3 ? '🥉 3위' : `${rank}위`}
          </span>
          {isBest && (
            <span className="flex items-center gap-1 text-xs font-semibold bg-white/20 px-2 py-0.5 rounded-full">
              <Crown size={10} />
              최고수익
            </span>
          )}
        </div>
        <h3 className="font-bold text-base leading-tight truncate">{bundle.name}</h3>
        <p className="text-xs opacity-70 mt-0.5">구성 {bundle.items.length}개 제품</p>
      </div>

      {/* 구성 제품 */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">구성 제품</p>
        <div className="space-y-1">
          {bundle.items.map((item) => {
            const p = productMap[item.productId]
            if (!p) return null
            const lineCost = getProductCostKRW(p, exchangeRate) * item.quantity
            return (
              <div key={item.productId} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`shrink-0 w-5 h-5 ${color.bg} ${color.text} rounded text-xs font-bold flex items-center justify-center border ${color.border}`}>
                    {item.quantity}
                  </span>
                  <span className="text-xs text-gray-700 truncate">{p.name}</span>
                </div>
                <span className="text-xs text-gray-400 shrink-0 tabular-nums">{krw(lineCost)}</span>
              </div>
            )
          })}
        </div>
        {bundle.eventCost > 0 && (
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Tag size={10} />
              행사 부대비용
            </span>
            <span className="text-xs font-medium text-red-500">-{krw(bundle.eventCost)}</span>
          </div>
        )}
      </div>

      {/* 지표 */}
      <div className="px-4 py-3 flex-1 space-y-1">
        {METRICS.map((m) => (
          <MetricRow
            key={m.key}
            label={m.label}
            value={m.fmt(calc[m.key])}
            rawValue={calc[m.key]}
            isRate={m.isRate}
            bold={m.bold}
          />
        ))}
      </div>
    </div>
  )
}

// ─── 지표 행 (카드 내부) ─────────────────────────────────────────
function MetricRow({ label, value, rawValue, isRate, bold, highlight }) {
  const valueClass = isRate
    ? `font-bold tabular-nums ${rateColor(rawValue)}`
    : bold
      ? 'font-semibold tabular-nums text-gray-900'
      : 'tabular-nums text-gray-700'

  return (
    <div className={`flex items-center justify-between py-1.5 px-2 rounded-lg transition-colors
      ${highlight ? 'bg-emerald-50 border border-emerald-200' : 'hover:bg-gray-50'}`}>
      <span className="text-xs text-gray-500">{label}</span>
      <div className="flex items-center gap-1">
        {highlight && <Crown size={10} className="text-emerald-600" />}
        <span className={`text-xs ${valueClass}`}>{value}</span>
      </div>
    </div>
  )
}

// ─── 비교 테이블 행 ───────────────────────────────────────────────
function TableMetricRow({ metric, calcs, bestIdx }) {
  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
      <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap font-medium">
        {metric.label}
      </td>
      {calcs.map((calc, i) => {
        const val = calc[metric.key]
        const isBest = i === bestIdx
        const colorClass = metric.isRate ? rateColor(val) : ''
        return (
          <td
            key={i}
            className={`px-4 py-2.5 text-right text-xs tabular-nums
              ${metric.bold ? 'font-bold' : 'font-medium'}
              ${colorClass || 'text-gray-800'}
              ${isBest && calcs.length > 1 ? 'bg-emerald-50' : ''}`}
          >
            <span className="flex items-center justify-end gap-1">
              {isBest && calcs.length > 1 && <Crown size={9} className="text-emerald-600 shrink-0" />}
              {metric.fmt(val)}
            </span>
          </td>
        )
      })}
    </tr>
  )
}

// ─── 메인 페이지 ──────────────────────────────────────────────────
export default function ComparePage({ bundles, products, exchangeRate, vatRate = 10, importCostRate = 0 }) {
  const MAX_SELECT = 4

  // 비교할 번들 ID 목록 (순서 유지)
  const [selectedIds, setSelectedIds] = useState(() =>
    bundles.slice(0, Math.min(bundles.length, MAX_SELECT)).map((b) => b.id)
  )

  // 선택 토글
  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= MAX_SELECT) return prev
      return [...prev, id]
    })
  }, [])

  // 선택된 번들 + 계산 결과
  const selected = useMemo(
    () => selectedIds.map((id) => bundles.find((b) => b.id === id)).filter(Boolean),
    [selectedIds, bundles]
  )

  const calcs = useMemo(
    () => selected.map((b) => calcBundle(b, products, exchangeRate, vatRate, importCostRate)),
    [selected, products, exchangeRate, vatRate, importCostRate]
  )

  // 공헌이익률 기준 순위 (인덱스 배열)
  const rankedIndices = useMemo(() => {
    return [...selected.map((_, i) => i)].sort(
      (a, b) => (calcs[b]?.contributionMarginRate ?? 0) - (calcs[a]?.contributionMarginRate ?? 0)
    )
  }, [selected, calcs])

  // 각 지표별 "베스트" 인덱스 계산
  const bestIndices = useMemo(() => {
    const result = {}
    METRICS.forEach((m) => {
      if (calcs.length === 0) { result[m.key] = -1; return }
      const values = calcs.map((c) => c[m.key] ?? (m.higherIsBetter ? -Infinity : Infinity))
      const best = m.higherIsBetter ? Math.max(...values) : Math.min(...values)
      result[m.key] = values.findIndex((v) => v === best)
    })
    return result
  }, [calcs])

  // 차트 데이터
  const chartData = useMemo(
    () =>
      selected.map((b, i) => ({
        name: b.name.length > 8 ? b.name.slice(0, 7) + '…' : b.name,
        fullName: b.name,
        공헌이익률: Math.round((calcs[i]?.contributionMarginRate ?? 0) * 10) / 10,
        매출총이익률: Math.round((calcs[i]?.grossMargin ?? 0) * 10) / 10,
        color: PALETTE[i % PALETTE.length].chart,
      })),
    [selected, calcs]
  )

  const isEmpty = bundles.length === 0
  const noneSelected = selected.length === 0

  return (
    <div className="space-y-6 print:space-y-4">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h2 className="text-xl font-bold text-gray-900">번들 비교</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            최대 {MAX_SELECT}개 번들의 수익성을 나란히 비교합니다
          </p>
        </div>
        {selected.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportBundleCompareXlsx(selected, calcs, products, exchangeRate)}
              className="flex items-center gap-1.5 border border-gray-300 text-gray-600 rounded-xl px-4 py-2 text-sm font-medium hover:bg-gray-50 transition"
            >
              <FileSpreadsheet size={15} className="text-emerald-600" />
              엑셀로 내보내기
            </button>
            <button
              onClick={printPDF}
              className="flex items-center gap-1.5 border border-gray-300 text-gray-600 rounded-xl px-4 py-2 text-sm font-medium hover:bg-gray-50 transition"
            >
              <FileDown size={15} className="text-blue-600" />
              PDF로 저장
            </button>
          </div>
        )}
      </div>

      {/* 저장 없음 */}
      {isEmpty && (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <BarChart2 size={48} className="mb-4 opacity-30" />
          <p className="text-lg font-semibold text-gray-500">저장된 번들이 없습니다</p>
          <p className="text-sm mt-1">번들 구성기에서 번들을 먼저 저장해주세요</p>
        </div>
      )}

      {!isEmpty && (
        <>
          {/* 번들 선택 영역 */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4 print:hidden">
            <div className="flex items-center gap-2 mb-3">
              <CheckSquare size={15} className="text-blue-600" />
              <h3 className="font-semibold text-gray-800 text-sm">비교할 번들 선택</h3>
              <span className="text-xs text-gray-400 ml-1">
                {selected.length}/{MAX_SELECT}개 선택됨
              </span>
              {selected.length > 0 && (
                <button
                  onClick={() => setSelectedIds([])}
                  className="ml-auto text-xs text-gray-400 hover:text-red-500 flex items-center gap-1 transition"
                >
                  <X size={11} />
                  전체 해제
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {bundles.map((b) => {
                const idx = selectedIds.indexOf(b.id)
                const isSelected = idx !== -1
                const colorIdx = isSelected ? idx : 0
                return (
                  <BundleChip
                    key={b.id}
                    bundle={b}
                    selected={isSelected}
                    color={PALETTE[colorIdx % PALETTE.length]}
                    disabled={selected.length >= MAX_SELECT}
                    onClick={() => toggleSelect(b.id)}
                  />
                )
              })}
            </div>
          </div>

          {/* 선택 없음 */}
          {noneSelected && (
            <div className="text-center py-16 text-gray-400">
              <Package size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">위에서 비교할 번들을 선택하세요</p>
            </div>
          )}

          {/* 비교 카드 영역 */}
          {!noneSelected && (
            <>
              {/* 공헌이익률 순위 배너 */}
              <div className="bg-gradient-to-r from-blue-600 to-violet-600 rounded-2xl p-4 text-white print:rounded-none">
                <div className="flex items-center gap-2 mb-3">
                  <Award size={16} />
                  <h3 className="font-bold text-sm">공헌이익률 순위</h3>
                </div>
                <div className="flex flex-wrap gap-3">
                  {rankedIndices.map((idx, rank) => {
                    const b = selected[idx]
                    const c = calcs[idx]
                    const medal = rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : `${rank + 1}.`
                    return (
                      <div key={b.id} className="flex items-center gap-2 bg-white/15 rounded-xl px-3 py-2">
                        <span className="text-base">{medal}</span>
                        <div>
                          <p className="text-xs font-semibold truncate max-w-[100px]">{b.name}</p>
                          <p className={`text-sm font-bold tabular-nums ${rateColor(c.contributionMarginRate).replace('text-', 'text-white opacity-90 ') || ''}`}>
                            {pct(c.contributionMarginRate)}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 비교 카드 그리드 */}
              <div className={`grid gap-4 ${
                selected.length === 1 ? 'grid-cols-1 max-w-sm' :
                selected.length === 2 ? 'grid-cols-2' :
                selected.length === 3 ? 'grid-cols-3' :
                'grid-cols-2 lg:grid-cols-4'
              }`}>
                {selected.map((bundle, i) => {
                  const rank = rankedIndices.indexOf(i) + 1
                  return (
                    <CompareCard
                      key={bundle.id}
                      bundle={bundle}
                      calc={calcs[i]}
                      color={PALETTE[i % PALETTE.length]}
                      rank={rank}
                      isBest={rank === 1}
                      products={products}
                      exchangeRate={exchangeRate}
                    />
                  )
                })}
              </div>

              {/* 바 차트 */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5 print:border print:rounded-none">
                <h3 className="font-semibold text-gray-800 text-sm mb-1">이익률 비교 차트</h3>
                <p className="text-xs text-gray-400 mb-4">
                  <span className="inline-block w-3 h-3 rounded-sm bg-blue-500 mr-1 align-middle" />매출총이익률
                  <span className="inline-block w-3 h-3 rounded-sm bg-violet-500 ml-3 mr-1 align-middle" />공헌이익률
                  &nbsp;— 기준선: 15% (노랑) / 25% (초록)
                </p>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={chartData}
                    margin={{ top: 20, right: 20, left: 0, bottom: 0 }}
                    barCategoryGap="35%"
                    barGap={4}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12, fill: '#6b7280', fontWeight: 500 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(v) => `${v}%`}
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      axisLine={false}
                      tickLine={false}
                      domain={[0, (dataMax) => Math.max(dataMax + 5, 35)]}
                    />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f9fafb' }} />
                    {/* 기준선: 15%, 25% */}
                    <ReferenceLine
                      y={15}
                      stroke="#f59e0b"
                      strokeDasharray="4 3"
                      strokeWidth={1.5}
                      label={{ value: '15%', position: 'insideTopRight', fontSize: 10, fill: '#f59e0b' }}
                    />
                    <ReferenceLine
                      y={25}
                      stroke="#10b981"
                      strokeDasharray="4 3"
                      strokeWidth={1.5}
                      label={{ value: '25%', position: 'insideTopRight', fontSize: 10, fill: '#10b981' }}
                    />
                    <Bar dataKey="매출총이익률" radius={[4, 4, 0, 0]} maxBarSize={50}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length].chart} fillOpacity={0.5} />
                      ))}
                      <LabelList dataKey="매출총이익률" position="top" formatter={(v) => `${v}%`} style={{ fontSize: 10, fill: '#6b7280' }} />
                    </Bar>
                    <Bar dataKey="공헌이익률" radius={[4, 4, 0, 0]} maxBarSize={50}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length].chart} />
                      ))}
                      <LabelList dataKey="공헌이익률" position="top" formatter={(v) => `${v}%`} style={{ fontSize: 11, fontWeight: 700, fill: '#374151' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* 상세 비교 테이블 */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden print:rounded-none print:border">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                  <BarChart2 size={14} className="text-blue-600" />
                  <h3 className="font-semibold text-gray-700 text-sm">상세 수익성 비교</h3>
                  <span className="text-xs text-gray-400 ml-auto flex items-center gap-1">
                    <Crown size={10} className="text-emerald-600" />
                    항목별 최고값 강조
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    {/* 헤더 */}
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide w-28">
                          항목
                        </th>
                        {selected.map((b, i) => (
                          <th key={b.id} className="text-right px-4 py-3 text-xs font-bold text-gray-700">
                            <span className="flex items-center justify-end gap-1.5">
                              <span
                                className="w-2.5 h-2.5 rounded-sm shrink-0"
                                style={{ background: PALETTE[i % PALETTE.length].chart }}
                              />
                              <span className="truncate max-w-[120px]">{b.name}</span>
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {/* 구성 제품 수 */}
                      <tr className="border-b border-gray-50 bg-gray-50/50">
                        <td className="px-4 py-2 text-xs text-gray-400 font-semibold uppercase tracking-wide" colSpan={selected.length + 1}>
                          가격 구조
                        </td>
                      </tr>
                      {METRICS.filter((m) => m.section === 'price').map((m) => (
                        <TableMetricRow
                          key={m.key}
                          metric={m}
                          calcs={calcs}
                          bestIdx={bestIndices[m.key]}
                        />
                      ))}

                      {/* 구분선 */}
                      <tr className="border-b border-gray-50 bg-gray-50/50">
                        <td className="px-4 py-2 text-xs text-gray-400 font-semibold uppercase tracking-wide" colSpan={selected.length + 1}>
                          수익성
                        </td>
                      </tr>
                      {METRICS.filter((m) => m.section === 'profit').map((m) => (
                        <TableMetricRow
                          key={m.key}
                          metric={m}
                          calcs={calcs}
                          bestIdx={bestIndices[m.key]}
                        />
                      ))}

                      {/* 행사비용 */}
                      <tr className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-2.5 text-xs text-gray-500 font-medium">행사 부대비용</td>
                        {selected.map((b, i) => {
                          const minCost = Math.min(...selected.map((x) => x.eventCost ?? 0))
                          const isBest = (b.eventCost ?? 0) === minCost && selected.length > 1
                          return (
                            <td key={b.id} className={`px-4 py-2.5 text-right text-xs tabular-nums font-medium text-gray-800 ${isBest ? 'bg-emerald-50' : ''}`}>
                              <span className="flex items-center justify-end gap-1">
                                {isBest && <Crown size={9} className="text-emerald-600" />}
                                {krw(b.eventCost ?? 0)}
                              </span>
                            </td>
                          )
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
