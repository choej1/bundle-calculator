import { useState, useRef, useMemo } from 'react'
import {
  Package, Plus, Search, Upload, Download, Pencil, Trash2,
  X, AlertTriangle, ChevronDown, LayoutGrid, List, CheckCircle2,
} from 'lucide-react'
import { getProductCostKRW } from '../utils/calculator'

// ─── 포맷 유틸 ────────────────────────────────────────────────────
const krw = (n) => (n == null ? '-' : `₩${Math.round(n).toLocaleString('ko-KR')}`)
const pct = (n) => (n == null ? '-' : `${n.toFixed(1)}%`)

function calcMargin(costKRW, retailPrice) {
  if (!retailPrice || retailPrice <= 0 || costKRW == null) return null
  return ((retailPrice - costKRW) / retailPrice) * 100
}

function marginColorClass(rate) {
  if (rate == null) return 'text-gray-400'
  if (rate >= 30) return 'text-emerald-600'
  if (rate >= 15) return 'text-blue-600'
  if (rate >= 0) return 'text-amber-600'
  return 'text-red-600'
}

function genId() {
  return 'prod_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

// ─── CSV 관련 ────────────────────────────────────────────────────
const CSV_HEADERS = ['제품명', '카테고리', '원가(원화)', '원가(달러)', '정상판매가', '단위']

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return { rows: [], errors: [] }

  const errors = []
  const rows = []

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim())
    const [name, category, costKRWRaw, costUSDRaw, retailPriceRaw, unit] = cols

    if (!name) {
      errors.push(`${i + 1}행: 제품명이 없습니다`)
      continue
    }

    const costKRW = costKRWRaw ? parseFloat(costKRWRaw) : null
    const costUSD = costUSDRaw ? parseFloat(costUSDRaw) : null
    const retailPrice = retailPriceRaw ? parseFloat(retailPriceRaw) : null

    if (costKRW == null && costUSD == null) {
      errors.push(`${i + 1}행(${name}): 원화 원가 또는 달러 원가 중 하나를 입력해야 합니다`)
    }

    rows.push({
      id: genId(),
      name: name || '',
      category: category || '미분류',
      costKRW: costKRW != null && !isNaN(costKRW) ? costKRW : null,
      costUSD: costUSD != null && !isNaN(costUSD) ? costUSD : null,
      retailPrice: retailPrice != null && !isNaN(retailPrice) ? retailPrice : 0,
      unit: unit || '개',
      memo: '',
      isActive: true,
    })
  }

  return { rows, errors }
}

function downloadSampleCsv() {
  const sample = [
    CSV_HEADERS.join(','),
    '홍삼 젤리,건강식품,8500,,19800,박스',
    '비타민C 1000mg,건강식품,,3.5,12000,병',
    '마스크팩 10매,뷰티,3200,,8900,개',
  ].join('\n')

  const blob = new Blob(['\uFEFF' + sample], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'products_sample.csv'
  a.click()
  URL.revokeObjectURL(url)
}

// ─── 제품 폼 기본값 ───────────────────────────────────────────────
const EMPTY_FORM = {
  name: '',
  category: '',
  costInputMode: 'krw', // 'krw' | 'usd'
  costKRW: '',
  costUSD: '',
  retailPrice: '',
  unit: '개',
  memo: '',
  isActive: true,
}

// ─── 제품 추가/수정 모달 ──────────────────────────────────────────
function ProductModal({ product, exchangeRate, existingCategories, onSave, onClose }) {
  const isEdit = !!product

  const [form, setForm] = useState(() => {
    if (!product) return EMPTY_FORM
    return {
      name: product.name,
      category: product.category,
      costInputMode: product.costUSD != null ? 'usd' : 'krw',
      costKRW: product.costKRW != null ? String(product.costKRW) : '',
      costUSD: product.costUSD != null ? String(product.costUSD) : '',
      retailPrice: product.retailPrice != null ? String(product.retailPrice) : '',
      unit: product.unit || '개',
      memo: product.memo || '',
      isActive: product.isActive ?? true,
    }
  })

  const [errors, setErrors] = useState({})

  // 달러 입력 시 원화 실시간 미리보기
  const usdPreview =
    form.costInputMode === 'usd' && form.costUSD
      ? Math.round(parseFloat(form.costUSD) * exchangeRate)
      : null

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  function validate() {
    const errs = {}
    if (!form.name.trim()) errs.name = '제품명을 입력해주세요'
    if (!form.category.trim()) errs.category = '카테고리를 입력해주세요'
    if (form.costInputMode === 'krw' && !form.costKRW) errs.cost = '원가를 입력해주세요'
    if (form.costInputMode === 'usd' && !form.costUSD) errs.cost = '달러 원가를 입력해주세요'
    if (!form.retailPrice) errs.retailPrice = '정상판매가를 입력해주세요'
    return errs
  }

  function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    const saved = {
      id: product?.id ?? genId(),
      name: form.name.trim(),
      category: form.category.trim(),
      costKRW: form.costInputMode === 'krw' ? parseFloat(form.costKRW) : null,
      costUSD: form.costInputMode === 'usd' ? parseFloat(form.costUSD) : null,
      retailPrice: parseFloat(form.retailPrice),
      unit: form.unit.trim() || '개',
      memo: form.memo.trim(),
      isActive: form.isActive,
    }
    onSave(saved)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-lg">
            {isEdit ? '제품 수정' : '제품 추가'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
          >
            <X size={18} />
          </button>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* 제품명 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              제품명 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="제품명을 입력하세요"
              className={`w-full border rounded-lg px-3 py-2 text-sm outline-none transition
                ${errors.name ? 'border-red-400 focus:ring-1 focus:ring-red-400' : 'border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200'}`}
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          {/* 카테고리 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              카테고리 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              list="category-list"
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
              placeholder="카테고리 입력 또는 선택"
              className={`w-full border rounded-lg px-3 py-2 text-sm outline-none transition
                ${errors.category ? 'border-red-400 focus:ring-1 focus:ring-red-400' : 'border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200'}`}
            />
            <datalist id="category-list">
              {existingCategories.map((cat) => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
            {errors.category && <p className="text-xs text-red-500 mt-1">{errors.category}</p>}
          </div>

          {/* 원가 입력 방식 토글 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              원가 <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2 mb-2">
              {[{ val: 'krw', label: '원화 (₩)' }, { val: 'usd', label: '달러 ($)' }].map(({ val, label }) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => set('costInputMode', val)}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition
                    ${form.costInputMode === val
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-blue-300'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {form.costInputMode === 'krw' ? (
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₩</span>
                <input
                  type="number"
                  value={form.costKRW}
                  onChange={(e) => set('costKRW', e.target.value)}
                  placeholder="0"
                  min="0"
                  className={`w-full border rounded-lg pl-7 pr-3 py-2 text-sm outline-none transition
                    ${errors.cost ? 'border-red-400 focus:ring-1 focus:ring-red-400' : 'border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200'}`}
                />
              </div>
            ) : (
              <div className="space-y-1">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input
                    type="number"
                    value={form.costUSD}
                    onChange={(e) => set('costUSD', e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className={`w-full border rounded-lg pl-7 pr-3 py-2 text-sm outline-none transition
                      ${errors.cost ? 'border-red-400 focus:ring-1 focus:ring-red-400' : 'border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200'}`}
                  />
                </div>
                {usdPreview != null && !isNaN(usdPreview) && (
                  <p className="text-xs text-blue-600">
                    환율 적용 → {krw(usdPreview)}
                    <span className="text-gray-400 ml-1">(₩{exchangeRate.toLocaleString()}/USD)</span>
                  </p>
                )}
              </div>
            )}
            {errors.cost && <p className="text-xs text-red-500 mt-1">{errors.cost}</p>}
          </div>

          {/* 정상판매가 / 단위 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                정상판매가 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₩</span>
                <input
                  type="number"
                  value={form.retailPrice}
                  onChange={(e) => set('retailPrice', e.target.value)}
                  placeholder="0"
                  min="0"
                  className={`w-full border rounded-lg pl-7 pr-3 py-2 text-sm outline-none transition
                    ${errors.retailPrice ? 'border-red-400 focus:ring-1 focus:ring-red-400' : 'border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200'}`}
                />
              </div>
              {errors.retailPrice && <p className="text-xs text-red-500 mt-1">{errors.retailPrice}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">단위</label>
              <input
                type="text"
                value={form.unit}
                onChange={(e) => set('unit', e.target.value)}
                placeholder="개, 박스, 병…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition"
              />
            </div>
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">메모</label>
            <textarea
              value={form.memo}
              onChange={(e) => set('memo', e.target.value)}
              placeholder="메모 (선택)"
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition resize-none"
            />
          </div>

          {/* 활성 여부 */}
          <div className="flex items-center gap-2">
            <input
              id="isActive"
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => set('isActive', e.target.checked)}
              className="w-4 h-4 accent-blue-600"
            />
            <label htmlFor="isActive" className="text-sm text-gray-700">활성 제품으로 등록</label>
          </div>

          {/* 버튼 */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-600 rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50 transition"
            >
              취소
            </button>
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 transition"
            >
              {isEdit ? '저장' : '추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── 삭제 확인 모달 ──────────────────────────────────────────────
function DeleteConfirmModal({ product, onConfirm, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="bg-red-100 p-2 rounded-full">
            <AlertTriangle size={20} className="text-red-600" />
          </div>
          <h3 className="font-bold text-gray-900">제품 삭제</h3>
        </div>
        <p className="text-sm text-gray-600 mb-5">
          <span className="font-semibold text-gray-900">"{product.name}"</span>을(를) 삭제하시겠습니까?
          <br />
          <span className="text-gray-400 text-xs">번들에서 참조 중인 경우 해당 항목도 영향을 받을 수 있습니다.</span>
        </p>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-600 rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50 transition"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-red-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-red-700 transition"
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── CSV 업로드 미리보기 모달 ─────────────────────────────────────
function CsvPreviewModal({ rows, errors, exchangeRate, onConfirm, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">CSV 업로드 미리보기</h2>
            <p className="text-xs text-gray-500 mt-0.5">{rows.length}개 제품이 파싱되었습니다</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
          >
            <X size={18} />
          </button>
        </div>

        {/* 오류 알림 */}
        {errors.length > 0 && (
          <div className="mx-6 mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 shrink-0">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={14} className="text-amber-600" />
              <span className="text-xs font-semibold text-amber-700">파싱 오류 ({errors.length}건) — 해당 행은 제외됩니다</span>
            </div>
            {errors.map((e, i) => (
              <p key={i} className="text-xs text-amber-600 ml-5">{e}</p>
            ))}
          </div>
        )}

        {/* 테이블 */}
        <div className="overflow-auto flex-1 px-6 py-4">
          {rows.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">등록 가능한 제품이 없습니다</div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  {['제품명', '카테고리', '원가(원화)', '원가(달러)', '정상판매가', '단위'].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 px-3 py-2 border-b border-gray-200">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const costKRW = getProductCostKRW(row, exchangeRate)
                  return (
                    <tr key={i} className="hover:bg-gray-50 border-b border-gray-100">
                      <td className="px-3 py-2 font-medium text-gray-900">{row.name}</td>
                      <td className="px-3 py-2 text-gray-600">{row.category}</td>
                      <td className="px-3 py-2 text-gray-600">
                        {row.costKRW != null ? krw(row.costKRW) : (
                          <span className="text-blue-600">{krw(costKRW)} <span className="text-xs text-gray-400">(환율적용)</span></span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-600">{row.costUSD != null ? `$${row.costUSD}` : '-'}</td>
                      <td className="px-3 py-2 text-gray-600">{krw(row.retailPrice)}</td>
                      <td className="px-3 py-2 text-gray-600">{row.unit}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* 버튼 */}
        <div className="flex gap-2 px-6 py-4 border-t border-gray-100 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-600 rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50 transition"
          >
            취소
          </button>
          <button
            onClick={() => onConfirm(rows)}
            disabled={rows.length === 0}
            className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
          >
            {rows.length}개 제품 저장
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── 제품 카드 ────────────────────────────────────────────────────
function ProductCard({ product, exchangeRate, importCostRate = 0, onEdit, onDelete }) {
  const costKRW = getProductCostKRW(product, exchangeRate, importCostRate)
  const margin = calcMargin(costKRW, product.retailPrice)

  return (
    <div
      onClick={() => onEdit(product)}
      className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-blue-200 transition-all duration-200 cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
          {product.category}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(product) }}
          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition p-0.5 rounded"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <h3 className="font-semibold text-gray-900 mb-3 line-clamp-2 leading-snug">{product.name}</h3>

      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between text-gray-500">
          <span>원가</span>
          <span className="font-medium text-gray-800">
            {krw(costKRW)}
            {product.costUSD != null && (
              <span className="text-xs text-gray-400 ml-1 tabular-nums">
                (${product.costUSD} × ₩{exchangeRate.toLocaleString('ko-KR')}
                {importCostRate > 0 && ` × ${(1 + importCostRate / 100).toFixed(importCostRate % 1 === 0 ? 1 : 2)}`}
                )
              </span>
            )}
          </span>
        </div>
        <div className="flex justify-between text-gray-500">
          <span>정상가</span>
          <span className="font-medium text-gray-800">{krw(product.retailPrice)}</span>
        </div>
        <div className="flex justify-between text-gray-500">
          <span>단위</span>
          <span className="text-gray-500">{product.unit}</span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
        <span className="text-xs text-gray-400">마진율</span>
        <span className={`font-bold text-sm ${marginColorClass(margin)}`}>
          {pct(margin)}
        </span>
      </div>
    </div>
  )
}

// ─── 제품 테이블 행 ───────────────────────────────────────────────
function ProductTableRow({ product, exchangeRate, importCostRate = 0, onEdit, onDelete }) {
  const costKRW = getProductCostKRW(product, exchangeRate, importCostRate)
  const margin = calcMargin(costKRW, product.retailPrice)

  return (
    <tr
      onClick={() => onEdit(product)}
      className="hover:bg-blue-50/50 cursor-pointer border-b border-gray-100 transition-colors group"
    >
      <td className="px-4 py-3">
        <div className="font-medium text-gray-900 text-sm">{product.name}</div>
        {product.memo && <div className="text-xs text-gray-400 truncate max-w-[200px]">{product.memo}</div>}
      </td>
      <td className="px-4 py-3">
        <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
          {product.category}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-700 text-right">
        {krw(costKRW)}
        {product.costUSD != null && (
          <div className="text-xs text-gray-400 tabular-nums">
            ${product.costUSD} × ₩{exchangeRate.toLocaleString('ko-KR')}
            {importCostRate > 0 && ` × ${(1 + importCostRate / 100).toFixed(importCostRate % 1 === 0 ? 1 : 2)}`}
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-gray-700 text-right">{krw(product.retailPrice)}</td>
      <td className="px-4 py-3 text-sm text-right">
        <span className={`font-semibold ${marginColorClass(margin)}`}>{pct(margin)}</span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-500 text-center">{product.unit}</td>
      <td className="px-4 py-3 text-center">
        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(product) }}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(product) }}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─── 메인 페이지 ──────────────────────────────────────────────────
export default function ProductsPage({
  products,
  exchangeRate,
  importCostRate = 0,
  addProduct,
  updateProduct,
  deleteProduct,
  setProducts,
}) {
  const [viewMode, setViewMode] = useState('card') // 'card' | 'table'
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('전체')

  // 모달 상태
  const [editTarget, setEditTarget] = useState(null) // null | product | '__new__'
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [csvPreview, setCsvPreview] = useState(null) // { rows, errors } | null
  const [toastMsg, setToastMsg] = useState('')

  const fileInputRef = useRef(null)

  // 전체 카테고리 목록
  const allCategories = useMemo(
    () => [...new Set(products.map((p) => p.category))].sort(),
    [products]
  )

  // 필터링된 제품 목록
  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase())
      const matchCat = filterCategory === '전체' || p.category === filterCategory
      return matchSearch && matchCat
    })
  }, [products, search, filterCategory])

  // 토스트 메시지
  function showToast(msg) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 2500)
  }

  // 제품 저장 (추가/수정)
  function handleSave(product) {
    const isNew = !products.find((p) => p.id === product.id)
    if (isNew) {
      addProduct(product)
      showToast('제품이 추가되었습니다')
    } else {
      updateProduct(product.id, product)
      showToast('제품이 수정되었습니다')
    }
    setEditTarget(null)
  }

  // 제품 삭제
  function handleDelete() {
    deleteProduct(deleteTarget.id)
    showToast(`"${deleteTarget.name}"이 삭제되었습니다`)
    setDeleteTarget(null)
  }

  // CSV 파일 선택
  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target.result
      const { rows, errors } = parseCsv(text)
      setCsvPreview({ rows, errors })
    }
    reader.readAsText(file, 'UTF-8')
  }

  // CSV 확인 후 저장
  function handleCsvConfirm(rows) {
    setProducts((prev) => [...prev, ...rows])
    showToast(`${rows.length}개 제품이 일괄 등록되었습니다`)
    setCsvPreview(null)
  }

  const activeCount = products.filter((p) => p.isActive).length

  return (
    <div className="space-y-5">
      {/* 페이지 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">제품 관리</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {activeCount}개 활성 · {allCategories.length}개 카테고리
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* CSV 샘플 다운로드 */}
          <button
            onClick={downloadSampleCsv}
            className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg px-3 py-2 hover:bg-gray-50 transition"
          >
            <Download size={14} />
            <span className="hidden sm:inline">샘플 CSV</span>
          </button>
          {/* CSV 업로드 */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg px-3 py-2 hover:bg-gray-50 transition"
          >
            <Upload size={14} />
            <span className="hidden sm:inline">CSV 업로드</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleFileChange}
          />
          {/* 제품 추가 */}
          <button
            onClick={() => setEditTarget('__new__')}
            className="flex items-center gap-1.5 text-sm bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700 transition font-medium"
          >
            <Plus size={15} />
            제품 추가
          </button>
        </div>
      </div>

      {/* 검색 + 필터 + 뷰 전환 */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* 검색 */}
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="제품명 검색…"
            className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* 카테고리 필터 */}
        <div className="relative">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="appearance-none border border-gray-300 rounded-lg pl-3 pr-8 py-2 text-sm bg-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition cursor-pointer"
          >
            <option value="전체">전체 카테고리</option>
            {allCategories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        {/* 뷰 모드 토글 */}
        <div className="flex border border-gray-300 rounded-lg overflow-hidden">
          {[{ mode: 'card', Icon: LayoutGrid }, { mode: 'table', Icon: List }].map(({ mode, Icon }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-2 transition ${viewMode === mode ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
            >
              <Icon size={15} />
            </button>
          ))}
        </div>
      </div>

      {/* 검색 결과 없음 */}
      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Package size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            {search || filterCategory !== '전체'
              ? '검색 결과가 없습니다'
              : '등록된 제품이 없습니다. [+ 제품 추가] 버튼을 눌러 시작하세요'}
          </p>
        </div>
      )}

      {/* 카드 뷰 */}
      {viewMode === 'card' && filtered.length > 0 && (
        <div>
          {(filterCategory === '전체' ? allCategories : [filterCategory]).map((category) => {
            const categoryProducts = filtered.filter((p) => p.category === category)
            if (categoryProducts.length === 0) return null
            return (
              <div key={category} className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Package size={14} className="text-blue-600" />
                  <h3 className="font-semibold text-gray-700 text-sm">{category}</h3>
                  <span className="text-xs text-gray-400">{categoryProducts.length}개</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {categoryProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      exchangeRate={exchangeRate}
                      importCostRate={importCostRate}
                      onEdit={setEditTarget}
                      onDelete={setDeleteTarget}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 테이블 뷰 */}
      {viewMode === 'table' && filtered.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {['제품명', '카테고리', '원가', '정상가', '마진율', '단위', ''].map((h, i) => (
                  <th
                    key={i}
                    className={`px-4 py-3 text-xs font-semibold text-gray-500 ${
                      i >= 2 && i <= 4 ? 'text-right' : i === 5 ? 'text-center' : 'text-left'
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => (
                <ProductTableRow
                  key={product.id}
                  product={product}
                  exchangeRate={exchangeRate}
                  importCostRate={importCostRate}
                  onEdit={setEditTarget}
                  onDelete={setDeleteTarget}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 제품 추가/수정 모달 */}
      {editTarget && (
        <ProductModal
          product={editTarget === '__new__' ? null : editTarget}
          exchangeRate={exchangeRate}
          existingCategories={allCategories}
          onSave={handleSave}
          onClose={() => setEditTarget(null)}
        />
      )}

      {/* 삭제 확인 모달 */}
      {deleteTarget && (
        <DeleteConfirmModal
          product={deleteTarget}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      {/* CSV 미리보기 모달 */}
      {csvPreview && (
        <CsvPreviewModal
          rows={csvPreview.rows}
          errors={csvPreview.errors}
          exchangeRate={exchangeRate}
          onConfirm={handleCsvConfirm}
          onClose={() => setCsvPreview(null)}
        />
      )}

      {/* 토스트 알림 */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-full shadow-lg animate-fade-in">
          <CheckCircle2 size={15} className="text-emerald-400" />
          {toastMsg}
        </div>
      )}
    </div>
  )
}
