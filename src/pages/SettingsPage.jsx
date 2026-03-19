import { useState, useMemo } from 'react'
import {
  Settings, DollarSign, RefreshCw, CheckCircle, AlertCircle,
  History, TrendingUp, TrendingDown, Minus, ChevronDown,
  ArrowRight, Package, BarChart2, Clock, Zap, Receipt,
  Plus, Trash2, Edit2, X, Check,
} from 'lucide-react'
import { DEFAULT_EXCHANGE_RATE } from '../data/sampleData'
import { calcBundle, getProductCostKRW } from '../utils/calculator'

// ─── 포맷 유틸 ─────────────────────────────────────────────────────
const krw = (n) => (n == null ? '-' : `₩${Math.round(n).toLocaleString('ko-KR')}`)
const pct = (n, d = 1) => (n == null ? '-' : `${Number(n).toFixed(d)}%`)

function rateColor(rate) {
  if (rate == null) return 'text-gray-400'
  if (rate >= 25) return 'text-emerald-600'
  if (rate >= 15) return 'text-amber-500'
  return 'text-red-500'
}

function rateIcon(rate) {
  if (rate >= 25) return <TrendingUp size={13} className="text-emerald-500" />
  if (rate >= 15) return <Minus size={13} className="text-amber-500" />
  return <TrendingDown size={13} className="text-red-500" />
}

function formatDateTime(iso) {
  if (!iso) return null
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// 시나리오 정의
const SCENARIOS = [
  { key: 'minus5', label: '-5%', multiplier: 0.95, color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  { key: 'current', label: '현재',  multiplier: 1.00, color: 'text-gray-700',  bg: 'bg-white',     border: 'border-gray-300' },
  { key: 'plus5',  label: '+5%',  multiplier: 1.05, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
]

// 시나리오 테이블에 표시할 지표
const SCENARIO_METRICS = [
  { key: 'totalCost',              label: '총 원가',        fmt: krw,  higherIsBetter: false },
  { key: 'salePrice',              label: '행사 판매가',    fmt: krw,  higherIsBetter: true  },
  { key: 'grossProfit',            label: '매출총이익',     fmt: krw,  higherIsBetter: true  },
  { key: 'grossMargin',            label: '매출총이익률',   fmt: pct,  higherIsBetter: true,  isRate: true },
  { key: 'contributionMargin',     label: '공헌이익',       fmt: krw,  higherIsBetter: true  },
  { key: 'contributionMarginRate', label: '공헌이익률',     fmt: pct,  higherIsBetter: true,  isRate: true },
]

// ─── 섹션 헤더 ────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, iconColor = 'text-blue-600' }) {
  return (
    <div className={`flex items-center gap-2 px-5 py-3.5 border-b border-gray-100 bg-gray-50`}>
      <Icon size={15} className={iconColor} />
      <h3 className="font-semibold text-gray-700 text-sm">{title}</h3>
    </div>
  )
}

function genPresetId() {
  return 'preset_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
}

// ─── 메인 페이지 ──────────────────────────────────────────────────
export default function SettingsPage({
  settings,
  updateSettings,
  resetToSample,
  products,
  bundles,
  costPresets = [],
  addCostPreset,
  updateCostPreset,
  deleteCostPreset,
}) {
  const { exchangeRate, vatRate = 10, importCostRate = 0 } = settings
  const rateHistory = settings.rateHistory ?? []
  const rateUpdatedAt = settings.rateUpdatedAt ?? null

  const [rateInput, setRateInput] = useState(String(exchangeRate))
  const [saveStatus, setSaveStatus] = useState('idle') // 'idle' | 'saved' | 'error'
  const [errorMsg, setErrorMsg] = useState('')

  const [vatInput, setVatInput] = useState(String(vatRate))
  const [vatSaveStatus, setVatSaveStatus] = useState('idle') // 'idle' | 'saved' | 'error'
  const [vatErrorMsg, setVatErrorMsg] = useState('')

  const [importCostRateInput, setImportCostRateInput] = useState(String(importCostRate))
  const [importSaveStatus, setImportSaveStatus] = useState('idle')
  const [importErrorMsg, setImportErrorMsg] = useState('')

  // 설정 탭
  const [settingsTab, setSettingsTab] = useState('main') // 'main' | 'presets'

  // 프리셋 편집 상태
  const [editingPresetId, setEditingPresetId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [newForm, setNewForm] = useState({ name: '', type: 'fixed', value: '', vatIncluded: false, memo: '' })
  const [showNewForm, setShowNewForm] = useState(false)

  // 시나리오 비교용 선택 번들
  const [scenarioBundleId, setScenarioBundleId] = useState(
    bundles.length > 0 ? bundles[0].id : ''
  )

  // ── 환율 저장 ──────────────────────────────────────────────────
  function handleSaveRate() {
    const num = Number(rateInput)
    if (!rateInput || isNaN(num) || num <= 0) {
      setErrorMsg('유효한 환율을 입력해주세요 (0 초과)')
      setSaveStatus('error')
      return
    }
    if (num < 100 || num > 5000) {
      setErrorMsg('환율은 100 ~ 5,000 범위로 입력하세요')
      setSaveStatus('error')
      return
    }

    const now = new Date().toISOString()
    const newHistory = [
      { rate: num, savedAt: now },
      ...rateHistory.filter((h) => h.rate !== num),
    ].slice(0, 5)

    setErrorMsg('')
    updateSettings({ exchangeRate: num, rateHistory: newHistory, rateUpdatedAt: now })
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 2500)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleSaveRate()
  }

  // 환율 이력에서 클릭하면 바로 적용
  function handleHistoryClick(rate) {
    setRateInput(String(rate))
    setErrorMsg('')
    setSaveStatus('idle')
  }

  // ── 수입 비용율 저장 ──────────────────────────────────────────
  function handleSaveImportCostRate() {
    const num = Number(importCostRateInput)
    if (importCostRateInput === '' || isNaN(num) || num < 0) {
      setImportErrorMsg('유효한 비율을 입력해주세요 (0 이상)')
      setImportSaveStatus('error')
      return
    }
    if (num > 100) {
      setImportErrorMsg('수입 비용율은 0 ~ 100% 범위로 입력하세요')
      setImportSaveStatus('error')
      return
    }
    setImportErrorMsg('')
    updateSettings({ importCostRate: num })
    setImportSaveStatus('saved')
    setTimeout(() => setImportSaveStatus('idle'), 2500)
  }

  function handleImportKeyDown(e) {
    if (e.key === 'Enter') handleSaveImportCostRate()
  }

  // ── VAT율 저장 ─────────────────────────────────────────────────
  function handleSaveVat() {
    const num = Number(vatInput)
    if (!vatInput || isNaN(num) || num < 0) {
      setVatErrorMsg('유효한 VAT율을 입력해주세요 (0 이상)')
      setVatSaveStatus('error')
      return
    }
    if (num > 100) {
      setVatErrorMsg('VAT율은 0 ~ 100% 범위로 입력하세요')
      setVatSaveStatus('error')
      return
    }

    setVatErrorMsg('')
    updateSettings({ vatRate: num })
    setVatSaveStatus('saved')
    setTimeout(() => setVatSaveStatus('idle'), 2500)
  }

  function handleVatKeyDown(e) {
    if (e.key === 'Enter') handleSaveVat()
  }

  // ── 프리셋 관리 ───────────────────────────────────────────────
  function handleStartEdit(p) {
    setEditingPresetId(p.id)
    setEditForm({ name: p.name, type: p.type, value: String(p.value), vatIncluded: p.vatIncluded, memo: p.memo })
  }

  function handleSaveEdit(id) {
    if (!editForm.name.trim() || !editForm.value) return
    updateCostPreset(id, {
      name: editForm.name.trim(),
      type: editForm.type,
      value: parseFloat(editForm.value),
      vatIncluded: editForm.vatIncluded,
      memo: editForm.memo,
    })
    setEditingPresetId(null)
  }

  function handleDeletePreset(id) {
    if (window.confirm('이 프리셋을 삭제하시겠습니까?')) {
      deleteCostPreset(id)
    }
  }

  function handleAddNewPreset() {
    if (!newForm.name.trim() || !newForm.value) return
    addCostPreset({
      id: genPresetId(),
      name: newForm.name.trim(),
      type: newForm.type,
      value: parseFloat(newForm.value),
      vatIncluded: newForm.vatIncluded,
      memo: newForm.memo,
    })
    setNewForm({ name: '', type: 'fixed', value: '', vatIncluded: false, memo: '' })
    setShowNewForm(false)
  }

  // ── 달러 원가 제품 목록 ────────────────────────────────────────
  const usdProducts = useMemo(
    () => products.filter((p) => p.costUSD != null),
    [products]
  )

  // ── 시나리오 계산 ──────────────────────────────────────────────
  const scenarioBundle = useMemo(
    () => bundles.find((b) => b.id === scenarioBundleId) ?? null,
    [bundles, scenarioBundleId]
  )

  const scenarioResults = useMemo(() => {
    if (!scenarioBundle) return []
    return SCENARIOS.map((s) => ({
      ...s,
      rate: Math.round(exchangeRate * s.multiplier),
      calc: calcBundle(scenarioBundle, products, Math.round(exchangeRate * s.multiplier), vatRate, importCostRate),
    }))
  }, [scenarioBundle, products, exchangeRate, vatRate, importCostRate])

  // 시나리오에서 각 지표의 최선값 인덱스
  const scenarioBestIdx = useMemo(() => {
    const result = {}
    SCENARIO_METRICS.forEach((m) => {
      const vals = scenarioResults.map((s) => s.calc[m.key] ?? null)
      if (vals.every((v) => v === null)) { result[m.key] = -1; return }
      const best = m.higherIsBetter ? Math.max(...vals) : Math.min(...vals)
      result[m.key] = vals.findIndex((v) => v === best)
    })
    return result
  }, [scenarioResults])

  // ── 샘플 초기화 ───────────────────────────────────────────────
  function handleReset() {
    if (window.confirm('모든 제품·번들 데이터가 샘플로 초기화됩니다. 계속하시겠습니까?')) {
      resetToSample()
      setRateInput(String(DEFAULT_EXCHANGE_RATE))
      setSaveStatus('idle')
      setVatInput('10')
      setVatSaveStatus('idle')
      setImportCostRateInput('0')
      setImportSaveStatus('idle')
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* 페이지 헤더 + 탭 */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">설정</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          환율, VAT, 비용 프리셋을 관리합니다
        </p>
        <div className="flex gap-1 mt-4 border-b border-gray-200">
          {[
            { key: 'main',    label: '환율 / VAT',    icon: DollarSign },
            { key: 'presets', label: '비용 프리셋',   icon: Receipt },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setSettingsTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition
                ${settingsTab === key
                  ? 'text-blue-600 border-blue-600'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
                }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ════════════════════════════ 탭: 환율/VAT ══════════════════════════ */}
      {settingsTab === 'main' && (<>

      {/* ── 0. VAT율 설정 카드 ────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <SectionHeader icon={Zap} title="부가세(VAT) 설정" iconColor="text-violet-600" />
        <div className="px-5 py-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                VAT율 입력 (%)
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-xs">
                  <input
                    type="number"
                    value={vatInput}
                    onChange={(e) => {
                      setVatInput(e.target.value)
                      setVatErrorMsg('')
                      setVatSaveStatus('idle')
                    }}
                    onKeyDown={handleVatKeyDown}
                    placeholder="10"
                    min="0"
                    max="100"
                    step="0.1"
                    className={`w-full pl-3 pr-10 py-2.5 border rounded-xl text-sm outline-none transition
                      ${vatSaveStatus === 'error'
                        ? 'border-red-400 focus:ring-1 focus:ring-red-300'
                        : 'border-gray-300 focus:border-violet-500 focus:ring-1 focus:ring-violet-200'
                      }`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-medium">%</span>
                </div>
                <button
                  onClick={handleSaveVat}
                  className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold transition
                    ${vatSaveStatus === 'saved'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-violet-600 hover:bg-violet-700 text-white'
                    }`}
                >
                  {vatSaveStatus === 'saved'
                    ? <><CheckCircle size={14} /> 저장됨</>
                    : <><Settings size={14} /> 저장</>
                  }
                </button>
              </div>

              {vatSaveStatus === 'error' && vatErrorMsg && (
                <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle size={11} /> {vatErrorMsg}
                </p>
              )}
              {vatSaveStatus === 'saved' && (
                <p className="mt-1.5 text-xs text-emerald-600 flex items-center gap-1">
                  <CheckCircle size={11} /> VAT율이 적용되었습니다. 이익 계산이 자동으로 갱신됩니다.
                </p>
              )}
            </div>
          </div>

          <div className="bg-violet-50 border border-violet-100 rounded-xl p-4">
            <p className="text-xs text-violet-500 mb-1 font-medium">현재 VAT율 적용 기준</p>
            <p className="text-2xl font-bold text-violet-700 tabular-nums">
              {vatRate}%
            </p>
            <p className="text-xs text-violet-400 mt-1">
              판매가 ÷ {(1 + vatRate / 100).toFixed(2)} → VAT 제외 환산 · 이익 계산 기준
            </p>
          </div>

          <div className="text-xs text-gray-400 space-y-1 border border-gray-100 rounded-xl px-4 py-3 bg-gray-50">
            <p className="font-medium text-gray-500">VAT 처리 기준</p>
            <p>· 판매가(retailPrice, salePrice): VAT <strong>포함</strong> 가격</p>
            <p>· 원가(cost), 비용(eventCost): VAT <strong>제외</strong> 가격</p>
            <p>· 이익 계산: 판매가(VAT제외) = 판매가 ÷ (1 + VAT율) 기준으로 수행</p>
          </div>
        </div>
      </div>

      {/* ── 1. 환율 설정 카드 ─────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <SectionHeader icon={DollarSign} title="기준 환율 (KRW / USD)" />
        <div className="px-5 py-5 space-y-4">
          {/* 입력 영역 */}
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                환율 입력 (원 / 달러)
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-xs">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">₩</span>
                  <input
                    type="number"
                    value={rateInput}
                    onChange={(e) => {
                      setRateInput(e.target.value)
                      setErrorMsg('')
                      setSaveStatus('idle')
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="1380"
                    min="100"
                    max="5000"
                    step="1"
                    className={`w-full pl-8 pr-14 py-2.5 border rounded-xl text-sm outline-none transition
                      ${saveStatus === 'error'
                        ? 'border-red-400 focus:ring-1 focus:ring-red-300'
                        : 'border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200'
                      }`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-medium">/USD</span>
                </div>
                <button
                  onClick={handleSaveRate}
                  className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold transition
                    ${saveStatus === 'saved'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                >
                  {saveStatus === 'saved'
                    ? <><CheckCircle size={14} /> 저장됨</>
                    : <><Settings size={14} /> 저장</>
                  }
                </button>
              </div>

              {saveStatus === 'error' && errorMsg && (
                <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle size={11} /> {errorMsg}
                </p>
              )}
              {saveStatus === 'saved' && (
                <p className="mt-1.5 text-xs text-emerald-600 flex items-center gap-1">
                  <CheckCircle size={11} /> 환율이 적용되었습니다. 달러 원가 제품들이 자동 재계산됩니다.
                </p>
              )}
            </div>
          </div>

          {/* 수입 비용율 입력 */}
          <div className="flex items-start gap-3 pt-2 border-t border-gray-100">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                수입 비용율 (%)
              </label>
              <p className="text-xs text-gray-400 mb-2">
                달러 원가 적용 시 환율에 추가되는 비용 (관세, 물류비 등)
              </p>
              <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-xs">
                  <input
                    type="number"
                    value={importCostRateInput}
                    onChange={(e) => {
                      setImportCostRateInput(e.target.value)
                      setImportErrorMsg('')
                      setImportSaveStatus('idle')
                    }}
                    onKeyDown={handleImportKeyDown}
                    placeholder="0"
                    min="0"
                    max="100"
                    step="0.1"
                    className={`w-full pl-3 pr-10 py-2.5 border rounded-xl text-sm outline-none transition
                      ${importSaveStatus === 'error'
                        ? 'border-red-400 focus:ring-1 focus:ring-red-300'
                        : 'border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200'
                      }`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-medium">%</span>
                </div>
                <button
                  onClick={handleSaveImportCostRate}
                  className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold transition
                    ${importSaveStatus === 'saved'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                >
                  {importSaveStatus === 'saved'
                    ? <><CheckCircle size={14} /> 저장됨</>
                    : <><Settings size={14} /> 저장</>
                  }
                </button>
              </div>
              {importSaveStatus === 'error' && importErrorMsg && (
                <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle size={11} /> {importErrorMsg}
                </p>
              )}
              {importSaveStatus === 'saved' && (
                <p className="mt-1.5 text-xs text-emerald-600 flex items-center gap-1">
                  <CheckCircle size={11} /> 수입 비용율이 적용되었습니다. 달러 원가가 자동 재계산됩니다.
                </p>
              )}
            </div>
          </div>

          {/* 현재 적용 환율 + 마지막 업데이트 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="text-xs text-blue-500 mb-1 font-medium">현재 적용 환율</p>
              <p className="text-2xl font-bold text-blue-700 tabular-nums">
                ₩{exchangeRate.toLocaleString('ko-KR')}
                <span className="text-sm font-normal text-blue-400 ml-1">/ USD</span>
              </p>
              <p className="text-xs text-blue-400 mt-1">
                {importCostRate > 0
                  ? `$1 → ₩${Math.round(exchangeRate * (1 + importCostRate / 100)).toLocaleString('ko-KR')} (수입비용율 ${importCostRate}% 포함)`
                  : `$1 → ${krw(exchangeRate)} · $10 → ${krw(exchangeRate * 10)}`
                }
              </p>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1 font-medium flex items-center gap-1">
                <Clock size={11} /> 마지막 업데이트
              </p>
              {rateUpdatedAt ? (
                <>
                  <p className="text-base font-bold text-gray-800">{formatDateTime(rateUpdatedAt)}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {usdProducts.length}개 제품 원가 자동 반영
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-400 mt-1">아직 업데이트 이력 없음</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. 환율 이력 ─────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <SectionHeader icon={History} title="환율 변경 이력 (최근 5개)" />
        <div className="px-5 py-4">
          {rateHistory.length === 0 ? (
            <p className="text-sm text-gray-400 py-3 text-center">환율 변경 이력이 없습니다</p>
          ) : (
            <div className="space-y-2">
              {rateHistory.map((h, i) => {
                const isCurrent = h.rate === exchangeRate
                const prev = rateHistory[i + 1]
                const diff = prev ? h.rate - prev.rate : null
                return (
                  <button
                    key={i}
                    onClick={() => handleHistoryClick(h.rate)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition text-left
                      ${isCurrent
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-gray-50'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${isCurrent ? 'bg-blue-500' : 'bg-gray-300'}`} />
                      <div>
                        <span className={`text-sm font-bold tabular-nums ${isCurrent ? 'text-blue-700' : 'text-gray-800'}`}>
                          ₩{h.rate.toLocaleString('ko-KR')} / USD
                        </span>
                        {isCurrent && (
                          <span className="ml-2 text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full font-medium">
                            현재 적용
                          </span>
                        )}
                        {!isCurrent && (
                          <span className="ml-2 text-xs text-gray-400 hover:text-blue-600">
                            클릭하여 적용
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      {diff != null && (
                        <span className={`text-xs font-medium ${diff > 0 ? 'text-orange-500' : diff < 0 ? 'text-blue-500' : 'text-gray-400'}`}>
                          {diff > 0 ? `+${diff.toLocaleString()}` : diff.toLocaleString()}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">{formatDateTime(h.savedAt)}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── 4. 환율 시나리오 비교 ────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <SectionHeader icon={BarChart2} title="환율 시나리오 비교" />
        <div className="px-5 py-5 space-y-4">
          {/* 번들 선택 */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700 shrink-0">비교 번들</label>
            {bundles.length === 0 ? (
              <p className="text-sm text-gray-400">저장된 번들이 없습니다. 번들 구성기에서 먼저 저장해주세요.</p>
            ) : (
              <div className="relative">
                <select
                  value={scenarioBundleId}
                  onChange={(e) => setScenarioBundleId(e.target.value)}
                  className="appearance-none border border-gray-300 rounded-xl pl-3 pr-8 py-2 text-sm bg-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition cursor-pointer font-medium"
                >
                  {bundles.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            )}
          </div>

          {/* 시나리오 환율 3개 표시 */}
          {scenarioResults.length > 0 && (
            <>
              {/* 환율 칩 */}
              <div className="flex gap-3 flex-wrap">
                {scenarioResults.map((s) => (
                  <div
                    key={s.key}
                    className={`flex-1 min-w-[110px] border rounded-xl px-4 py-3 text-center ${s.bg} ${s.border}`}
                  >
                    <p className={`text-xs font-semibold mb-0.5 ${s.color}`}>{s.label} 시나리오</p>
                    <p className={`text-lg font-bold tabular-nums ${s.color}`}>
                      ₩{s.rate.toLocaleString('ko-KR')}
                    </p>
                    <p className="text-xs text-gray-400">/ USD</p>
                  </div>
                ))}
              </div>

              {/* 시나리오 결과 테이블 */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                        지표
                      </th>
                      {scenarioResults.map((s) => (
                        <th key={s.key} className="text-right px-4 py-3 text-xs font-bold">
                          <span className={s.color}>{s.label}</span>
                          <span className="block text-gray-400 font-normal tabular-nums">
                            ₩{s.rate.toLocaleString('ko-KR')}
                          </span>
                        </th>
                      ))}
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                        -5% vs +5%
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {SCENARIO_METRICS.map((m) => {
                      const vals = scenarioResults.map((s) => s.calc[m.key])
                      const bestIdx = scenarioBestIdx[m.key]
                      const diff = vals[0] != null && vals[2] != null ? vals[0] - vals[2] : null

                      return (
                        <tr key={m.key} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3 text-xs font-medium text-gray-500">{m.label}</td>
                          {scenarioResults.map((s, i) => {
                            const val = s.calc[m.key]
                            const isBest = i === bestIdx
                            const valColor = m.isRate ? rateColor(val) : 'text-gray-800'
                            return (
                              <td
                                key={s.key}
                                className={`px-4 py-3 text-right text-xs tabular-nums font-semibold
                                  ${valColor} ${isBest ? 'bg-emerald-50' : ''}`}
                              >
                                <span className="flex items-center justify-end gap-1">
                                  {isBest && scenarioResults.length > 1 && (
                                    <span className="text-emerald-500">✓</span>
                                  )}
                                  {m.isRate ? (
                                    <span className="flex items-center gap-0.5">
                                      {rateIcon(val)}
                                      {m.fmt(val)}
                                    </span>
                                  ) : m.fmt(val)}
                                </span>
                              </td>
                            )
                          })}
                          {/* diff 열: -5% 시나리오 - +5% 시나리오 */}
                          <td className="px-4 py-3 text-right text-xs tabular-nums">
                            {diff != null ? (
                              <span className={`font-semibold ${
                                m.higherIsBetter
                                  ? diff > 0 ? 'text-blue-600' : diff < 0 ? 'text-orange-500' : 'text-gray-400'
                                  : diff < 0 ? 'text-blue-600' : diff > 0 ? 'text-orange-500' : 'text-gray-400'
                              }`}>
                                {diff > 0 ? '+' : ''}{m.isRate ? pct(diff) : Math.abs(diff) > 1 ? krw(diff) : pct(diff * 100 / (vals[0] ?? 1))}
                              </span>
                            ) : '-'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* 안내 문구 */}
              <p className="text-xs text-gray-400 flex items-center gap-1.5">
                <Zap size={11} className="text-amber-500" />
                달러 원가 제품이 {usdProducts.length}개 있습니다. 환율 변동 시 총 원가가 자동으로 달라집니다.
                <span className="font-medium text-emerald-600 ml-1">✓ = 시나리오 중 최선값</span>
              </p>
            </>
          )}
        </div>
      </div>

      {/* ── 데이터 관리 ──────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <SectionHeader icon={RefreshCw} title="데이터 관리" iconColor="text-gray-500" />
        <div className="px-5 py-5 flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">샘플 데이터로 초기화</p>
            <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
              모든 제품·번들 데이터를 기본 샘플로 되돌립니다.<br />
              저장된 변경사항은 복구할 수 없습니다.
            </p>
          </div>
          <button
            onClick={handleReset}
            className="ml-4 shrink-0 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition"
          >
            초기화
          </button>
        </div>
      </div>

      {/* ── 앱 정보 ──────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">앱 정보</p>
        <div className="space-y-2">
          {[
            ['앱 이름',   'Bundle Calculator'],
            ['버전',      'v1.0.0'],
            ['저장 방식', 'localStorage (브라우저 로컬)'],
            ['기본 환율', `₩${DEFAULT_EXCHANGE_RATE.toLocaleString('ko-KR')} / USD`],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between text-sm">
              <span className="text-gray-400">{label}</span>
              <span className="text-gray-700 font-medium">{value}</span>
            </div>
          ))}
        </div>
      </div>

      </>)}

      {/* ════════════════════════════ 탭: 비용 프리셋 ══════════════════════════ */}
      {settingsTab === 'presets' && (
        <div className="space-y-4">

          {/* 프리셋 목록 */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <SectionHeader icon={Receipt} title={`비용 프리셋 관리 (${costPresets.length}개)`} iconColor="text-violet-600" />
            <div className="px-5 py-4 space-y-2">
              <p className="text-xs text-gray-400 mb-3">
                번들 구성기에서 [+ 비용 추가] 클릭 시 여기 등록된 항목을 빠르게 선택할 수 있습니다.
              </p>

              {costPresets.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-6">등록된 프리셋이 없습니다. 아래에서 추가하세요.</p>
              )}

              {costPresets.map((p) => {
                const isEditing = editingPresetId === p.id
                const isRate = p.type === 'rate'

                return (
                  <div
                    key={p.id}
                    className={`border rounded-xl p-3 transition ${
                      isEditing ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    {isEditing ? (
                      /* 편집 폼 */
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                            className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-500"
                            placeholder="비용명"
                          />
                          <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                            {[{ v: 'fixed', l: '정액' }, { v: 'rate', l: '정률' }].map(({ v, l }) => (
                              <button
                                key={v}
                                onClick={() => setEditForm((f) => ({ ...f, type: v }))}
                                className={`px-3 py-1.5 text-xs font-medium transition ${
                                  editForm.type === v ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
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
                              {editForm.type === 'fixed' ? '₩' : '%'}
                            </span>
                            <input
                              type="number"
                              value={editForm.value}
                              onChange={(e) => setEditForm((f) => ({ ...f, value: e.target.value }))}
                              className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-1.5 text-sm outline-none focus:border-blue-500"
                              placeholder={editForm.type === 'fixed' ? '금액' : '비율'}
                              min="0"
                            />
                          </div>
                          {editForm.type === 'fixed' && (
                            <label className="flex items-center gap-1.5 text-xs text-gray-600 shrink-0 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={editForm.vatIncluded}
                                onChange={(e) => setEditForm((f) => ({ ...f, vatIncluded: e.target.checked }))}
                                className="rounded"
                              />
                              VAT포함
                            </label>
                          )}
                          <input
                            type="text"
                            value={editForm.memo}
                            onChange={(e) => setEditForm((f) => ({ ...f, memo: e.target.value }))}
                            className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-500"
                            placeholder="메모 (선택)"
                          />
                          <button
                            onClick={() => handleSaveEdit(p.id)}
                            className="shrink-0 p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
                          >
                            <Check size={13} />
                          </button>
                          <button
                            onClick={() => setEditingPresetId(null)}
                            className="shrink-0 p-1.5 border border-gray-300 text-gray-500 rounded-lg hover:bg-gray-50 transition"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* 표시 모드 */
                      <div className="flex items-center gap-3">
                        <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded ${
                          isRate ? 'bg-violet-100 text-violet-700' : 'bg-blue-50 text-blue-600'
                        }`}>
                          {isRate ? '정률' : '정액'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800">{p.name}</p>
                          {p.memo && <p className="text-xs text-gray-400 truncate">{p.memo}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-gray-700 tabular-nums">
                            {isRate ? `${p.value}%` : `₩${p.value.toLocaleString('ko-KR')}`}
                          </p>
                          {!isRate && p.vatIncluded && (
                            <p className="text-xs text-gray-400">VAT포함</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleStartEdit(p)}
                          className="shrink-0 p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeletePreset(p.id)}
                          className="shrink-0 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* 새 프리셋 추가 */}
              {showNewForm ? (
                <div className="border border-emerald-300 bg-emerald-50 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-semibold text-emerald-700 mb-1">새 프리셋 추가</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newForm.name}
                      onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-emerald-500"
                      placeholder="비용명"
                    />
                    <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                      {[{ v: 'fixed', l: '정액' }, { v: 'rate', l: '정률' }].map(({ v, l }) => (
                        <button
                          key={v}
                          onClick={() => setNewForm((f) => ({ ...f, type: v }))}
                          className={`px-3 py-1.5 text-xs font-medium transition ${
                            newForm.type === v ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
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
                        {newForm.type === 'fixed' ? '₩' : '%'}
                      </span>
                      <input
                        type="number"
                        value={newForm.value}
                        onChange={(e) => setNewForm((f) => ({ ...f, value: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-1.5 text-sm outline-none focus:border-emerald-500"
                        placeholder={newForm.type === 'fixed' ? '금액' : '비율'}
                        min="0"
                      />
                    </div>
                    {newForm.type === 'fixed' && (
                      <label className="flex items-center gap-1.5 text-xs text-gray-600 shrink-0 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newForm.vatIncluded}
                          onChange={(e) => setNewForm((f) => ({ ...f, vatIncluded: e.target.checked }))}
                          className="rounded"
                        />
                        VAT포함
                      </label>
                    )}
                    <input
                      type="text"
                      value={newForm.memo}
                      onChange={(e) => setNewForm((f) => ({ ...f, memo: e.target.value }))}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-emerald-500"
                      placeholder="메모 (선택)"
                    />
                    <button
                      onClick={handleAddNewPreset}
                      disabled={!newForm.name.trim() || !newForm.value}
                      className="shrink-0 flex items-center gap-1 bg-emerald-600 text-white rounded-lg px-3 py-1.5
                        text-xs font-semibold disabled:opacity-40 hover:bg-emerald-700 transition"
                    >
                      <Check size={12} /> 저장
                    </button>
                    <button
                      onClick={() => setShowNewForm(false)}
                      className="shrink-0 p-1.5 border border-gray-300 text-gray-500 rounded-lg hover:bg-gray-50 transition"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewForm(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed
                    border-gray-200 text-gray-400 rounded-xl hover:border-blue-300 hover:text-blue-500 transition text-sm font-medium"
                >
                  <Plus size={14} /> 새 프리셋 추가
                </button>
              )}
            </div>
          </div>

        </div>
      )}

    </div>
  )
}
