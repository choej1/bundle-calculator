import { useState, useEffect } from 'react'
import { sampleProducts, sampleBundles, DEFAULT_EXCHANGE_RATE, DEFAULT_VAT_RATE, DEFAULT_IMPORT_COST_RATE, DEFAULT_COST_PRESETS } from '../data/sampleData'

const STORAGE_KEYS = {
  products: 'bundle-calc-products',
  bundles: 'bundle-calc-bundles',
  settings: 'bundle-calc-settings',
  costPresets: 'bundle-calc-cost-presets',
}

function loadFromStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    console.warn('localStorage 저장 실패:', key)
  }
}

/**
 * 전역 상태 관리 훅 (localStorage 연동)
 * 제품 목록, 번들 목록, 설정(환율)을 관리한다.
 */
export function useStore() {
  const [products, setProductsState] = useState(() =>
    loadFromStorage(STORAGE_KEYS.products, sampleProducts)
  )
  const [bundles, setBundlesState] = useState(() =>
    loadFromStorage(STORAGE_KEYS.bundles, sampleBundles)
  )
  const [costPresets, setCostPresetsState] = useState(() =>
    loadFromStorage(STORAGE_KEYS.costPresets, DEFAULT_COST_PRESETS)
  )

  const [settings, setSettingsState] = useState(() => {
    const stored = loadFromStorage(STORAGE_KEYS.settings, null)
    const defaults = { exchangeRate: DEFAULT_EXCHANGE_RATE, vatRate: DEFAULT_VAT_RATE, importCostRate: DEFAULT_IMPORT_COST_RATE }
    return stored ? { ...defaults, ...stored } : defaults
  })

  // 상태 변경 시 localStorage 동기화
  useEffect(() => { saveToStorage(STORAGE_KEYS.products, products) }, [products])
  useEffect(() => { saveToStorage(STORAGE_KEYS.bundles, bundles) }, [bundles])
  useEffect(() => { saveToStorage(STORAGE_KEYS.settings, settings) }, [settings])
  useEffect(() => { saveToStorage(STORAGE_KEYS.costPresets, costPresets) }, [costPresets])

  // 제품 CRUD
  const setProducts = (updater) => setProductsState(updater)

  const addProduct = (product) =>
    setProductsState(prev => [...prev, product])

  const updateProduct = (id, patch) =>
    setProductsState(prev =>
      prev.map(p => (p.id === id ? { ...p, ...patch } : p))
    )

  const deleteProduct = (id) =>
    setProductsState(prev => prev.filter(p => p.id !== id))

  // 번들 CRUD
  const setBundles = (updater) => setBundlesState(updater)

  const addBundle = (bundle) =>
    setBundlesState(prev => [...prev, bundle])

  const updateBundle = (id, patch) =>
    setBundlesState(prev =>
      prev.map(b => (b.id === id ? { ...b, ...patch } : b))
    )

  const deleteBundle = (id) =>
    setBundlesState(prev => prev.filter(b => b.id !== id))

  // 설정 업데이트
  const updateSettings = (patch) =>
    setSettingsState(prev => ({ ...prev, ...patch }))

  // 비용 프리셋 CRUD
  const addCostPreset = (preset) =>
    setCostPresetsState(prev => [...prev, preset])

  const updateCostPreset = (id, patch) =>
    setCostPresetsState(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p))

  const deleteCostPreset = (id) =>
    setCostPresetsState(prev => prev.filter(p => p.id !== id))

  // localStorage 초기화 (샘플 데이터로 복원)
  const resetToSample = () => {
    setProductsState(sampleProducts)
    setBundlesState(sampleBundles)
    setSettingsState({ exchangeRate: DEFAULT_EXCHANGE_RATE, vatRate: DEFAULT_VAT_RATE, importCostRate: DEFAULT_IMPORT_COST_RATE })
    setCostPresetsState(DEFAULT_COST_PRESETS)
  }

  return {
    products,
    bundles,
    settings,
    costPresets,
    setProducts,
    addProduct,
    updateProduct,
    deleteProduct,
    setBundles,
    addBundle,
    updateBundle,
    deleteBundle,
    updateSettings,
    addCostPreset,
    updateCostPreset,
    deleteCostPreset,
    resetToSample,
  }
}
