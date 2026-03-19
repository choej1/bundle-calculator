import { useState, useMemo } from 'react'
import {
  Plus, Minus, Trash2, Search, X, Save, RotateCcw, BarChart2,
  ChevronDown, Package, Tag, ShoppingCart, TrendingUp, TrendingDown,
  AlertCircle, CheckCircle2, ChevronRight, Receipt,
} from 'lucide-react'
import { calcBundle, getProductCostKRW, calcCostItemExVat } from '../utils/calculator'

// ─── 포맷 유틸 ─────────────────────────────────────────────────────
const krw = (n) => (n == null ? '-' : `₩${Math.round(n).toLocaleString('ko-KR')}`)
const pct = (n, d = 1) => (n == null ? '-' : `${Number(n).toFixed(d)}%`)

function rateColor(rate) {
  if (rate == null) return 'text-gray-400'
  if (rate >= 25) return 'text-emerald-600'
  if (rate >= 15) return 'text-amber-500'
  return 'text-red-500'
}
function rateBg(rate) {
  if (rate == null) return 'bg-gray-50 border-gray-200'
  if (rate >= 25) return 'bg-emerald-50 border-emerald-200'
  if (rate >= 15) return 'bg-amber-50 border-amber-200'
  return 'bg-red-50 border-red-200'
}
function genId() {
  return 'bundle_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
}

// ─── 계산 결과 행 ──────────────────────────────────────────────────
function ResultRow({ label, value, sub, isRate, rate, isSeparator, isHighlight, isSub }) {
  if (isSeparator) return <div className="border-t border-gray-200 my-1.5" />
  const valColor = isRate ? rateColor(rate) : isHighlight ? 'text-blue-700' : isSub ? 'text-gray-400' : 'text-gray-900'
  const labelColor = isSub ? 'text-gray-400' : 'text-gray-500'
  return (
    <div className={`flex items-center justify-between py-2 px-3 rounded-lg transition-colors ${
      isHighlight ? 'bg-blue-50' : 'hover:bg-gray-50'
    }`}>
      <span className={`text-sm ${labelColor}`}>{label}</span>
      <div className="text-right">
        <span className={`text-sm font-semibold tabular-nums ${valColor}`}>{value}</span>
        {sub && <span className="text-xs text-gray-400 ml-1.5">{sub}</span>}
      </div>
    </div>
  )
}

// ─── 제품 리스트 행 (2줄 레이아웃) ────────────────────────────────
function ProductListRow({ product, exchangeRate, importCostRate = 0, addedQty, onClick }) {
  const costKRW = getProductCostKRW(product, exchangeRate, importCostRate)
  const isAdded = addedQty > 0

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-start gap-3 px-4 py-3 text-left border-b border-gray-50 last:border-0
        transition-colors group
        ${isAdded ? 'bg-blue-50 hover:bg-blue-100' : 'bg-white hover:bg-gray-50'}`}
    >
      {/* + / 수량 뱃지 */}
      <div className={`shrink-0 mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center
        text-xs font-bold transition-all
        ${isAdded
          ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
          : 'border border-gray-300 text-gray-400 group-hover:border-blue-400 group-hover:text-blue-600 group-hover:bg-blue-50'
        }`}
      >
        {isAdded ? addedQty : <Plus size={12} />}
      </div>

      {/* 제품 정보 */}
      <div className="flex-1 min-w-0">
        {/* 1줄: 제품명 + 카테고리 뱃지 */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className={`text-sm font-medium leading-snug line-clamp-2
            ${isAdded ? 'text-blue-900' : 'text-gray-900'}`}>
            {product.name}
          </p>
          <span className={`shrink-0 mt-0.5 text-xs px-2 py-0.5 rounded-md font-medium whitespace-nowrap
            ${isAdded
              ? 'bg-blue-200 text-blue-800 border border-blue-300'
              : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
            {product.category}
          </span>
        </div>
        {/* 2줄: 원가 + 정상가 */}
        <div className="flex items-center gap-3">
          <span className={`text-xs ${isAdded ? 'text-blue-600' : 'text-gray-500'}`}>
            원가&nbsp;
            <span className="font-semibold tabular-nums">
              {krw(costKRW)}
            </span>
            {product.costUSD != null && (
              <span className="text-gray-400 font-normal ml-0.5 tabular-nums">
                (${product.costUSD}
                {importCostRate > 0 && ` ×${(1 + importCostRate / 100).toFixed(importCostRate % 1 === 0 ? 1 : 2)}`}
                )
              </span>
            )}
          </span>
          <span className="text-gray-200 text-xs">|</span>
          <span className={`text-xs ${isAdded ? 'text-blue-600' : 'text-gray-500'}`}>
            정상가&nbsp;
            <span className="font-semibold tabular-nums">{krw(product.retailPrice)}</span>
          </span>
          <span className="text-gray-300 text-xs ml-auto">{product.unit}</span>
        </div>
      </div>
    </button>
  )
}

// ─── 번들 아이템 행 ────────────────────────────────────────────────
function BundleItemRow({ item, product, exchangeRate, importCostRate = 0, onQtyChange, onRemove }) {
  const costKRW = getProductCostKRW(product, exchangeRate, importCostRate)

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0 group">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {krw(costKRW)}/개 · 정상 {krw(product.retailPrice)}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onQtyChange(item.productId, item.quantity - 1)}
          className="w-6 h-6 rounded-md border border-gray-200 flex items-center justify-center
            text-gray-500 hover:border-blue-400 hover:text-blue-600 transition"
        >
          <Minus size={10} />
        </button>
        <span className="w-7 text-center text-sm font-bold text-gray-800 tabular-nums">
          {item.quantity}
        </span>
        <button
          onClick={() => onQtyChange(item.productId, item.quantity + 1)}
          className="w-6 h-6 rounded-md border border-gray-200 flex items-center justify-center
            text-gray-500 hover:border-blue-400 hover:text-blue-600 transition"
        >
          <Plus size={10} />
        </button>
      </div>
      <div className="text-right w-24 shrink-0">
        <p className="text-sm font-semibold text-gray-800 tabular-nums">
          {krw(product.retailPrice * item.quantity)}
        </p>
        <p className="text-xs text-gray-400 tabular-nums">
          원가 {krw(costKRW * item.quantity)}
        </p>
      </div>
      <button
        onClick={() => onRemove(item.productId)}
        className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-500
          transition rounded-lg hover:bg-red-50"
      >
        <Trash2 size={13} />
      </button>
    </div>
  )
}

// ─── 번들 드롭다운 ─────────────────────────────────────────────────
function BundleSelector({ bundles, editingId, onSelect, onNew }) {
  const [open, setOpen] = useState(false)
  const current = bundles.find((b) => b.id === editingId)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 border border-gray-300 rounded-xl px-3 py-2
          bg-white hover:border-blue-400 transition w-full"
      >
        <span className="flex-1 text-left text-sm text-gray-700 truncate">
          {current ? current.name : '새 번들 작성 중…'}
        </span>
        <ChevronDown size={13} className="text-gray-400 shrink-0" />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 right-0 z-30 bg-white border border-gray-200
          rounded-xl shadow-xl overflow-hidden">
          <button
            onClick={() => { onNew(); setOpen(false) }}
            className="w-full flex items-center gap-2 px-4 py-3 text-sm text-blue-600
              hover:bg-blue-50 transition font-semibold border-b border-gray-100"
          >
            <Plus size={13} /> 새 번들 만들기
          </button>
          {bundles.length === 0 && (
            <p className="px-4 py-3 text-sm text-gray-400 text-center">저장된 번들 없음</p>
          )}
          {bundles.map((b) => (
            <button
              key={b.id}
              onClick={() => { onSelect(b); setOpen(false) }}
              className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition
                ${b.id === editingId
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-gray-700 hover:bg-gray-50'}`}
            >
              <span className="truncate">{b.name}</span>
              <span className="text-xs text-gray-400 shrink-0 ml-2">{b.items.length}개</span>
            </button>
          ))}
        </div>
      )}
      {open && <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />}
    </div>
  )
}

function genCostId() {
  return 'ci_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
}

// ─── 비용 항목 행 ──────────────────────────────────────────────────
function CostItemRow({ item, salePrice, vatRate, onRemove }) {
  const exVat = calcCostItemExVat(item, salePrice, vatRate)
  const isRate = item.type === 'rate'
  const displayValue = isRate ? `${item.value}%` : `₩${Math.round(item.value).toLocaleString('ko-KR')}`
  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50 group">
      <span className={`shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded ${
        isRate ? 'bg-violet-100 text-violet-700' : 'bg-blue-50 text-blue-600'
      }`}>
        {isRate ? '정률' : '정액'}
      </span>
      <span className="flex-1 text-sm text-gray-800 truncate">{item.name}</span>
      <span className="text-sm tabular-nums text-gray-600 shrink-0">{displayValue}</span>
      {isRate && salePrice > 0 && (
        <span className="text-xs tabular-nums text-gray-400 shrink-0">
          → ₩{exVat.toLocaleString('ko-KR')}
        </span>
      )}
      {item.vatIncluded && !isRate && (
        <span className="text-xs text-gray-400 shrink-0">
          → ₩{exVat.toLocaleString('ko-KR')}
        </span>
      )}
      <button
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-500 transition rounded"
      >
        <X size={12} />
      </button>
    </div>
  )
}

// ─── 비용 추가 패널 ────────────────────────────────────────────────
function CostAddPanel({ presets, salePrice, vatRate, onAdd, onClose }) {
  const [tab, setTab] = useState('preset') // 'preset' | 'custom'
  const [form, setForm] = useState({ name: '', type: 'fixed', value: '', vatIncluded: false, memo: '' })

  function handleAddPreset(p) {
    onAdd({ ...p, id: genCostId() })
  }

  function handleAddCustom() {
    if (!form.name.trim() || !form.value) return
    onAdd({
      id: genCostId(),
      name: form.name.trim(),
      type: form.type,
      value: parseFloat(form.value),
      vatIncluded: form.vatIncluded,
      memo: form.memo,
    })
    setForm({ name: '', type: 'fixed', value: '', vatIncluded: false, memo: '' })
  }

  return (
    <div className="border border-blue-200 rounded-xl bg-blue-50/50 overflow-hidden mb-3">
      {/* 탭 */}
      <div className="flex border-b border-blue-200">
        {[
          { key: 'preset', label: '프리셋 선택' },
          { key: 'custom', label: '직접 입력' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-2 text-xs font-semibold transition ${
              tab === key
                ? 'bg-white text-blue-700 border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {label}
          </button>
        ))}
        <button onClick={onClose} className="px-3 text-gray-400 hover:text-gray-600">
          <X size={13} />
        </button>
      </div>

      {/* 프리셋 목록 */}
      {tab === 'preset' && (
        <div className="p-2 space-y-1 max-h-48 overflow-y-auto">
          {presets.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">
              설정 → 비용 프리셋에서 먼저 항목을 등록하세요
            </p>
          )}
          {presets.map((p) => {
            const isRate = p.type === 'rate'
            const exVat = calcCostItemExVat(p, salePrice, vatRate)
            return (
              <button
                key={p.id}
                onClick={() => handleAddPreset(p)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200
                  hover:border-blue-400 hover:bg-blue-50 transition text-left"
              >
                <span className={`shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded ${
                  isRate ? 'bg-violet-100 text-violet-700' : 'bg-blue-50 text-blue-600'
                }`}>
                  {isRate ? '정률' : '정액'}
                </span>
                <span className="flex-1 text-sm text-gray-800">{p.name}</span>
                <span className="text-sm tabular-nums text-gray-600 shrink-0">
                  {isRate ? `${p.value}%` : `₩${p.value.toLocaleString('ko-KR')}`}
                </span>
                {(isRate && salePrice > 0) || (p.vatIncluded && !isRate) ? (
                  <span className="text-xs text-gray-400 tabular-nums shrink-0">
                    → ₩{exVat.toLocaleString('ko-KR')}
                  </span>
                ) : null}
                <Plus size={13} className="text-blue-500 shrink-0 ml-1" />
              </button>
            )
          })}
        </div>
      )}

      {/* 직접 입력 */}
      {tab === 'custom' && (
        <div className="p-3 space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="비용명"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm outline-none
                focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
            />
            <div className="flex border border-gray-300 rounded-lg overflow-hidden">
              {[{ v: 'fixed', l: '정액' }, { v: 'rate', l: '정률' }].map(({ v, l }) => (
                <button
                  key={v}
                  onClick={() => setForm((p) => ({ ...p, type: v }))}
                  className={`px-3 py-1.5 text-xs font-medium transition ${
                    form.type === v ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                {form.type === 'fixed' ? '₩' : '%'}
              </span>
              <input
                type="number"
                placeholder={form.type === 'fixed' ? '금액' : '비율'}
                value={form.value}
                onChange={(e) => setForm((p) => ({ ...p, value: e.target.value }))}
                min="0"
                className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-1.5 text-sm outline-none
                  focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
              />
            </div>
            {form.type === 'fixed' && (
              <label className="flex items-center gap-1.5 text-xs text-gray-600 shrink-0 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.vatIncluded}
                  onChange={(e) => setForm((p) => ({ ...p, vatIncluded: e.target.checked }))}
                  className="rounded"
                />
                VAT포함
              </label>
            )}
            <button
              onClick={handleAddCustom}
              disabled={!form.name.trim() || !form.value}
              className="shrink-0 flex items-center gap-1 bg-blue-600 text-white rounded-lg px-3 py-1.5
                text-xs font-semibold disabled:opacity-40 hover:bg-blue-700 transition"
            >
              <Plus size={12} /> 추가
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 빈 번들 상태 ─────────────────────────────────────────────────
const EMPTY_BUNDLE = {
  editingId: null, name: '', items: [],
  costItems: [], discountMode: 'rate', discountRate: '', discountPrice: '',
}

// 패널 높이: 헤더(100px) + 페이지헤더(64px) + 여백(76px) = 240px
const PANEL_H = 'calc(100vh - 240px)'
const PANEL_MIN = 480

// ─── 메인 페이지 ──────────────────────────────────────────────────
export default function BundleBuilderPage({
  bundles, products, exchangeRate, vatRate = 10, importCostRate = 0, costPresets = [],
  addBundle, updateBundle, deleteBundle, onNavigate,
}) {
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('전체')
  const [bundle, setBundle] = useState(EMPTY_BUNDLE)
  const [toast, setToast] = useState('')
  const [showCostPanel, setShowCostPanel] = useState(false)

  // 카테고리 목록 + 카운트
  const { categories, categoryCounts } = useMemo(() => {
    const active = products.filter((p) => p.isActive)
    const counts = {}
    active.forEach((p) => { counts[p.category] = (counts[p.category] || 0) + 1 })
    counts.__total__ = active.length
    return {
      categories: ['전체', ...new Set(active.map((p) => p.category))],
      categoryCounts: counts,
    }
  }, [products])

  // 필터링 (제품명 + 카테고리 동시 검색)
  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase()
    return products
      .filter((p) => p.isActive)
      .filter((p) => filterCat === '전체' || p.category === filterCat)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
  }, [products, filterCat, search])

  // 번들에 추가된 수량 맵
  const addedQtyMap = useMemo(
    () => Object.fromEntries(bundle.items.map((i) => [i.productId, i.quantity])),
    [bundle.items]
  )

  // 계산
  const calcInput = useMemo(() => ({
    items: bundle.items,
    costItems: bundle.costItems,
    discountRate: bundle.discountMode === 'rate' ? (parseFloat(bundle.discountRate) || null) : null,
    discountPrice: bundle.discountMode === 'price' ? (parseFloat(bundle.discountPrice) || null) : null,
  }), [bundle])

  const calc = useMemo(
    () => calcBundle(calcInput, products, exchangeRate, vatRate, importCostRate),
    [calcInput, products, exchangeRate, vatRate, importCostRate]
  )

  const productMap = useMemo(
    () => Object.fromEntries(products.map((p) => [p.id, p])),
    [products]
  )

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  function handleAddProduct(product) {
    setBundle((prev) => {
      const exists = prev.items.find((i) => i.productId === product.id)
      if (exists) {
        return {
          ...prev,
          items: prev.items.map((i) =>
            i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i
          ),
        }
      }
      return { ...prev, items: [...prev.items, { productId: product.id, quantity: 1 }] }
    })
  }

  function handleQtyChange(productId, qty) {
    if (qty < 1) { handleRemove(productId); return }
    setBundle((prev) => ({
      ...prev,
      items: prev.items.map((i) => i.productId === productId ? { ...i, quantity: qty } : i),
    }))
  }

  function handleRemove(productId) {
    setBundle((prev) => ({
      ...prev,
      items: prev.items.filter((i) => i.productId !== productId),
    }))
  }

  function handleSelectBundle(b) {
    // 하위호환: 구 eventCost 필드 → costItems 변환
    let costItems = b.costItems ? b.costItems.map((i) => ({ ...i })) : []
    if (costItems.length === 0 && b.eventCost) {
      costItems = [{
        id: genCostId(), name: '행사 부대비용', type: 'fixed',
        value: b.eventCost, vatIncluded: false, memo: '기존 데이터에서 변환',
      }]
    }
    setBundle({
      editingId: b.id, name: b.name,
      items: b.items.map((i) => ({ ...i })),
      costItems,
      discountMode: b.discountRate != null ? 'rate' : 'price',
      discountRate: b.discountRate != null ? String(b.discountRate) : '',
      discountPrice: b.discountPrice != null ? String(b.discountPrice) : '',
    })
    setShowCostPanel(false)
  }

  function handleNewBundle() { setBundle(EMPTY_BUNDLE); setShowCostPanel(false) }
  function handleReset() { setBundle(EMPTY_BUNDLE); setShowCostPanel(false); showToast('초기화되었습니다') }

  function handleAddCostItem(item) {
    setBundle((prev) => ({ ...prev, costItems: [...prev.costItems, item] }))
    setShowCostPanel(false)
  }

  function handleRemoveCostItem(id) {
    setBundle((prev) => ({ ...prev, costItems: prev.costItems.filter((c) => c.id !== id) }))
  }

  function handleSave() {
    if (!bundle.name.trim()) { showToast('번들명을 입력해주세요'); return }
    if (bundle.items.length === 0) { showToast('제품을 1개 이상 추가해주세요'); return }
    const data = {
      id: bundle.editingId ?? genId(),
      name: bundle.name.trim(),
      items: bundle.items,
      costItems: bundle.costItems,
      discountRate: bundle.discountMode === 'rate' ? (parseFloat(bundle.discountRate) || null) : null,
      discountPrice: bundle.discountMode === 'price' ? (parseFloat(bundle.discountPrice) || null) : null,
      memo: '',
    }
    if (bundle.editingId) {
      updateBundle(bundle.editingId, data)
      showToast('번들이 수정되었습니다')
    } else {
      addBundle(data)
      setBundle((prev) => ({ ...prev, editingId: data.id }))
      showToast('번들이 저장되었습니다')
    }
  }

  function handleAddToCompare() {
    handleSave()
    setTimeout(() => onNavigate('compare'), 100)
  }

  const hasItems = bundle.items.length > 0

  return (
    <div className="flex flex-col gap-4">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">번들 구성기</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            제품을 선택해 번들을 구성하고 수익성을 실시간으로 확인하세요
          </p>
        </div>
        <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-full">
          기준환율 ₩{exchangeRate.toLocaleString('ko-KR')}/USD
        </span>
      </div>

      {/* ── 2컬럼 레이아웃: 제품선택 40% | 번들구성 60% ─── */}
      <div className="flex gap-4" style={{ height: PANEL_H, minHeight: PANEL_MIN }}>

        {/* ════════════════════════════════════════════════
            왼쪽: 제품 선택 영역 (40%)
            ─ 검색  [고정]
            ─ 카테고리 칩  [고정, wrap]
            ─ 제품 목록  [스크롤]
        ════════════════════════════════════════════════ */}
        <div className="bg-white rounded-2xl border border-gray-200 flex flex-col overflow-hidden"
             style={{ width: '40%' }}>

          {/* 검색바 — 항상 상단 고정 */}
          <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Package size={14} className="text-blue-600" />
                <span className="text-sm font-semibold text-gray-800">제품 선택</span>
              </div>
              <span className="text-xs text-gray-400 tabular-nums">
                {filteredProducts.length}개
                {(search || filterCat !== '전체') && (
                  <span className="text-blue-500 ml-1">필터 적용</span>
                )}
              </span>
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="제품명 또는 카테고리 검색…"
                className="w-full text-sm border border-gray-200 rounded-xl pl-9 pr-9 py-2
                  outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* 카테고리 칩 — 고정, wrap (스크롤 없음) */}
          <div className="px-4 py-3 border-b border-gray-100 shrink-0">
            <div className="flex flex-wrap" style={{ gap: '6px 8px' }}>
              {categories.map((cat) => {
                const count = cat === '전체'
                  ? categoryCounts.__total__
                  : (categoryCounts[cat] ?? 0)
                const isActive = filterCat === cat
                return (
                  <button
                    key={cat}
                    onClick={() => setFilterCat(cat)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs
                      font-medium transition-all border
                      ${isActive
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-200'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'
                      }`}
                  >
                    {cat}
                    <span className={`tabular-nums font-bold px-1.5 py-0.5 rounded-md text-[10px]
                      ${isActive ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-500'}`}>
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 제품 목록 — 스크롤 가능 */}
          <div className="flex-1 overflow-y-auto">
            {filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-16 text-gray-400">
                <Package size={32} className="mb-3 opacity-30" />
                <p className="text-sm font-medium text-gray-500 mb-1">
                  {search ? `"${search}" 검색 결과 없음` : '해당 카테고리에 제품이 없습니다'}
                </p>
                {(search || filterCat !== '전체') && (
                  <button
                    onClick={() => { setSearch(''); setFilterCat('전체') }}
                    className="mt-2 text-xs text-blue-500 hover:underline"
                  >
                    필터 초기화
                  </button>
                )}
              </div>
            ) : (
              filteredProducts.map((product) => (
                <ProductListRow
                  key={product.id}
                  product={product}
                  exchangeRate={exchangeRate}
                  importCostRate={importCostRate}
                  addedQty={addedQtyMap[product.id] ?? 0}
                  onClick={() => handleAddProduct(product)}
                />
              ))
            )}
          </div>

          {/* 하단 요약 — 제품 추가 시 표시 */}
          {hasItems && (
            <div className="px-4 py-2.5 border-t border-blue-100 bg-blue-50 shrink-0
              flex items-center justify-between">
              <span className="text-xs text-blue-700 font-semibold">
                {bundle.items.length}개 제품 추가됨
              </span>
              <span className="text-xs text-blue-500 tabular-nums">
                정상가 합계 {krw(calc.bundleRetailPrice)}
              </span>
            </div>
          )}
        </div>

        {/* ════════════════════════════════════════════════
            오른쪽: 번들 구성 + 계산 영역 (60%)
        ════════════════════════════════════════════════ */}
        <div className="flex-1 min-w-0 overflow-y-auto flex flex-col gap-4">

          {/* 번들명 + 불러오기 */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <ShoppingCart size={15} className="text-blue-600" />
              <h3 className="font-bold text-gray-800 text-sm">번들 구성</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">번들명</label>
                <input
                  type="text"
                  value={bundle.name}
                  onChange={(e) => setBundle((p) => ({ ...p, name: e.target.value }))}
                  placeholder="번들명을 입력하세요"
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm
                    outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">기존 번들 불러오기</label>
                <BundleSelector
                  bundles={bundles}
                  editingId={bundle.editingId}
                  onSelect={handleSelectBundle}
                  onNew={handleNewBundle}
                />
              </div>
            </div>
          </div>

          {/* 구성 제품 목록 */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                <Tag size={14} className="text-blue-600" />
                구성 제품
                {hasItems && (
                  <span className="text-xs font-semibold text-blue-600 bg-blue-50
                    border border-blue-200 px-2 py-0.5 rounded-full">
                    {bundle.items.length}개
                  </span>
                )}
              </h3>
              {hasItems && (
                <span className="text-sm text-gray-500">
                  합계&nbsp;
                  <span className="font-semibold text-gray-800">{krw(calc.bundleRetailPrice)}</span>
                </span>
              )}
            </div>

            {!hasItems ? (
              <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl">
                <ShoppingCart size={28} className="mx-auto mb-2 text-gray-300" />
                <p className="text-sm text-gray-400">왼쪽에서 제품을 클릭해 추가하세요</p>
              </div>
            ) : (
              <div>
                {bundle.items.map((item) => {
                  const product = productMap[item.productId]
                  if (!product) return null
                  return (
                    <BundleItemRow
                      key={item.productId}
                      item={item}
                      product={product}
                      exchangeRate={exchangeRate}
                      importCostRate={importCostRate}
                      onQtyChange={handleQtyChange}
                      onRemove={handleRemove}
                    />
                  )
                })}
              </div>
            )}

            {/* 비용 항목 */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                  <Receipt size={13} className="text-gray-400" />
                  행사 비용
                  {bundle.costItems.length > 0 && (
                    <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">
                      {bundle.costItems.length}개
                    </span>
                  )}
                </label>
                <button
                  onClick={() => setShowCostPanel((v) => !v)}
                  className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition ${
                    showCostPanel
                      ? 'bg-blue-600 text-white'
                      : 'border border-blue-300 text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  <Plus size={11} /> 비용 추가
                </button>
              </div>

              {showCostPanel && (
                <CostAddPanel
                  presets={costPresets}
                  salePrice={calc.salePrice}
                  vatRate={vatRate}
                  onAdd={handleAddCostItem}
                  onClose={() => setShowCostPanel(false)}
                />
              )}

              {bundle.costItems.length === 0 ? (
                <p className="text-xs text-gray-400 py-2">비용 항목이 없습니다</p>
              ) : (
                <>
                  <div className="space-y-0.5">
                    {bundle.costItems.map((item) => (
                      <CostItemRow
                        key={item.id}
                        item={item}
                        salePrice={calc.salePrice}
                        vatRate={vatRate}
                        onRemove={() => handleRemoveCostItem(item.id)}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100 px-2">
                    <span className="text-xs text-gray-500">비용 합계 (VAT제외)</span>
                    <span className="text-sm font-bold text-gray-800 tabular-nums">
                      ₩{calc.totalEventCostExVat.toLocaleString('ko-KR')}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 할인 설정 */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center gap-3 mb-4">
              <h3 className="font-bold text-gray-800 text-sm">행사 판매가 설정</h3>
              <div className="flex border border-gray-200 rounded-xl overflow-hidden ml-auto">
                {[
                  { mode: 'rate',  label: '할인율 입력' },
                  { mode: 'price', label: '판매가 직접 입력' },
                ].map(({ mode, label }) => (
                  <button
                    key={mode}
                    onClick={() => setBundle((p) => ({ ...p, discountMode: mode }))}
                    className={`px-3 py-1.5 text-xs font-medium transition
                      ${bundle.discountMode === mode
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {bundle.discountMode === 'rate' ? (
              <div className="flex items-center gap-3">
                <div className="relative w-32">
                  <input
                    type="number"
                    value={bundle.discountRate}
                    onChange={(e) => setBundle((p) => ({ ...p, discountRate: e.target.value }))}
                    placeholder="0"
                    min="0" max="100" step="0.1"
                    className="w-full border border-gray-300 rounded-xl px-3 pr-8 py-2.5 text-sm
                      outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">%</span>
                </div>
                {bundle.discountRate && calc.salePrice > 0 ? (
                  <span className="text-sm text-gray-500">
                    → 판매가&nbsp;
                    <span className="font-semibold text-blue-700">{krw(calc.salePrice)}</span>
                    <span className="text-gray-400 ml-1.5">({krw(calc.discountAmount)} 할인)</span>
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">비어있으면 할인 없음으로 계산</span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="relative w-44">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₩</span>
                  <input
                    type="number"
                    value={bundle.discountPrice}
                    onChange={(e) => setBundle((p) => ({ ...p, discountPrice: e.target.value }))}
                    placeholder="0"
                    min="0"
                    className="w-full border border-gray-300 rounded-xl pl-7 pr-3 py-2.5 text-sm
                      outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition"
                  />
                </div>
                {bundle.discountPrice && calc.discountRate != null ? (
                  <span className="text-sm text-gray-500">
                    → 할인율&nbsp;
                    <span className="font-semibold text-blue-700">{pct(calc.discountRate)}</span>
                    <span className="text-gray-400 ml-1.5">({krw(calc.discountAmount)} 할인)</span>
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">비어있으면 할인 없음으로 계산</span>
                )}
              </div>
            )}
          </div>

          {/* 계산 결과 카드 */}
          <div className={`bg-white rounded-2xl border-2 p-5 transition-colors ${
            hasItems ? rateBg(calc.contributionMarginRate) : 'border-gray-200'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                {calc.contributionMarginRate >= 25
                  ? <TrendingUp size={15} className="text-emerald-600" />
                  : calc.contributionMarginRate >= 15
                    ? <TrendingUp size={15} className="text-amber-500" />
                    : <TrendingDown size={15} className="text-red-500" />
                }
                계산 결과
              </h3>
              {hasItems && (
                <span className={`text-sm font-bold px-3 py-1 rounded-full ${
                  calc.contributionMarginRate >= 25
                    ? 'bg-emerald-100 text-emerald-700'
                    : calc.contributionMarginRate >= 15
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-red-100 text-red-700'
                }`}>
                  공헌이익률 {pct(calc.contributionMarginRate)}
                </span>
              )}
            </div>

            {!hasItems ? (
              <div className="text-center py-8 text-gray-300 text-sm">
                제품을 추가하면 결과가 표시됩니다
              </div>
            ) : (
              <div className="bg-white/80 rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-1 py-1">
                  <ResultRow label="번들 정상가 (VAT포함)"  value={krw(calc.bundleRetailPrice)} />
                  <ResultRow label="행사 판매가 (VAT포함)"  value={krw(calc.salePrice)} isHighlight />
                  <ResultRow label="└ VAT 제외 환산"        value={krw(calc.salePriceExVat)} isSub />
                  <ResultRow label="할인율"                 value={pct(calc.discountRate)} />
                  <ResultRow label="할인액"                 value={krw(calc.discountAmount)} />
                </div>
                <ResultRow isSeparator />
                <div className="px-1 py-1">
                  <ResultRow label="총 원가 (VAT제외)"  value={krw(calc.totalCost)} />
                  {calc.totalEventCostExVat > 0 && (
                    <ResultRow
                      label={`총 비용 (VAT제외)${bundle.costItems.length > 1 ? ` ×${bundle.costItems.length}` : ''}`}
                      value={krw(calc.totalEventCostExVat)}
                    />
                  )}
                </div>
                <ResultRow isSeparator />
                <div className="px-1 py-1">
                  <ResultRow
                    label="매출총이익"
                    value={krw(calc.grossProfit)}
                  />
                  <ResultRow
                    label="매출총이익률"
                    value={pct(calc.grossMargin)}
                    isRate rate={calc.grossMargin}
                  />
                  <ResultRow
                    label="공헌이익"
                    value={krw(calc.contributionMargin)}
                  />
                  <ResultRow
                    label="공헌이익률"
                    value={pct(calc.contributionMarginRate)}
                    isRate rate={calc.contributionMarginRate}
                  />
                </div>
                {hasItems && calc.contributionMarginRate < 15 && (
                  <div className="mx-3 mb-3 flex items-center gap-2 text-sm text-red-600
                    bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                    <AlertCircle size={13} />
                    공헌이익률 15% 미만 — 수익성을 재검토하세요
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 하단 액션 버튼 */}
          <div className="flex gap-2 pb-3">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 border border-gray-300 text-gray-600
                rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-gray-50 transition"
            >
              <RotateCcw size={14} />
              초기화
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 bg-blue-600 text-white rounded-xl
                px-5 py-2.5 text-sm font-semibold hover:bg-blue-700 transition flex-1 justify-center"
            >
              <Save size={14} />
              {bundle.editingId ? '번들 수정 저장' : '번들 저장'}
            </button>
            <button
              onClick={handleAddToCompare}
              className="flex items-center gap-2 bg-gray-900 text-white rounded-xl
                px-4 py-2.5 text-sm font-medium hover:bg-gray-700 transition"
            >
              <BarChart2 size={14} />
              비교에 추가
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* 토스트 */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2
          bg-gray-900 text-white text-sm px-4 py-2.5 rounded-full shadow-lg animate-fade-in">
          <CheckCircle2 size={15} className="text-emerald-400" />
          {toast}
        </div>
      )}
    </div>
  )
}
