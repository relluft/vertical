import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  Building2,
  CalendarDays,
  Eye,
  ExternalLink,
  Hash,
  History,
  Maximize2,
  Plus,
  RotateCcw,
  Save,
  Search,
  Settings2,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { KpOfferTableEditor } from '../components/KpOfferTableEditor'
import { useDemo } from '../context/DemoContext'
import { createEmptyOfferTable, recalculateOfferTable } from '../data/demoData'
import { loadCrmState, saveCrmState, upsertQuoteFromOfferTable } from '../crm/demoStore'
import { downloadKpDoc, openSavedKpDoc, type KpDocumentProgress, type SavedKpDocument } from '../lib/kpDocument'
import {
  addCalendarDays,
  formatMoney,
  getOfferSaleTotal,
  getVatFromGross,
  kpVatRate,
  kpValidityDays,
} from '../lib/kpFormatting'
import { kpPriceRevision } from '../lib/kpPricing'
import { resolveVerticalProductUrl } from '../lib/verticalProducts'
import type { CrmState, ProductVariant, Supplier, SupplierProduct } from '../crm/types'
import type { DemoOfferTable, DemoOfferTableItem } from '../types/demo'

type KpView = 'home' | 'work' | 'history' | 'settings'
type HistoryMode = 'push' | 'replace'
type ConstructorWorkspaceMode = 'inline' | 'modal'

interface KpHistoryEntry {
  id: string
  title?: string
  number: string
  date: string
  customer: string
  total: number
  source: string
}

interface DownloadToast {
  title: string
  fileName: string
}

interface KpEditorPageProps {
  projectId?: string | null
  darkTheme?: boolean
  embedded?: boolean
}

interface CatalogOption {
  variant: ProductVariant
  product: SupplierProduct
  supplier: Supplier
}

const historyStorageKey = 'uchet-system-kp-history-v1'
const settingsStorageKey = 'uchet-system-kp-settings-v1'

interface KpEditorSettings {
  numberSeries: string
  nextNumber: number
  autoNumbering: boolean
  autoUseToday: boolean
  defaultRecipient: string
  validityDays: number
  vatRate: number
  autoSaveHistory: boolean
  showOperatorColumns: boolean
}

interface SettingsToggleProps {
  title: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}

const defaultKpSettings: KpEditorSettings = {
  numberSeries: 'В',
  nextNumber: 1,
  autoNumbering: true,
  autoUseToday: true,
  defaultRecipient: '',
  validityDays: kpValidityDays,
  vatRate: kpVatRate,
  autoSaveHistory: true,
  showOperatorColumns: true,
}

function resolveKpView(value: string | null, fallback: KpView = 'home'): KpView {
  return value === 'home' || value === 'work' || value === 'history' || value === 'settings' ? value : fallback
}

function getInitialView(): KpView {
  if (typeof window === 'undefined') {
    return 'home'
  }

  const params = new URLSearchParams(window.location.search)
  const fallback = params.get('screen') === 'kp' ? 'work' : 'home'

  return resolveKpView(params.get('view'), fallback)
}

function getKpViewUrl(view: KpView) {
  const url = new URL(window.location.href)

  if (view === 'home') {
    url.searchParams.delete('view')
  } else {
    url.searchParams.set('view', view)
  }

  url.searchParams.delete('request')

  return `${url.pathname}${url.search}${url.hash}`
}

function formatDateLabel(value: string) {
  const [year, month, day] = value.split('-')

  if (!year || !month || !day) {
    return 'дата не указана'
  }

  return `${day}.${month}.${year}`
}

function normalizeText(value: string, fallback: string) {
  const trimmed = value.trim()
  return trimmed || fallback
}

function clampNumber(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback
  }

  return Math.min(max, Math.max(min, Math.round(value)))
}

function getTodayIso() {
  const date = new Date()
  const timezoneOffsetMs = date.getTimezoneOffset() * 60 * 1000

  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 10)
}

function makeNextDocumentNumber(settings: KpEditorSettings) {
  const series = settings.numberSeries.trim()

  return series ? `${settings.nextNumber}-${series}` : String(settings.nextNumber)
}

function shouldSyncDocumentTitle(documentTitle: string, documentNumber: string) {
  const trimmedTitle = documentTitle.trim()
  const trimmedNumber = documentNumber.trim()

  return !trimmedTitle || trimmedTitle === trimmedNumber
}

function parseMoneyInput(value: string, fallback: number) {
  const parsed = Number(value.replace(/\s+/g, '').replace(',', '.'))

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function roundMoneyValue(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100
}

function isParserVariantLabel(value?: string) {
  return value?.toLocaleLowerCase('ru-RU').includes('вариант из парсера') ?? false
}

function getVariantSizeLabel(variant: ProductVariant) {
  return variant.size && !isParserVariantLabel(variant.size) ? variant.size : ''
}

function getCatalogVariantMeta(option: CatalogOption) {
  const sizeLabel = getVariantSizeLabel(option.variant)
  const variantName = option.variant.variantName !== option.product.name ? option.variant.variantName : ''

  return sizeLabel || variantName
}

function getVariantDetailLabel(variant: ProductVariant) {
  return [getVariantSizeLabel(variant), variant.material].filter(Boolean).join(' · ')
}

function getCatalogCategoryLabel(option: CatalogOption) {
  return option.product.category.trim() || 'Без типа'
}

function makeCatalogOfferItem(
  option: CatalogOption,
  quantity: number,
  salePrice: number,
  comment: string,
): DemoOfferTableItem {
  const safeQuantity = Math.max(1, Math.round(quantity || 1))
  const purchasePrice = roundMoneyValue(Math.max(0, option.variant.purchasePrice || option.product.basePurchasePrice || 0))
  const resolvedSalePrice = roundMoneyValue(Math.max(0, salePrice || 0))
  const descriptionParts = [
    option.product.name,
    option.variant.variantName,
    option.variant.size,
    option.variant.color,
    option.variant.material,
  ].filter(Boolean)
  const productUrl = resolveVerticalProductUrl({
    description: option.product.name,
    productCode: option.variant.sku || option.product.sku,
  })

  return {
    id: `offer-catalog-${option.variant.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    sourceNeed: `${option.product.category}; ${option.variant.availability || option.product.availability}`,
    description: descriptionParts.join(', '),
    productCode: option.variant.sku || option.product.sku,
    productUrl,
    productImageUrl: option.product.imageUrl,
    unit: option.product.unit || 'шт',
    quantity: safeQuantity,
    unitPrice: purchasePrice,
    installationUnitPrice: resolvedSalePrice,
    minSalePrice: roundMoneyValue(resolvedSalePrice * 0.92),
    maxSalePrice: roundMoneyValue(resolvedSalePrice * 1.16),
    marketBenchmark: resolvedSalePrice,
    pricingRevision: kpPriceRevision,
    reviewStatus: option.supplier.updateStatus === 'fresh' ? 'готово' : 'проверить цену',
    managerComment:
      comment.trim() ||
      `${option.supplier.name}: ${option.variant.availability || option.product.availability}. Цена зафиксирована вручную в конструкторе.`,
  }
}

function appendOfferItem(offerTable: DemoOfferTable | null, item: DemoOfferTableItem) {
  const current = offerTable ?? createEmptyOfferTable()

  return recalculateOfferTable({
    ...current,
    items: [...current.items, item],
    totals: current.totals.map((total) => ({ ...total })),
  })
}

function makeCatalogProductUrl(option: CatalogOption) {
  return resolveVerticalProductUrl({
    description: option.product.name,
    productCode: option.variant.sku || option.product.sku,
  })
}

function sanitizeKpSettings(value: unknown): KpEditorSettings {
  if (!value || typeof value !== 'object') {
    return defaultKpSettings
  }

  const item = value as Partial<KpEditorSettings>

  return {
    numberSeries: typeof item.numberSeries === 'string' ? item.numberSeries.slice(0, 12) : defaultKpSettings.numberSeries,
    nextNumber: clampNumber(Number(item.nextNumber), 1, 9999, defaultKpSettings.nextNumber),
    autoNumbering: typeof item.autoNumbering === 'boolean' ? item.autoNumbering : defaultKpSettings.autoNumbering,
    autoUseToday: typeof item.autoUseToday === 'boolean' ? item.autoUseToday : defaultKpSettings.autoUseToday,
    defaultRecipient: typeof item.defaultRecipient === 'string' ? item.defaultRecipient.slice(0, 120) : '',
    validityDays: clampNumber(Number(item.validityDays), 1, 90, defaultKpSettings.validityDays),
    vatRate: clampNumber(Number(item.vatRate), 0, 30, defaultKpSettings.vatRate),
    autoSaveHistory: typeof item.autoSaveHistory === 'boolean' ? item.autoSaveHistory : defaultKpSettings.autoSaveHistory,
    showOperatorColumns:
      typeof item.showOperatorColumns === 'boolean' ? item.showOperatorColumns : defaultKpSettings.showOperatorColumns,
  }
}

function loadKpSettings() {
  if (typeof window === 'undefined') {
    return defaultKpSettings
  }

  try {
    const cached = window.localStorage.getItem(settingsStorageKey)

    return cached ? sanitizeKpSettings(JSON.parse(cached)) : defaultKpSettings
  } catch {
    return defaultKpSettings
  }
}

function SettingsToggle({ title, description, checked, onChange }: SettingsToggleProps) {
  return (
    <label className="settings-toggle">
      <span className="settings-toggle-text">
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <span className="settings-switch" aria-hidden="true">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span />
      </span>
    </label>
  )
}

function isHistoryEntry(value: unknown): value is KpHistoryEntry {
  if (!value || typeof value !== 'object') {
    return false
  }

  const item = value as Partial<KpHistoryEntry>

  return (
    typeof item.id === 'string' &&
    (item.title === undefined || typeof item.title === 'string') &&
    typeof item.number === 'string' &&
    typeof item.date === 'string' &&
    typeof item.customer === 'string' &&
    typeof item.total === 'number' &&
    typeof item.source === 'string'
  )
}

export function KpEditorPage({ projectId = null, darkTheme = false, embedded = false }: KpEditorPageProps) {
  const {
    state: { draft, exportForm },
    startPipeline,
    updateExportField,
    applyKpOfferTable,
    updateOfferItem,
    addOfferItem,
    deleteOfferItem,
  } = useDemo()
  const [activeView, setActiveView] = useState<KpView>(() => (projectId ? 'work' : getInitialView()))
  const [isGeneratingWord, setIsGeneratingWord] = useState(false)
  const [isOpeningWord, setIsOpeningWord] = useState(false)
  const [wordProgress, setWordProgress] = useState<KpDocumentProgress | null>(null)
  const [lastSavedDoc, setLastSavedDoc] = useState<SavedKpDocument | null>(null)
  const [generationMessage, setGenerationMessage] = useState<string | null>(null)
  const [downloadToast, setDownloadToast] = useState<DownloadToast | null>(null)
  const [settings, setSettings] = useState<KpEditorSettings>(loadKpSettings)
  const [crmState, setCrmState] = useState<CrmState>(loadCrmState)
  const [catalogSearch, setCatalogSearch] = useState('')
  const [selectedCatalogCategory, setSelectedCatalogCategory] = useState('all')
  const [isCatalogFiltersOpen, setIsCatalogFiltersOpen] = useState(false)
  const [selectedVariantId, setSelectedVariantId] = useState('')
  const [constructorQty, setConstructorQty] = useState(1)
  const [constructorSalePrice, setConstructorSalePrice] = useState('')
  const [isConstructorModalOpen, setIsConstructorModalOpen] = useState(false)
  const [documentPreviewWidth, setDocumentPreviewWidth] = useState<number | null>(null)
  const constructorSalePriceRef = useRef('')
  const initializedProjectRef = useRef<string | null>(null)
  const total = useMemo(() => getOfferSaleTotal(draft.offerTable), [draft.offerTable])
  const documentWorkTileStyle = useMemo(
    () =>
      ({
        '--kp-document-preview-width': documentPreviewWidth ? `${Math.round(documentPreviewWidth)}px` : undefined,
      }) as CSSProperties,
    [documentPreviewWidth],
  )
  const handlePagePreviewWidthChange = useCallback((width: number) => {
    setDocumentPreviewWidth((current) => (current !== null && Math.abs(current - width) < 0.5 ? current : width))
  }, [])
  const updateConstructorSalePrice = useCallback((value: string) => {
    constructorSalePriceRef.current = value
    setConstructorSalePrice(value)
  }, [])
  const resetConstructorSalePrice = useCallback(() => {
    updateConstructorSalePrice('')
  }, [updateConstructorSalePrice])
  const [historyEntries, setHistoryEntries] = useState<KpHistoryEntry[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = window.localStorage.getItem(historyStorageKey)
        const parsed = cached ? JSON.parse(cached) : null

        if (Array.isArray(parsed)) {
          return parsed.filter(isHistoryEntry)
        }
      } catch {
        // Ignore broken local history and fall back to the current demo document.
      }
    }

    return total
      ? [
          {
            id: 'history-seed',
            number: normalizeText(exportForm.documentNumber, '1-В'),
            date: exportForm.documentDate,
            customer: normalizeText(exportForm.counterpartyName, 'Заказчик не указан'),
            total,
            source: 'Текущий документ',
          },
        ]
      : []
  })
  const settingsPreviewDate = settings.autoUseToday ? getTodayIso() : exportForm.documentDate
  const settingsPreviewNumber = settings.autoNumbering
    ? makeNextDocumentNumber(settings)
    : normalizeText(exportForm.documentNumber, 'без номера')
  const settingsPreviewRecipient = normalizeText(settings.defaultRecipient, exportForm.counterpartyName || 'не задан')
  const settingsPreviewValidUntil = formatDateLabel(addCalendarDays(settingsPreviewDate, settings.validityDays))
  const settingsPreviewVat = getVatFromGross(total, settings.vatRate)
  const projectDeal = useMemo(
    () => (projectId ? crmState.deals.find((deal) => deal.id === projectId) : undefined),
    [crmState.deals, projectId],
  )
  const projectCounterparty = useMemo(
    () => (projectDeal ? crmState.counterparties.find((item) => item.id === projectDeal.counterpartyId) : undefined),
    [crmState.counterparties, projectDeal],
  )
  const projectObject = useMemo(
    () => (projectDeal ? crmState.objects.find((item) => item.id === projectDeal.objectId) : undefined),
    [crmState.objects, projectDeal],
  )
  const projectDocuments = useMemo(
    () => (projectDeal ? crmState.documents.filter((document) => document.dealId === projectDeal.id) : []),
    [crmState.documents, projectDeal],
  )
  const catalogOptions = useMemo<CatalogOption[]>(() => {
    const productsById = new Map(crmState.products.map((product) => [product.id, product]))
    const suppliersById = new Map(crmState.suppliers.map((supplier) => [supplier.id, supplier]))

    return crmState.variants
      .map((variant) => {
        const product = productsById.get(variant.supplierProductId)
        const supplier = product ? suppliersById.get(product.supplierId) : undefined

        return product && supplier ? { variant, product, supplier } : null
      })
      .filter((item): item is CatalogOption => Boolean(item))
  }, [crmState.products, crmState.suppliers, crmState.variants])
  const catalogCategoryOptions = useMemo(() => {
    const counts = new Map<string, number>()

    catalogOptions.forEach((option) => {
      const category = getCatalogCategoryLabel(option)
      counts.set(category, (counts.get(category) ?? 0) + 1)
    })

    const typedCategories = [...counts.entries()]
      .map(([id, count]) => ({ id, label: id, count }))
      .sort((first, second) => first.label.localeCompare(second.label, 'ru-RU'))

    return [{ id: 'all', label: 'Все типы', count: catalogOptions.length }, ...typedCategories]
  }, [catalogOptions])
  const filteredCatalogOptions = useMemo(() => {
    const normalizedSearch = catalogSearch.toLocaleLowerCase('ru-RU').trim()

    return catalogOptions
      .filter((option) => {
        if (selectedCatalogCategory !== 'all' && getCatalogCategoryLabel(option) !== selectedCatalogCategory) {
          return false
        }

        if (!normalizedSearch) {
          return true
        }

        return [
          option.product.name,
          option.product.category,
          option.product.sku,
          option.variant.sku,
          option.variant.variantName,
          option.variant.size,
          option.variant.color,
          option.supplier.name,
        ]
          .join(' ')
          .toLocaleLowerCase('ru-RU')
          .includes(normalizedSearch)
      })
  }, [catalogOptions, catalogSearch, selectedCatalogCategory])
  const selectedCatalogOption =
    filteredCatalogOptions.find((option) => option.variant.id === selectedVariantId) ?? filteredCatalogOptions[0] ?? null
  const selectedCatalogProductUrl = selectedCatalogOption ? makeCatalogProductUrl(selectedCatalogOption) : null

  const writeNavigationState = useCallback((view: KpView, mode: HistoryMode) => {
    if (typeof window === 'undefined') {
      return
    }

    const nextUrl = getKpViewUrl(view)
    const state = { view }

    if (mode === 'replace') {
      window.history.replaceState(state, '', nextUrl)
    } else {
      window.history.pushState(state, '', nextUrl)
    }
  }, [])

  const navigateToView = useCallback(
    (view: KpView, mode: HistoryMode = 'push') => {
      setActiveView(view)
      writeNavigationState(view, mode)
    },
    [writeNavigationState],
  )

  const updateSetting = useCallback(<K extends keyof KpEditorSettings,>(field: K, value: KpEditorSettings[K]) => {
    setSettings((current) => ({
      ...current,
      [field]: value,
    }))
  }, [])

  const applySettingsToCurrentDocument = useCallback(() => {
    const shouldSyncTitle = shouldSyncDocumentTitle(exportForm.documentTitle, exportForm.documentNumber)

    if (settings.autoNumbering) {
      const nextNumber = makeNextDocumentNumber(settings)

      updateExportField('documentNumber', nextNumber)
      if (shouldSyncTitle) {
        updateExportField('documentTitle', nextNumber)
      }
    }

    if (settings.autoUseToday) {
      updateExportField('documentDate', getTodayIso())
    }

    if (settings.defaultRecipient.trim()) {
      updateExportField('counterpartyName', settings.defaultRecipient.trim())
    }

    setGenerationMessage('Настройки применены к текущему КП.')
  }, [exportForm.documentNumber, exportForm.documentTitle, settings, updateExportField])

  const applyAutomaticSettingsForNewDocument = useCallback(() => {
    const shouldSyncTitle = shouldSyncDocumentTitle(exportForm.documentTitle, exportForm.documentNumber)

    if (settings.autoNumbering) {
      const nextNumber = makeNextDocumentNumber(settings)

      updateExportField('documentNumber', nextNumber)
      if (shouldSyncTitle) {
        updateExportField('documentTitle', nextNumber)
      }
      setSettings((current) => ({
        ...current,
        nextNumber: current.nextNumber + 1,
      }))
    }

    if (settings.autoUseToday) {
      updateExportField('documentDate', getTodayIso())
    }

    if (settings.defaultRecipient.trim()) {
      updateExportField('counterpartyName', settings.defaultRecipient.trim())
    }
  }, [exportForm.documentNumber, exportForm.documentTitle, settings, updateExportField])

  const resetSettings = useCallback(() => {
    setSettings(defaultKpSettings)
    setGenerationMessage('Настройки возвращены к значениям по умолчанию.')
  }, [])

  const createHistoryEntry = useCallback(
    (source: string): KpHistoryEntry => ({
      id: `kp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: normalizeText(exportForm.documentTitle, exportForm.documentNumber || 'без номера'),
      number: normalizeText(exportForm.documentNumber, 'без номера'),
      date: exportForm.documentDate,
      customer: normalizeText(exportForm.counterpartyName, 'Заказчик не указан'),
      total,
      source,
    }),
    [
      exportForm.counterpartyName,
      exportForm.documentDate,
      exportForm.documentNumber,
      exportForm.documentTitle,
      total,
    ],
  )

  const addCurrentKpToHistory = useCallback(
    (source: string, mode: 'auto' | 'manual' = 'auto') => {
      if (mode === 'auto' && !settings.autoSaveHistory) {
        return
      }

      const entry = createHistoryEntry(source)

      setHistoryEntries((current) => [
        entry,
        ...current.filter(
          (item) =>
            !(
              item.number === entry.number &&
              item.date === entry.date &&
              item.customer === entry.customer
            ),
        ),
      ].slice(0, 12))
    },
    [createHistoryEntry, settings.autoSaveHistory],
  )

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(historyStorageKey, JSON.stringify(historyEntries))
    }
  }, [historyEntries])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(settingsStorageKey, JSON.stringify(settings))
    }
  }, [settings])

  useEffect(() => {
    if (!downloadToast || typeof window === 'undefined') {
      return undefined
    }

    const timeoutId = window.setTimeout(() => setDownloadToast(null), 5200)

    return () => window.clearTimeout(timeoutId)
  }, [downloadToast])

  useEffect(() => {
    if (!isConstructorModalOpen || typeof window === 'undefined') {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsConstructorModalOpen(false)
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isConstructorModalOpen])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    writeNavigationState(projectId ? 'work' : getInitialView(), 'replace')

    const handlePopState = () => {
      setActiveView(projectId ? 'work' : getInitialView())
    }

    window.addEventListener('popstate', handlePopState)

    return () => window.removeEventListener('popstate', handlePopState)
  }, [projectId, writeNavigationState])

  useEffect(() => {
    if (!selectedCatalogOption) {
      if (selectedVariantId) {
        setSelectedVariantId('')
      }
      return
    }

    if (selectedVariantId !== selectedCatalogOption.variant.id) {
      setSelectedVariantId(selectedCatalogOption.variant.id)
      resetConstructorSalePrice()
    }
  }, [resetConstructorSalePrice, selectedCatalogOption, selectedVariantId])

  useEffect(() => {
    if (!projectId || initializedProjectRef.current === projectId) {
      return
    }

    initializedProjectRef.current = projectId
    const projectTitle = projectDeal?.title ?? 'Новое коммерческое предложение'

    startPipeline('kp', projectTitle)
    applyAutomaticSettingsForNewDocument()
    updateExportField('counterpartyName', projectCounterparty?.name ?? '')
    updateExportField('counterpartyAddress', projectCounterparty?.legalAddress ?? '')
    updateExportField('objectAddress', projectObject?.address ?? '')
    setActiveView('work')
    writeNavigationState('work', 'replace')
    setGenerationMessage(null)
  }, [
    applyAutomaticSettingsForNewDocument,
    projectCounterparty,
    projectDeal,
    projectId,
    projectObject,
    startPipeline,
    updateExportField,
    writeNavigationState,
  ])

  const makeKpDocumentPayload = useCallback(
    () => ({
      offerTable: draft.offerTable,
      documentDate: exportForm.documentDate,
      documentNumber: exportForm.documentNumber,
      recipientName: exportForm.counterpartyName,
      validityDays: settings.validityDays,
      vatRate: settings.vatRate,
    }),
    [
      draft.offerTable,
      exportForm.counterpartyName,
      exportForm.documentDate,
      exportForm.documentNumber,
      settings.validityDays,
      settings.vatRate,
    ],
  )

  const handleDownload = async () => {
    setIsGeneratingWord(true)
    setWordProgress({ percent: 0, message: 'Подготовка Word-файла' })
    setGenerationMessage(null)
    setDownloadToast(null)

    try {
      const result = await downloadKpDoc(makeKpDocumentPayload(), setWordProgress)
      setLastSavedDoc(result)
      addCurrentKpToHistory('Word-файл')
      setDownloadToast({
        title: result.usedSavePicker ? 'Word-файл сохранён' : 'Word-файл скачан',
        fileName: result.fileName,
      })
      setGenerationMessage(
        result.usedSavePicker
          ? `Word-файл сохранён: ${result.fileName}`
          : `Word-файл сформирован: ${result.fileName}. Если браузер не спросил папку, файл ушёл в загрузки.`,
      )
    } catch (error) {
      const isCancel = error instanceof DOMException && error.name === 'AbortError'
      const message =
        isCancel
          ? 'Сохранение Word-файла отменено.'
          : error instanceof Error
            ? error.message
            : 'Не удалось сформировать Word-файл.'
      setGenerationMessage(message)
    } finally {
      setIsGeneratingWord(false)
      window.setTimeout(() => setWordProgress(null), 900)
    }
  }

  const handleOpenDocument = async () => {
    if (!lastSavedDoc) {
      setGenerationMessage('Сначала сохраните Word-файл, потом его можно открыть этой кнопкой.')
      return
    }

    setIsOpeningWord(true)
    setWordProgress({ percent: 0, message: 'Открываем сохранённый Word-файл' })
    setGenerationMessage(null)

    try {
      const result = await openSavedKpDoc(lastSavedDoc, setWordProgress)
      addCurrentKpToHistory('Word-файл открыт')
      setGenerationMessage(
        `Открываем уже сохранённый Word-файл: ${result.fileName}. Если Word не открылся автоматически, откройте файл через Word.`,
      )
    } catch (error) {
      setGenerationMessage(error instanceof Error ? error.message : 'Не удалось открыть Word-файл.')
    } finally {
      setIsOpeningWord(false)
      window.setTimeout(() => setWordProgress(null), 900)
    }
  }

  const handleSave = () => {
    if (projectId && draft.offerTable) {
      const latestCrmState = loadCrmState()
      const nextCrmState = upsertQuoteFromOfferTable(latestCrmState, {
        dealId: projectId,
        actorUserId: latestCrmState.currentUserId,
        documentNumber: exportForm.documentNumber,
        title: exportForm.documentTitle,
        documentDate: exportForm.documentDate,
        offerTable: draft.offerTable,
      })

      saveCrmState(nextCrmState)
      setCrmState(nextCrmState)
      addCurrentKpToHistory('Сохранено в проекте', 'manual')
      setGenerationMessage(
        `КП ${exportForm.documentNumber || 'без номера'} сохранено и прикреплено к проекту ${projectDeal?.number ?? ''}.`,
      )
      return
    }

    addCurrentKpToHistory('Сохранено вручную', 'manual')
    setGenerationMessage('Изменения сохранены.')
  }

  const handleDocumentNumberChange = (value: string) => {
    const shouldSyncTitle = shouldSyncDocumentTitle(exportForm.documentTitle, exportForm.documentNumber)

    updateExportField('documentNumber', value)
    if (shouldSyncTitle) {
      updateExportField('documentTitle', value)
    }
  }

  const handleAddCatalogProduct = () => {
    if (!selectedCatalogOption) {
      return
    }

    const currentSalePrice = parseMoneyInput(constructorSalePriceRef.current, 0)

    if (currentSalePrice <= 0) {
      setGenerationMessage('Введите цену продажи товара, которая должна уйти в КП.')
      return
    }

    const item = makeCatalogOfferItem(
      selectedCatalogOption,
      constructorQty,
      currentSalePrice,
      '',
    )

    applyKpOfferTable(appendOfferItem(draft.offerTable, item))
    resetConstructorSalePrice()
    setGenerationMessage(`Позиция добавлена в КП: ${selectedCatalogOption.product.name}.`)
  }

  const handleAddEmptyLine = () => {
    addOfferItem()
    setGenerationMessage('Добавлена пустая строка для ручного заполнения.')
  }

  const renderHome = () => (
    <section className="home-shell" aria-label="Главная">
      <div className="home-title">
        <h1>Коммерческие предложения</h1>
      </div>

      <div className="home-actions">
        <button type="button" className="home-button primary-home" onClick={() => navigateToView('work')}>
          <span>Открыть конструктор</span>
        </button>
        <button type="button" className="home-button" onClick={() => navigateToView('history')}>
          <span>История</span>
        </button>
        <button type="button" className="home-button" onClick={() => navigateToView('settings')}>
          <span>Настройки</span>
        </button>
      </div>
    </section>
  )

  const renderHistory = () => (
    <section className="history-page">
      <div className="history-header">
        <div>
          <h1>История</h1>
          <p>Ранее сформированные коммерческие предложения.</p>
        </div>
        <button type="button" className="icon-button primary" onClick={() => navigateToView('work')}>
          <Plus size={16} />
          <span>Новое КП</span>
        </button>
      </div>

      {historyEntries.length ? (
        <div className="history-list" aria-label="Список коммерческих предложений">
          {historyEntries.map((entry) => {
            const entryTitle = normalizeText(entry.title ?? '', entry.number)

            return (
              <button
                key={entry.id}
                type="button"
                className="history-row"
                onClick={() => navigateToView('work')}
              >
                <span className="history-number">
                  <strong>{entryTitle}</strong>
                  <small>КП {entry.number}</small>
                </span>
                <span className="history-customer">{entry.customer}</span>
                <span className="history-date">{formatDateLabel(entry.date)}</span>
                <span className="history-total">{formatMoney(entry.total)}</span>
                <span className="history-source">{entry.source}</span>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="history-empty">
          <h2>История пока пустая</h2>
          <p>Соберите КП вручную через конструктор товаров и сохраните рабочую таблицу.</p>
          <button type="button" className="icon-button primary" onClick={() => navigateToView('work')}>
            <Plus size={16} />
            <span>Открыть конструктор</span>
          </button>
        </div>
      )}
    </section>
  )

  const renderSettings = () => (
    <section className="settings-page">
      <div className="settings-header">
        <div>
          <h1>Настройки</h1>
          <p>Параметры, которые программа будет применять при создании, проверке и выгрузке КП.</p>
        </div>
        <div className="settings-status-card">
          <span>Следующее КП</span>
          <strong>{settingsPreviewNumber}</strong>
          <small>{settingsPreviewRecipient}</small>
        </div>
      </div>

      <div className="settings-layout">
        <div className="settings-main">
          <section className="settings-panel">
            <div className="settings-panel-title">
              <span className="settings-panel-icon">
                <Hash size={18} />
              </span>
              <div>
                <h2>Нумерация и реквизиты</h2>
                <p>То, что попадает в верхние поля рабочей таблицы и в итоговый Word.</p>
              </div>
            </div>

            <div className="settings-grid">
              <label className="settings-field">
                <span>Серия номера</span>
                <input
                  value={settings.numberSeries}
                  onChange={(event) => updateSetting('numberSeries', event.target.value.slice(0, 12))}
                  placeholder="В"
                />
              </label>

              <label className="settings-field">
                <span>Следующий номер</span>
                <input
                  type="number"
                  min="1"
                  max="9999"
                  value={settings.nextNumber}
                  onChange={(event) =>
                    updateSetting('nextNumber', clampNumber(Number(event.target.value), 1, 9999, settings.nextNumber))
                  }
                />
              </label>

              <label className="settings-field settings-field-wide">
                <span>Адресат по умолчанию</span>
                <input
                  value={settings.defaultRecipient}
                  onChange={(event) => updateSetting('defaultRecipient', event.target.value.slice(0, 120))}
                  placeholder="например, ООО «Заказчик»"
                />
              </label>
            </div>

            <div className="settings-toggle-list">
              <SettingsToggle
                title="Автонумерация при создании КП"
                description="При запуске новой заявки программа поставит номер из счетчика и увеличит его на один."
                checked={settings.autoNumbering}
                onChange={(checked) => updateSetting('autoNumbering', checked)}
              />
              <SettingsToggle
                title="Ставить сегодняшнюю дату"
                description="Дата нового КП будет обновляться автоматически, без ручного выбора в таблице."
                checked={settings.autoUseToday}
                onChange={(checked) => updateSetting('autoUseToday', checked)}
              />
            </div>
          </section>

          <section className="settings-panel">
            <div className="settings-panel-title">
              <span className="settings-panel-icon">
                <CalendarDays size={18} />
              </span>
              <div>
                <h2>Коммерческие условия</h2>
                <p>Эти значения сразу отражаются в рабочем листе и в формируемом Word-файле.</p>
              </div>
            </div>

            <div className="settings-grid">
              <label className="settings-field">
                <span>Срок действия КП, дней</span>
                <input
                  type="number"
                  min="1"
                  max="90"
                  value={settings.validityDays}
                  onChange={(event) =>
                    updateSetting(
                      'validityDays',
                      clampNumber(Number(event.target.value), 1, 90, settings.validityDays),
                    )
                  }
                />
              </label>

              <label className="settings-field">
                <span>НДС, %</span>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={settings.vatRate}
                  onChange={(event) =>
                    updateSetting('vatRate', clampNumber(Number(event.target.value), 0, 30, settings.vatRate))
                  }
                />
              </label>
            </div>
          </section>

          <section className="settings-panel">
            <div className="settings-panel-title">
              <span className="settings-panel-icon">
                <Settings2 size={18} />
              </span>
              <div>
                <h2>Рабочий режим менеджера</h2>
                <p>Служебные элементы видны только в программе и не попадают в клиентский документ.</p>
              </div>
            </div>

            <div className="settings-toggle-list">
              <SettingsToggle
                title="Показывать правые служебные колонки"
                description="Цена закупки, сумма закупки, наценка, процент и ссылки на Вертикаль останутся рядом с таблицей."
                checked={settings.showOperatorColumns}
                onChange={(checked) => updateSetting('showOperatorColumns', checked)}
              />
              <SettingsToggle
                title="Автоматически писать КП в историю"
                description="Сформированные из заявки и выгруженные Word-файлы будут попадать в раздел «История»."
                checked={settings.autoSaveHistory}
                onChange={(checked) => updateSetting('autoSaveHistory', checked)}
              />
            </div>
          </section>
        </div>

        <aside className="settings-side">
          <section className="settings-panel settings-preview">
            <div className="settings-panel-title">
              <span className="settings-panel-icon">
                <Eye size={18} />
              </span>
              <div>
                <h2>Предпросмотр</h2>
                <p>Как настройки будут выглядеть в следующем документе.</p>
              </div>
            </div>

            <dl className="settings-preview-list">
              <div>
                <dt>Номер</dt>
                <dd>{settingsPreviewNumber}</dd>
              </div>
              <div>
                <dt>Дата</dt>
                <dd>{formatDateLabel(settingsPreviewDate)}</dd>
              </div>
              <div>
                <dt>Действует до</dt>
                <dd>{settingsPreviewValidUntil}</dd>
              </div>
              <div>
                <dt>НДС от текущей суммы</dt>
                <dd>{formatMoney(settingsPreviewVat)}</dd>
              </div>
              <div>
                <dt>История</dt>
                <dd>{settings.autoSaveHistory ? 'автоматически' : 'только вручную'}</dd>
              </div>
            </dl>
          </section>

          <section className="settings-panel">
            <div className="settings-panel-title">
              <span className="settings-panel-icon">
                <History size={18} />
              </span>
              <div>
                <h2>Автоматика</h2>
                <p>Что программа сделает после нажатия «Далее» в новой заявке.</p>
              </div>
            </div>

            <ol className="settings-automation-list">
              <li className={settings.autoNumbering ? 'is-on' : ''}>Поставит номер {settingsPreviewNumber}</li>
              <li className={settings.autoUseToday ? 'is-on' : ''}>Поставит дату {formatDateLabel(settingsPreviewDate)}</li>
              <li className={settings.defaultRecipient.trim() ? 'is-on' : ''}>Подставит адресата по умолчанию</li>
              <li className={settings.autoSaveHistory ? 'is-on' : ''}>Добавит сформированное КП в историю</li>
            </ol>
          </section>

          <div className="settings-actions">
            <button type="button" className="icon-button primary" onClick={applySettingsToCurrentDocument}>
              <Save size={16} />
              <span>Применить к текущему КП</span>
            </button>
            <button type="button" className="icon-button secondary" onClick={() => navigateToView('work')}>
              <Eye size={16} />
              <span>Открыть таблицу</span>
            </button>
            <button type="button" className="icon-button secondary" onClick={resetSettings}>
              <RotateCcw size={16} />
              <span>Сбросить</span>
            </button>
          </div>
        </aside>
      </div>
    </section>
  )

  const renderDocumentActions = (className = '') => (
    <div className={`document-actions ${className}`.trim()}>
      <button type="button" className="icon-button secondary" onClick={handleSave}>
        <Save size={15} aria-hidden="true" />
        <span>{projectId ? 'В проект' : 'Сохранить'}</span>
      </button>
      <button
        type="button"
        className="icon-button primary"
        onClick={handleDownload}
        disabled={isGeneratingWord || isOpeningWord}
        title="Сохранить Word-файл"
      >
        <Save size={15} aria-hidden="true" />
        <span>{isGeneratingWord ? 'Генерация...' : 'Word'}</span>
      </button>
      <button
        type="button"
        className="icon-button secondary"
        onClick={handleOpenDocument}
        disabled={isGeneratingWord || isOpeningWord}
        title={lastSavedDoc ? 'Открыть сохранённый Word-файл' : 'Сначала сохраните Word-файл'}
      >
        <Eye size={15} aria-hidden="true" />
        <span>{isOpeningWord ? 'Открытие...' : 'Открыть'}</span>
      </button>
    </div>
  )

  const renderDocumentControls = (className = '') => (
    <section className={`document-controls ${className}`.trim()} aria-label="Поля коммерческого предложения">
      <label className="control-field control-field-number">
        <span>№ КП</span>
        <input
          value={exportForm.documentNumber}
          onChange={(event) => handleDocumentNumberChange(event.target.value)}
          placeholder="1-В"
        />
      </label>

      <label className="control-field control-field-title">
        <span>Имя КП</span>
        <input
          value={exportForm.documentTitle}
          onChange={(event) => updateExportField('documentTitle', event.target.value)}
          placeholder={exportForm.documentNumber || '1-В'}
        />
      </label>

      <label className="control-field">
        <span>Дата документа</span>
        <input
          type="date"
          value={exportForm.documentDate}
          onChange={(event) => updateExportField('documentDate', event.target.value)}
        />
      </label>

      <label className="control-field control-field-wide">
        <span>Адресат</span>
        <input
          value={exportForm.counterpartyName}
          onChange={(event) => updateExportField('counterpartyName', event.target.value)}
          placeholder="Наименование адресата"
        />
      </label>
    </section>
  )

  const renderDocumentStatus = () => (
    <>
      {wordProgress ? (
        <div className="word-download-progress" role="status" aria-live="polite">
          <div className="word-download-progress-meta">
            <span>{wordProgress.message}</span>
            <strong>{Math.round(wordProgress.percent)}%</strong>
          </div>
          <div className="word-download-progress-track" aria-hidden="true">
            <span style={{ width: `${Math.min(100, Math.max(0, wordProgress.percent))}%` }} />
          </div>
        </div>
      ) : null}

      {generationMessage ? <div className="generation-message">{generationMessage}</div> : null}
    </>
  )

  const renderConstructorWorkspace = (mode: ConstructorWorkspaceMode = 'inline') => (
    <>

      <section className={`kp-constructor-panel ${mode === 'modal' ? 'is-modal-mode' : ''}`} aria-label="Конструктор товаров КП">
        <div className="kp-constructor-head">
          <div>
            <h2>Конструктор КП</h2>
            <p>
              {(draft.offerTable?.items.length ?? 0)} позиций · {formatMoney(total)}
            </p>
          </div>
          <div className="kp-constructor-head-controls">
            {mode === 'inline' ? (
              <button
                type="button"
                className="kp-constructor-expand-button"
                onClick={() => setIsConstructorModalOpen(true)}
                aria-label="Развернуть конструктор КП"
                title="Развернуть конструктор КП"
              >
                <Maximize2 size={16} />
              </button>
            ) : null}
            <div className="kp-constructor-actions">
              <button type="button" className="icon-button secondary" onClick={handleAddEmptyLine}>
                <Plus size={16} />
                <span>Пустая строка</span>
              </button>
            </div>
          </div>
        </div>

        <div className="kp-constructor-layout">
          <div className="kp-catalog-browser">
            <label className="kp-catalog-search">
              <span>Каталог товаров</span>
              <div>
                <Search size={16} />
                <input
                  value={catalogSearch}
                  onChange={(event) => setCatalogSearch(event.target.value)}
                  placeholder="Поиск по названию, артикулу, поставщику"
                />
              </div>
            </label>

            <div className="kp-catalog-filter-tools">
              <button
                type="button"
                className={`kp-catalog-filter-toggle ${isCatalogFiltersOpen ? 'is-active' : ''}`}
                onClick={() => setIsCatalogFiltersOpen((current) => !current)}
              >
                <SlidersHorizontal size={14} />
                <span>Фильтры</span>
              </button>
              <span>{catalogCategoryOptions.find((item) => item.id === selectedCatalogCategory)?.label ?? 'Все типы'}</span>
            </div>

            {isCatalogFiltersOpen ? (
              <div className="kp-catalog-filter-list" aria-label="Типы товаров">
                {catalogCategoryOptions.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    className={category.id === selectedCatalogCategory ? 'is-active' : undefined}
                    onClick={() => {
                      setSelectedCatalogCategory(category.id)
                      resetConstructorSalePrice()
                    }}
                  >
                    <span>{category.label}</span>
                    <small>{category.count}</small>
                  </button>
                ))}
              </div>
            ) : null}

            <div className="kp-catalog-list" role="listbox" aria-label="Товары каталога">
              {filteredCatalogOptions.map((option, index) => {
                const active = selectedCatalogOption?.variant.id === option.variant.id
                const variantMeta = getCatalogVariantMeta(option)

                return (
                  <button
                    key={option.variant.id}
                    type="button"
                    className={active ? 'is-active' : undefined}
                    onClick={() => {
                      if (selectedVariantId !== option.variant.id) {
                        resetConstructorSalePrice()
                      }
                      setSelectedVariantId(option.variant.id)
                    }}
                  >
                    <span className="kp-catalog-item-number">{index + 1}</span>
                    <span className="kp-catalog-item-copy">
                      <strong>{option.product.name}</strong>
                      <span>{[variantMeta, option.supplier.name].filter(Boolean).join(' · ')}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="kp-product-inspector">
            {selectedCatalogOption ? (
              <>
                <div className="kp-product-title">
                  <div className="kp-product-hero">
                    {selectedCatalogOption.product.imageUrl ? (
                      <img
                        className="kp-constructor-product-image"
                        src={selectedCatalogOption.product.imageUrl}
                        alt={selectedCatalogOption.product.name}
                        loading="lazy"
                      />
                    ) : null}
                    <div>
                      <span>{selectedCatalogOption.product.category}</span>
                      <div className="kp-product-title-row">
                        <h3>{selectedCatalogOption.product.name}</h3>
                        {selectedCatalogProductUrl ? (
                          <a
                            className="kp-product-link"
                            href={selectedCatalogProductUrl}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="Открыть выбранный товар на сайте Вертикаль"
                            title="Открыть выбранный товар на сайте Вертикаль"
                          >
                            <ExternalLink size={14} />
                            <span>Вертикаль</span>
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <p>{selectedCatalogOption.product.description}</p>
                </div>

                <div className="kp-product-facts">
                  <article>
                    <span>Поставщик</span>
                    <strong>{selectedCatalogOption.supplier.name}</strong>
                    <small>{selectedCatalogOption.supplier.updateNote}</small>
                  </article>
                  <article>
                    <span>Вариант</span>
                    <strong>{selectedCatalogOption.variant.variantName}</strong>
                    <small>{getVariantDetailLabel(selectedCatalogOption.variant)}</small>
                  </article>
                  <article>
                    <span>Наличие</span>
                    <strong>{selectedCatalogOption.variant.availability || selectedCatalogOption.product.availability}</strong>
                    <small>обновлено {formatDateLabel(selectedCatalogOption.variant.updatedAt.slice(0, 10))}</small>
                  </article>
                </div>

                <div className="kp-product-price-grid">
                  <label>
                    <span>Количество</span>
                    <input
                      type="number"
                      min={1}
                      value={constructorQty}
                      onChange={(event) => setConstructorQty(Math.max(1, Math.round(Number(event.target.value) || 1)))}
                    />
                  </label>
                  <label>
                    <span>Цена продажи в КП</span>
                    <input
                      inputMode="decimal"
                      value={constructorSalePrice}
                      onChange={(event) => updateConstructorSalePrice(event.target.value)}
                      placeholder="введите вручную"
                    />
                  </label>
                  <article>
                    <span>Закупка за ед.</span>
                    <strong>{formatMoney(selectedCatalogOption.variant.purchasePrice)}</strong>
                  </article>
                </div>

                <div className="kp-product-add-row">
                  <button
                    type="button"
                    className="icon-button primary kp-product-add-button"
                    onClick={handleAddCatalogProduct}
                    disabled={!selectedCatalogOption}
                  >
                    <Plus size={15} />
                    <span>Добавить</span>
                  </button>
                </div>

              </>
            ) : (
              <div className="kp-product-empty">
                <Building2 size={22} />
                <strong>Каталог пуст</strong>
                <span>Добавьте пустую строку и заполните КП вручную.</span>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  )

  const renderWork = () => (
    <>
      {downloadToast ? (
        <div className="download-toast" role="status" aria-live="polite">
          <Save size={18} aria-hidden="true" />
          <div>
            <strong>{downloadToast.title}</strong>
            <span>{downloadToast.fileName}</span>
          </div>
          <button type="button" aria-label="Закрыть уведомление" onClick={() => setDownloadToast(null)}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <section className="editor-header kp-document-work-tile" style={documentWorkTileStyle}>
        <div className="kp-document-work-summary">
          <div>
            <h1>Документ в работе: КП {exportForm.documentNumber || '1-В'}</h1>
          </div>

          <div className="editor-total">
            <span>Общая сумма</span>
            <strong>{formatMoney(total)}</strong>
          </div>
          {renderDocumentActions('kp-document-header-actions')}
        </div>

        {renderDocumentControls('kp-document-top-controls')}
        {renderDocumentStatus()}
      </section>

      {projectDeal ? (
        <section className="kp-project-context" aria-label="Контекст проекта">
          <article>
            <span>Проект</span>
            <strong>{projectDeal.number} · {projectDeal.title}</strong>
            <small>{projectDeal.description || 'Описание проекта не заполнено'}</small>
          </article>
          <article>
            <span>Контрагент</span>
            <strong>{projectCounterparty?.shortName ?? 'не указан'}</strong>
            <small>
              ИНН {projectCounterparty?.inn || 'не указан'} · КПП {projectCounterparty?.kpp || 'не указан'}
            </small>
          </article>
          <article>
            <span>Объект</span>
            <strong>{projectObject?.name ?? 'не указан'}</strong>
            <small>{projectObject?.address ?? 'адрес не указан'}</small>
          </article>
          <article>
            <span>Документы</span>
            <strong>{projectDocuments.length} вложений</strong>
            <small>{projectDocuments[0]?.title ?? 'КП будет прикреплено после сохранения'}</small>
          </article>
        </section>
      ) : null}

      <KpOfferTableEditor
        offerTable={draft.offerTable}
        fields={draft.fields}
        cellAnnotations={draft.cellAnnotations}
        editable
        documentDate={exportForm.documentDate}
        documentNumber={exportForm.documentNumber}
        recipientName={exportForm.counterpartyName}
        validityDays={settings.validityDays}
        vatRate={settings.vatRate}
        showOperatorColumns={settings.showOperatorColumns}
        operatorPanel={renderConstructorWorkspace()}
        workspaceAlign="start"
        onPagePreviewWidthChange={handlePagePreviewWidthChange}
        onUpdateOfferItem={updateOfferItem}
        onDeleteOfferItem={deleteOfferItem}
      />

      {isConstructorModalOpen ? (
        <div
          className="kp-constructor-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsConstructorModalOpen(false)
            }
          }}
        >
          <section className="kp-constructor-modal" role="dialog" aria-modal="true" aria-label="Развернутый конструктор КП">
            <header className="kp-constructor-modal-head">
              <div>
                <span>Расширенный режим</span>
                <h2>Конструктор КП</h2>
              </div>
              <button
                type="button"
                className="kp-constructor-modal-close"
                onClick={() => setIsConstructorModalOpen(false)}
                aria-label="Закрыть конструктор КП"
                title="Закрыть"
              >
                <X size={18} />
              </button>
            </header>
            <div className="kp-constructor-modal-body">
              {renderConstructorWorkspace('modal')}
            </div>
          </section>
        </div>
      ) : null}
    </>
  )

  return (
    <div className={`app-shell ${activeView === 'work' ? 'app-shell-work' : ''} ${darkTheme ? 'is-dark' : ''} ${embedded ? 'is-embedded' : ''}`}>
      {!embedded && activeView !== 'home' ? (
        <header className="topbar">
          <nav className="nav" aria-label="Разделы">
            <button
              type="button"
              className="nav-link"
              onClick={() => navigateToView('home')}
            >
              Главная
            </button>
            <button
              type="button"
              className={`nav-link ${activeView === 'history' ? 'active' : ''}`}
              onClick={() => navigateToView('history')}
            >
              История
            </button>
            <button
              type="button"
              className={`nav-link ${activeView === 'settings' ? 'active' : ''}`}
              onClick={() => navigateToView('settings')}
            >
              Настройки
            </button>
          </nav>
        </header>
      ) : null}

      <main className={`page ${activeView === 'home' ? 'page-home' : ''} ${activeView === 'work' ? 'page-work' : ''}`}>
        {activeView === 'home' ? renderHome() : null}
        {activeView === 'work' ? renderWork() : null}
        {activeView === 'history' ? renderHistory() : null}
        {activeView === 'settings' ? renderSettings() : null}
      </main>

    </div>
  )
}
