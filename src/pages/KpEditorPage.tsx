import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'
import {
  ArrowRight,
  CalendarDays,
  Eye,
  FileText,
  Hash,
  History,
  Loader2,
  Paperclip,
  RotateCcw,
  Save,
  Settings2,
  Sparkles,
  X,
} from 'lucide-react'
import { KpOfferTableEditor } from '../components/KpOfferTableEditor'
import { useDemo } from '../context/DemoContext'
import { getKpDemoScenarios, type KpDemoScenario } from '../data/demoData'
import { downloadKpDoc, openSavedKpDoc, type KpDocumentProgress, type SavedKpDocument } from '../lib/kpDocument'
import {
  addCalendarDays,
  formatMoney,
  getOfferSaleTotal,
  getVatFromGross,
  kpVatRate,
  kpValidityDays,
} from '../lib/kpFormatting'

type KpView = 'home' | 'work' | 'history' | 'settings'
type HistoryMode = 'push' | 'replace'

interface KpHistoryEntry {
  id: string
  title?: string
  number: string
  date: string
  customer: string
  total: number
  source: string
}

const historyStorageKey = 'nuoperator-kp-history-v1'
const settingsStorageKey = 'nuoperator-kp-settings-v1'
const kpDemoScenarios = getKpDemoScenarios()

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

function resolveKpView(value: string | null): KpView {
  return value === 'work' || value === 'history' || value === 'settings' ? value : 'home'
}

function getInitialView(): KpView {
  if (typeof window === 'undefined') {
    return 'home'
  }

  return resolveKpView(new URLSearchParams(window.location.search).get('view'))
}

function getInitialRequestModal() {
  if (typeof window === 'undefined') {
    return false
  }

  return new URLSearchParams(window.location.search).get('request') === 'new'
}

function getKpViewUrl(view: KpView, requestModal: boolean) {
  const url = new URL(window.location.href)

  if (view === 'home') {
    url.searchParams.delete('view')
  } else {
    url.searchParams.set('view', view)
  }

  if (requestModal) {
    url.searchParams.set('request', 'new')
  } else {
    url.searchParams.delete('request')
  }

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

export function KpEditorPage() {
  const {
    state: { draft, exportForm },
    updateExportField,
    applyKpOfferTable,
    updateOfferItem,
    deleteOfferItem,
  } = useDemo()
  const [activeView, setActiveView] = useState<KpView>(getInitialView)
  const [isGeneratingWord, setIsGeneratingWord] = useState(false)
  const [isOpeningWord, setIsOpeningWord] = useState(false)
  const [wordProgress, setWordProgress] = useState<KpDocumentProgress | null>(null)
  const [lastSavedDoc, setLastSavedDoc] = useState<SavedKpDocument | null>(null)
  const [generationMessage, setGenerationMessage] = useState<string | null>(null)
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(getInitialRequestModal)
  const [requestText, setRequestText] = useState('')
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null)
  const [isFlowGenerating, setIsFlowGenerating] = useState(false)
  const [flowProgress, setFlowProgress] = useState(0)
  const [settings, setSettings] = useState<KpEditorSettings>(loadKpSettings)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const total = useMemo(() => getOfferSaleTotal(draft.offerTable), [draft.offerTable])
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

  const writeNavigationState = useCallback((view: KpView, requestModal: boolean, mode: HistoryMode) => {
    if (typeof window === 'undefined') {
      return
    }

    const nextUrl = getKpViewUrl(view, requestModal)
    const state = { view, requestModal }

    if (mode === 'replace') {
      window.history.replaceState(state, '', nextUrl)
    } else {
      window.history.pushState(state, '', nextUrl)
    }
  }, [])

  const navigateToView = useCallback(
    (view: KpView, mode: HistoryMode = 'push') => {
      setActiveView(view)
      setIsRequestModalOpen(false)
      writeNavigationState(view, false, mode)
    },
    [writeNavigationState],
  )

  const openRequestModal = useCallback(() => {
    setIsRequestModalOpen(true)
    setGenerationMessage(null)
    writeNavigationState(activeView, true, 'push')
  }, [activeView, writeNavigationState])

  const closeRequestModal = useCallback(() => {
    setIsRequestModalOpen(false)
    writeNavigationState(activeView, false, 'replace')
  }, [activeView, writeNavigationState])

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
    if (typeof window === 'undefined') {
      return undefined
    }

    writeNavigationState(getInitialView(), getInitialRequestModal(), 'replace')

    const handlePopState = () => {
      setActiveView(getInitialView())
      setIsRequestModalOpen(getInitialRequestModal())
      setIsFlowGenerating(false)
    }

    window.addEventListener('popstate', handlePopState)

    return () => window.removeEventListener('popstate', handlePopState)
  }, [writeNavigationState])

  useEffect(() => {
    if (!isFlowGenerating) {
      return undefined
    }

    let finishTimeout: number | undefined
    let finishScheduled = false

    const intervalId = window.setInterval(() => {
      setFlowProgress((current) => {
        const increment = current < 48 ? 11 : current < 82 ? 7 : 4
        const next = Math.min(100, current + increment)

        if (next >= 100 && !finishScheduled) {
          finishScheduled = true
          window.clearInterval(intervalId)
          finishTimeout = window.setTimeout(() => {
            addCurrentKpToHistory('Сформировано из заявки')
            setIsFlowGenerating(false)
            navigateToView('work')
            setGenerationMessage('Документы сформированы. Проверьте рабочую таблицу КП.')
          }, 520)
        }

        return next
      })
    }, 140)

    return () => {
      window.clearInterval(intervalId)
      if (finishTimeout) {
        window.clearTimeout(finishTimeout)
      }
    }
  }, [addCurrentKpToHistory, isFlowGenerating, navigateToView])

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
    setWordProgress({ percent: 0, message: 'Подготовка DOC-файла' })
    setGenerationMessage(null)

    try {
      const result = await downloadKpDoc(makeKpDocumentPayload(), setWordProgress)
      setLastSavedDoc(result)
      addCurrentKpToHistory('DOC-файл')
      setGenerationMessage(
        result.usedSavePicker
          ? `DOC-файл сохранён: ${result.fileName}`
          : `DOC-файл сформирован: ${result.fileName}. Если браузер не спросил папку, файл ушёл в загрузки.`,
      )
    } catch (error) {
      const isCancel = error instanceof DOMException && error.name === 'AbortError'
      const message =
        isCancel
          ? 'Сохранение DOC-файла отменено.'
          : error instanceof Error
            ? error.message
            : 'Не удалось сформировать DOC-файл.'
      setGenerationMessage(message)
    } finally {
      setIsGeneratingWord(false)
      window.setTimeout(() => setWordProgress(null), 900)
    }
  }

  const handleOpenDocument = async () => {
    if (!lastSavedDoc) {
      setGenerationMessage('Сначала сохраните DOC-файл, потом его можно открыть этой кнопкой.')
      return
    }

    setIsOpeningWord(true)
    setWordProgress({ percent: 0, message: 'Открываем сохранённый DOC-файл' })
    setGenerationMessage(null)

    try {
      const result = await openSavedKpDoc(lastSavedDoc, setWordProgress)
      addCurrentKpToHistory('DOC-файл открыт')
      setGenerationMessage(
        `Открываем уже сохранённый DOC-файл: ${result.fileName}. Если Word не открылся автоматически, откройте файл через Word.`,
      )
    } catch (error) {
      setGenerationMessage(error instanceof Error ? error.message : 'Не удалось открыть DOC-файл.')
    } finally {
      setIsOpeningWord(false)
      window.setTimeout(() => setWordProgress(null), 900)
    }
  }

  const handleSave = () => {
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

  const handleDemoRequest = (scenario: KpDemoScenario) => {
    setRequestText(scenario.requestText)
    applyKpOfferTable(scenario.offerTable)
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    setAttachedFileName(file?.name ?? null)
  }

  const handleGenerateFromRequest = () => {
    if (!requestText.trim() && !attachedFileName) {
      return
    }

    applyAutomaticSettingsForNewDocument()
    setIsRequestModalOpen(false)
    writeNavigationState(activeView, false, 'replace')
    setFlowProgress(0)
    setIsFlowGenerating(true)
  }

  const renderHome = () => (
    <section className="home-shell" aria-label="Главная">
      <div className="home-title">
        <h1>Коммерческие предложения</h1>
      </div>

      <div className="home-actions">
        <button type="button" className="home-button primary-home" onClick={openRequestModal}>
          <span>Создать</span>
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
        <button type="button" className="icon-button primary" onClick={openRequestModal}>
          <span>Создать</span>
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
          <p>Создайте КП из заявки или сохраните рабочую таблицу, и запись появится здесь.</p>
          <button type="button" className="icon-button primary" onClick={openRequestModal}>
            <span>Создать КП</span>
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

  const renderWork = () => (
    <>
      <section className="editor-header">
        <div>
          <h1>Документ в работе: КП {exportForm.documentNumber || '1-В'}</h1>
        </div>

        <div className="editor-total">
          <span>Общая сумма</span>
          <strong>{formatMoney(total)}</strong>
        </div>
      </section>

      <section className="document-controls" aria-label="Поля коммерческого предложения">
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

        <div className="document-actions">
          <button type="button" className="icon-button secondary" onClick={handleSave}>
            <span>Сохранить</span>
          </button>
          <button
            type="button"
            className="icon-button primary"
            onClick={handleDownload}
            disabled={isGeneratingWord || isOpeningWord}
            title="Сохранить DOC"
          >
            <span>{isGeneratingWord ? 'Генерация...' : 'Сохранить DOC'}</span>
          </button>
          <button
            type="button"
            className="icon-button secondary"
            onClick={handleOpenDocument}
            disabled={isGeneratingWord || isOpeningWord}
            title={lastSavedDoc ? 'Открыть сохранённый DOC' : 'Сначала сохраните DOC'}
          >
            <span>{isOpeningWord ? 'Открытие...' : 'Открыть'}</span>
          </button>
        </div>
      </section>

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
        onUpdateOfferItem={updateOfferItem}
        onDeleteOfferItem={deleteOfferItem}
      />
    </>
  )

  return (
    <div className={`app-shell ${activeView === 'work' ? 'app-shell-work' : ''}`}>
      {activeView !== 'home' ? (
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

      {isRequestModalOpen ? (
        <div className="kp-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="request-modal-title">
          <section className="kp-request-modal">
            <div className="request-modal-header">
              <div>
                <h2 id="request-modal-title">Новая заявка</h2>
                <p>
                  Вставьте только позиции, которые нужно закупить, или прикрепите документ с
                  перечнем товаров. Без заказчика, объекта, условий и прочих реквизитов.
                </p>
              </div>
              <button
                type="button"
                className="modal-close"
                aria-label="Закрыть"
                onClick={closeRequestModal}
              >
                <X size={20} />
              </button>
            </div>

            <textarea
              className="request-textarea"
              value={requestText}
              onChange={(event) => setRequestText(event.target.value)}
              placeholder="Вставьте сюда только закупаемые позиции: наименование, количество, единицы измерения..."
            />

            <div className="request-modal-footer">
              <input
                ref={fileInputRef}
                className="request-file-input"
                type="file"
                accept=".doc,.docx,.pdf,.txt,.xlsx,.xls"
                onChange={handleFileChange}
              />

              <div className="request-attach-group">
                <button
                  type="button"
                  className="request-upload-button"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip size={18} />
                  <span>Прикрепить документ</span>
                </button>
                {attachedFileName ? (
                  <span className="attached-file">
                    <FileText size={16} />
                    {attachedFileName}
                  </span>
                ) : null}
              </div>

              <div className="request-actions">
                <div className="request-demo-buttons" aria-label="Демо-заявки">
                  {kpDemoScenarios.map((scenario, index) => (
                    <button
                      key={scenario.id}
                      type="button"
                      className="icon-button secondary"
                      onClick={() => handleDemoRequest(scenario)}
                      title={scenario.title}
                    >
                      <Sparkles size={16} />
                      <span>Демо {index + 1}</span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="icon-button primary"
                  onClick={handleGenerateFromRequest}
                  disabled={!requestText.trim() && !attachedFileName}
                >
                  <span>Далее</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {isFlowGenerating ? (
        <div className="kp-modal-backdrop loading-backdrop" role="dialog" aria-modal="true">
          <section className="kp-loading-modal" aria-label="Генерация документов">
            <div className="loading-spinner">
              <Loader2 size={34} />
            </div>
            <h2>Генерация документов</h2>
            <p>Разбираем заявку, сопоставляем позиции и собираем рабочую таблицу КП.</p>
            <div className="loading-progress" aria-label={`Готово ${flowProgress}%`}>
              <span style={{ width: `${flowProgress}%` }} />
            </div>
            <strong>{flowProgress}%</strong>
          </section>
        </div>
      ) : null}
    </div>
  )
}
