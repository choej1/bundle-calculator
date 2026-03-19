import { useState } from 'react'
import { Package, Layers, BarChart2, Settings, ShoppingBag } from 'lucide-react'
import { useStore } from './hooks/useStore'
import ProductsPage from './pages/ProductsPage'
import BundleBuilderPage from './pages/BundleBuilderPage'
import ComparePage from './pages/ComparePage'
import SettingsPage from './pages/SettingsPage'

// 탭 정의
const TABS = [
  {
    id: 'products',
    label: '제품 관리',
    shortLabel: '제품',
    icon: Package,
  },
  {
    id: 'builder',
    label: '번들 구성기',
    shortLabel: '번들',
    icon: Layers,
  },
  {
    id: 'compare',
    label: '번들 비교',
    shortLabel: '비교',
    icon: BarChart2,
  },
  {
    id: 'settings',
    label: '설정',
    shortLabel: '설정',
    icon: Settings,
  },
]

function Header({ activeTab, onTabChange, exchangeRate }) {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
      {/* 상단 브랜드 바 */}
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex items-center justify-between h-14">
          {/* 로고 */}
          <div className="flex items-center gap-2.5">
            <div className="bg-blue-600 text-white p-1.5 rounded-lg">
              <ShoppingBag size={18} />
            </div>
            <div className="leading-none">
              <span className="font-bold text-gray-900 text-base">Bundle</span>
              <span className="font-bold text-blue-600 text-base ml-1">Calculator</span>
            </div>
          </div>

          {/* 환율 표시 */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-400 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-full">
            <span className="text-gray-500">기준환율</span>
            <span className="font-semibold text-gray-700">
              ₩{exchangeRate.toLocaleString('ko-KR')}/USD
            </span>
          </div>
        </div>
      </div>

      {/* 탭 네비게이션 바 */}
      <div className="max-w-6xl mx-auto px-6">
        <nav className="flex gap-1" role="tablist" aria-label="주요 메뉴">
          {TABS.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => onTabChange(tab.id)}
                className={`
                  relative flex items-center gap-2 px-4 py-3 text-sm font-medium
                  transition-colors duration-150 select-none outline-none
                  border-b-2 -mb-px
                  ${isActive
                    ? 'text-blue-600 border-blue-600'
                    : 'text-gray-500 border-transparent hover:text-gray-800 hover:border-gray-300'
                  }
                `}
              >
                <Icon size={15} className={isActive ? 'text-blue-600' : 'text-gray-400'} />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
              </button>
            )
          })}
        </nav>
      </div>
    </header>
  )
}

export default function App() {
  const [activeTab, setActiveTab] = useState('products')
  const {
    products,
    bundles,
    settings,
    costPresets,
    addProduct,
    updateProduct,
    deleteProduct,
    setProducts,
    addBundle,
    updateBundle,
    deleteBundle,
    updateSettings,
    addCostPreset,
    updateCostPreset,
    deleteCostPreset,
    resetToSample,
  } = useStore()

  const { exchangeRate, vatRate = 10, importCostRate = 0 } = settings

  function renderPage() {
    switch (activeTab) {
      case 'products':
        return (
          <ProductsPage
            products={products}
            exchangeRate={exchangeRate}
            importCostRate={importCostRate}
            addProduct={addProduct}
            updateProduct={updateProduct}
            deleteProduct={deleteProduct}
            setProducts={setProducts}
          />
        )
      case 'builder':
        return (
          <BundleBuilderPage
            bundles={bundles}
            products={products}
            exchangeRate={exchangeRate}
            vatRate={vatRate}
            importCostRate={importCostRate}
            costPresets={costPresets}
            addBundle={addBundle}
            updateBundle={updateBundle}
            deleteBundle={deleteBundle}
            onNavigate={setActiveTab}
          />
        )
      case 'compare':
        return <ComparePage bundles={bundles} products={products} exchangeRate={exchangeRate} vatRate={vatRate} importCostRate={importCostRate} />
      case 'settings':
        return (
          <SettingsPage
            settings={settings}
            updateSettings={updateSettings}
            resetToSample={resetToSample}
            products={products}
            bundles={bundles}
            costPresets={costPresets}
            addCostPreset={addCostPreset}
            updateCostPreset={updateCostPreset}
            deleteCostPreset={deleteCostPreset}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        exchangeRate={exchangeRate}
      />

      {/* 페이지 콘텐츠 */}
      <main className="max-w-6xl mx-auto px-6 py-7">
        {renderPage()}
      </main>
    </div>
  )
}
