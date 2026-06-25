import { Fragment, useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  DatabaseBackup,
  Download,
  Eye,
  ExternalLink,
  FileText,
  KeyRound,
  LayoutDashboard,
  Moon,
  PackageSearch,
  Pencil,
  Plus,
  ReceiptText,
  RefreshCw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Sun,
  Trash2,
  UserCog,
  WifiOff,
  Wrench,
  X,
} from 'lucide-react'
import {
  dealStatusLabels,
  formatBytes,
  formatDate,
  formatDateTime,
  formatMoney,
  formatMoneyCompact,
  getDealDocuments,
  getDealPayments,
  getDealQuotes,
  getDealTasks,
  getPaymentDue,
  getQuoteMargin,
  getQuoteMarginPercent,
  getQuotePurchaseTotal,
  getQuoteSaleTotal,
  getUserName,
  getVariantBundle,
  isPaymentOverdue,
  objectStatusLabels,
  paymentStatusLabels,
  quoteStatusLabels,
} from '../crm/analytics'
import { demoRoleConfig, type DemoRole } from '../crm/auth'
import { demoTodayIso } from '../crm/mockData'
import {
  addQuoteItemFromVariant,
  loadCrmState,
  markPaymentPaid,
  saveCrmState,
  updateQuoteItemQty,
  updateQuoteItemSalePrice,
} from '../crm/demoStore'
import type {
  ActivityLog,
  ContactPerson,
  Counterparty,
  CrmState,
  Deal,
  DocumentRecord,
  InstallerNote,
  Payment,
  PriceHistory,
  ProductVariant,
  Quote,
  Supplier,
  SupplierProduct,
  TaskRecord,
  WorkObject,
} from '../crm/types'

interface CrmSystemPageProps {
  authRole: DemoRole
  darkTheme: boolean
  onThemeToggle: () => void
  routeFilter?: WorkFilterId
  routeModule?: SidebarModuleId
  showKpEditor?: boolean
  kpEditor?: ReactNode
  onRouteChange?: (module: SidebarModuleId, filter: WorkFilterId) => void
  onOpenKpEditor: (dealId?: string) => void
  onLogout: () => void
}

type Tone = 'blue' | 'green' | 'amber' | 'red' | 'slate' | 'violet' | 'teal'
export type SidebarModuleId =
  | 'overview'
  | 'projects'
  | 'counterparties'
  | 'objects'
  | 'deals'
  | 'quotes'
  | 'catalog'
  | 'suppliers'
  | 'payments'
  | 'documents'
  | 'tasks'
  | 'analytics'
  | 'settings'
export type WorkFilterId =
  | 'all'
  | 'overdue'
  | 'due'
  | 'urgent'
  | 'withoutQuote'
  | 'installation'
  | 'documents'
  | 'tasks'
  | 'closed'
type CatalogAvailabilityFilter = 'all' | 'stock' | 'order' | 'check'
type ProjectAmountFilter = 'all' | 'under250' | 'from250to1000' | 'over1000'
type ProjectNextActionFilter = 'all' | 'overdue' | 'today' | 'week' | 'month' | 'empty'
type ProjectQuoteFilter = 'all' | 'missing' | 'draft' | 'sent' | 'accepted'
type ProjectDocumentFilter = 'all' | 'hasDocuments' | 'missingContract' | 'hasInvoice'
type ProjectTaskFilter = 'all' | 'hasOpen' | 'urgent'

interface ProjectAdvancedFilters {
  status: 'all' | Deal['status']
  payment: 'all' | Payment['status']
  quote: ProjectQuoteFilter
  responsibleUserId: 'all' | string
  amount: ProjectAmountFilter
  nextAction: ProjectNextActionFilter
  documents: ProjectDocumentFilter
  tasks: ProjectTaskFilter
}

interface ProjectCreateDraft {
  projectTitle: string
  counterpartyName: string
  counterpartyInn: string
  counterpartyPhone: string
  counterpartyEmail: string
  legalAddress: string
  contactName: string
  contactPosition: string
  contactPhone: string
  contactEmail: string
  objectName: string
  objectAddress: string
  description: string
  source: string
  expectedAmount: string
  status: Deal['status']
  paymentStatus: Payment['status']
  responsibleUserId: string
  nextActionText: string
  nextActionAt: string
  comment: string
}

interface WorkRecord {
  deal: Deal
  counterparty?: Counterparty
  object?: WorkObject
  quotes: Quote[]
  payments: Payment[]
  documents: DocumentRecord[]
  reminders: TaskRecord[]
  notes: InstallerNote[]
  dueAmount: number
  overdueAmount: number
  quoteTotal: number
  activityCount: number
}

type ProjectPreviewDocumentKind = 'pdf' | 'word' | 'excel' | 'image' | 'file'

interface ProjectPreviewDocument {
  id: string
  title: string
  fileName: string
  kind: ProjectPreviewDocumentKind
  typeLabel: string
  summary: string
  issuedAt: string
  statusLabel?: string
  amountLabel?: string
  sizeBytes?: number
}

interface ProjectInlineContact {
  id: string
  fullName: string
  phone: string
  position: string
}

interface ProjectInlineDocumentDraft {
  id: string
  title: string
}

interface ProjectInlineDraft {
  projectTitle: string
  expectedAmount: string
  source: string
  status: Deal['status']
  paymentStatus: Payment['status']
  nextActionText: string
  nextActionAt: string
  counterpartyName: string
  counterpartyInn: string
  workAddress: string
  objectName: string
  legalAddress: string
  contacts: ProjectInlineContact[]
  invoiceSummary: string
  invoiceDocuments: ProjectInlineDocumentDraft[]
  projectDocuments: ProjectInlineDocumentDraft[]
  comment: string
}

interface CounterpartyRecord {
  counterparty: Counterparty
  contacts: ContactPerson[]
  objects: WorkObject[]
  deals: Deal[]
  documents: DocumentRecord[]
  contracts: DocumentRecord[]
  payments: Payment[]
  quotes: Quote[]
  activity: ActivityLog[]
}

interface CatalogRecord {
  product: SupplierProduct
  variant: ProductVariant
  supplier?: Supplier
  priceHistory: PriceHistory[]
}

interface ManagerAnalyticsRow {
  userId: string
  name: string
  role: string
  projects: number
  activeProjects: number
  quotes: number
  pipeline: number
  quoteTotal: number
  due: number
  tasks: number
}

interface OverviewLatestItem {
  id: string
  kind: 'notification' | 'action'
  title: string
  details: string
  meta: string
  createdAt: string
}

const sidebarNotificationStoragePrefix = 'nuoperator:sidebar-notifications'

function getSidebarNotificationStorageKey(userId: string, kind: 'read' | 'cleared') {
  return `${sidebarNotificationStoragePrefix}:${userId}:${kind}`
}

function loadStoredIdList(key: string) {
  if (typeof window === 'undefined') return []

  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function saveStoredIdList(key: string, ids: string[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(key, JSON.stringify(ids))
}

function mergeIdLists(current: string[], incoming: string[]) {
  return [...new Set([...current, ...incoming])]
}

interface PaymentAnalyticsRow {
  status: Payment['status']
  label: string
  count: number
  amount: number
  due: number
  percent: number
  tone: Tone
}

type ProjectTableStatusTone = 'new' | 'quote' | 'installation' | 'payment' | 'overdue' | 'completed'

interface ProjectTableStatus {
  label: string
  tone: ProjectTableStatusTone
}

function getProjectTableStatus(record: WorkRecord): ProjectTableStatus {
  if (record.overdueAmount > 0 || record.deal.paymentStatus === 'overdue') {
    return { label: 'просрочка оплаты', tone: 'overdue' }
  }

  if (
    record.deal.status === 'closed_won' ||
    record.deal.status === 'closed_lost' ||
    record.deal.status === 'paid' ||
    record.deal.paymentStatus === 'paid'
  ) {
    return { label: 'Завершено', tone: 'completed' }
  }

  if (record.deal.status === 'installation' || record.object?.status === 'installation') {
    return { label: 'Монтаж', tone: 'installation' }
  }

  if (
    record.deal.status === 'awaiting_payment' ||
    record.deal.paymentStatus === 'awaiting_payment' ||
    record.deal.paymentStatus === 'partially_paid' ||
    record.deal.paymentStatus === 'invoice_issued'
  ) {
    return { label: 'ожидание оплаты', tone: 'payment' }
  }

  if (
    record.deal.status === 'quote_preparation' ||
    record.deal.status === 'quote_ready' ||
    record.deal.status === 'quote_sent' ||
    record.deal.status === 'negotiation' ||
    record.deal.status === 'contract' ||
    record.quotes.length > 0
  ) {
    return { label: 'направлено КП', tone: 'quote' }
  }

  return { label: 'Новое', tone: 'new' }
}

const workFilterLabels: Record<WorkFilterId, string> = {
  all: 'Все проекты',
  overdue: 'Просрочки',
  due: 'Требуют оплаты',
  urgent: 'Срочные действия',
  withoutQuote: 'Без КП',
  installation: 'Монтаж',
  documents: 'С документами',
  tasks: 'С задачами',
  closed: 'Закрытые',
}

const counterpartyStatusLabels: Record<Counterparty['status'], string> = {
  active: 'Активный',
  lead: 'Новый',
  paused: 'Пауза',
  archive: 'Архив',
}

const counterpartyTypeLabels: Record<Counterparty['type'], string> = {
  organization: 'Юридическое лицо',
  person: 'Физическое лицо',
  ip: 'Индивидуальный предприниматель',
}

const catalogAvailabilityLabels: Record<CatalogAvailabilityFilter, string> = {
  all: 'Все позиции',
  stock: 'В наличии',
  order: 'Под заказ',
  check: 'Требуют проверки',
}

const defaultProjectAdvancedFilters: ProjectAdvancedFilters = {
  status: 'all',
  payment: 'all',
  quote: 'all',
  responsibleUserId: 'all',
  amount: 'all',
  nextAction: 'all',
  documents: 'all',
  tasks: 'all',
}

function createDefaultProjectDraft(currentUserId: string): ProjectCreateDraft {
  return {
    projectTitle: '',
    counterpartyName: '',
    counterpartyInn: '',
    counterpartyPhone: '',
    counterpartyEmail: '',
    legalAddress: '',
    contactName: '',
    contactPosition: '',
    contactPhone: '',
    contactEmail: '',
    objectName: '',
    objectAddress: '',
    description: '',
    source: '',
    expectedAmount: '',
    status: 'new',
    paymentStatus: 'invoice_not_issued',
    responsibleUserId: currentUserId,
    nextActionText: '',
    nextActionAt: '',
    comment: '',
  }
}

function makeProjectEntityId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeCreateSingleLine(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function normalizeCreateText(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function parseProjectAmount(value: string) {
  const normalized = value
    .replace(/\s+/g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '')
  const amount = Number(normalized)

  return Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0
}

function dateTimeInputToIso(value: string) {
  if (!value) {
    return ''
  }

  const date = value ? new Date(value) : new Date()

  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}

function isoToDateTimeInput(value: string) {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const offsetMs = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

function getCounterpartyShortName(name: string) {
  const cleaned = name
    .replace(/^(ооо|ао|пао|зао|ано|мбоу|мбдоу|гбу|ип)\s+/i, '')
    .replace(/[«»"]/g, '')
    .trim()

  return cleaned || name
}

function getObjectStatusForDeal(status: Deal['status']): WorkObject['status'] {
  if (status === 'installation') return 'installation'
  if (status === 'closed_won' || status === 'closed_lost') return 'closed'
  if (status === 'contract' || status === 'awaiting_payment' || status === 'paid') return 'contract'
  if (status === 'quote_preparation' || status === 'quote_ready' || status === 'quote_sent' || status === 'negotiation') {
    return 'quote'
  }

  return 'survey'
}

function makeNextProjectNumber(state: CrmState) {
  const year = new Date().getFullYear()
  const nextNumber =
    state.deals.reduce((max, deal) => {
      const match = deal.number.match(/(\d+)$/)
      return match ? Math.max(max, Number(match[1])) : max
    }, 0) + 1

  return `SD-${year}-${String(nextNumber).padStart(4, '0')}`
}

function appendCreatedProject(
  state: CrmState,
  draft: ProjectCreateDraft,
  currentUserId: string,
  dealId: string,
): CrmState {
  const now = new Date().toISOString()
  const counterpartyId = makeProjectEntityId('cp')
  const objectId = makeProjectEntityId('obj')
  const contactId = makeProjectEntityId('contact')
  const taskId = makeProjectEntityId('task')
  const activityId = makeProjectEntityId('act')
  const responsibleUserId = state.users.some((user) => user.id === draft.responsibleUserId)
    ? draft.responsibleUserId
    : currentUserId
  const counterpartyName = normalizeCreateSingleLine(draft.counterpartyName)
  const objectName = normalizeCreateSingleLine(draft.objectName)
  const objectAddress = normalizeCreateSingleLine(draft.objectAddress)
  const projectTitle = normalizeCreateSingleLine(draft.projectTitle)
  const description = normalizeCreateText(draft.description)
  const comment = normalizeCreateText(draft.comment)
  const nextActionText = normalizeCreateSingleLine(draft.nextActionText)
  const expectedAmount = parseProjectAmount(draft.expectedAmount)
  const nextActionAt = dateTimeInputToIso(draft.nextActionAt)
  const contactName = normalizeCreateSingleLine(draft.contactName)
  const contactPhone = normalizeCreateSingleLine(draft.contactPhone)
  const contactEmail = normalizeCreateSingleLine(draft.contactEmail)
  const contactPosition = normalizeCreateSingleLine(draft.contactPosition)

  const counterparty: Counterparty = {
    id: counterpartyId,
    type: 'organization',
    name: counterpartyName,
    shortName: getCounterpartyShortName(counterpartyName),
    inn: normalizeCreateSingleLine(draft.counterpartyInn),
    kpp: '',
    ogrn: '',
    phone: normalizeCreateSingleLine(draft.counterpartyPhone) || contactPhone,
    email: normalizeCreateSingleLine(draft.counterpartyEmail) || contactEmail,
    website: '',
    legalAddress: normalizeCreateSingleLine(draft.legalAddress),
    actualAddress: objectAddress,
    comment,
    responsibleUserId,
    status: 'lead',
    createdAt: now,
    updatedAt: now,
  }
  const object: WorkObject = {
    id: objectId,
    counterpartyId,
    name: objectName,
    address: objectAddress,
    geoLat: null,
    geoLng: null,
    responsibleManagerId: responsibleUserId,
    assignedInstallerId: '',
    status: getObjectStatusForDeal(draft.status),
    comment: description,
    importantNotes: nextActionText,
    createdAt: now,
    updatedAt: now,
  }
  const deal: Deal = {
    id: dealId,
    number: makeNextProjectNumber(state),
    counterpartyId,
    objectId,
    responsibleUserId,
    status: draft.status,
    paymentStatus: draft.paymentStatus,
    title: projectTitle,
    description,
    source: normalizeCreateSingleLine(draft.source),
    expectedAmount,
    actualAmount: draft.paymentStatus === 'paid' ? expectedAmount : 0,
    nextActionText,
    nextActionAt,
    createdAt: now,
    updatedAt: now,
    closedAt: draft.status === 'closed_won' || draft.status === 'closed_lost' ? now : null,
    inlineComment: comment,
  }
  const contacts: ContactPerson[] = contactName || contactPhone || contactEmail
    ? [
        {
          id: contactId,
          counterpartyId,
          fullName: contactName || 'Контактное лицо',
          position: contactPosition || 'Контакт по проекту',
          phone: contactPhone,
          email: contactEmail,
          messenger: '',
          comment: 'Добавлено при создании проекта.',
          isPrimary: true,
        },
      ]
    : []
  const tasks: TaskRecord[] = nextActionText
    ? [
        {
          id: taskId,
          title: nextActionText,
          description,
          type: 'manual',
          status: 'open',
          priority: 'normal',
          dueAt: nextActionAt || now,
          assignedToUserId: responsibleUserId,
          createdByUserId: currentUserId,
          counterpartyId,
          dealId,
          objectId,
          paymentId: null,
          createdAt: now,
          updatedAt: now,
          closedAt: null,
        },
      ]
    : []
  const activity: ActivityLog = {
    id: activityId,
    actorUserId: currentUserId,
    entityType: 'deal',
    entityId: dealId,
    action: 'project.created',
    title: `Создан проект ${deal.number}`,
    details: [counterparty.shortName, projectTitle].filter(Boolean).join(': '),
    createdAt: now,
  }

  return {
    ...state,
    counterparties: [counterparty, ...state.counterparties],
    contacts: [...contacts, ...state.contacts],
    objects: [object, ...state.objects],
    deals: [deal, ...state.deals],
    tasks: [...tasks, ...state.tasks],
    activity: [activity, ...state.activity].slice(0, 80),
  }
}

function removeProjectFromState(state: CrmState, dealId: string): CrmState {
  const deal = state.deals.find((item) => item.id === dealId)

  if (!deal) {
    return state
  }

  const nextDeals = state.deals.filter((item) => item.id !== dealId)
  const shouldRemoveObject = Boolean(deal.objectId) && !nextDeals.some((item) => item.objectId === deal.objectId)
  const shouldRemoveCounterparty =
    Boolean(deal.counterpartyId) && !nextDeals.some((item) => item.counterpartyId === deal.counterpartyId)
  const quoteIds = new Set(state.quotes.filter((quote) => quote.dealId === dealId).map((quote) => quote.id))
  const paymentIds = new Set(state.payments.filter((payment) => payment.dealId === dealId).map((payment) => payment.id))
  const documentIds = new Set(
    state.documents
      .filter(
        (document) =>
          document.dealId === dealId ||
          (document.quoteId ? quoteIds.has(document.quoteId) : false) ||
          (document.paymentId ? paymentIds.has(document.paymentId) : false),
      )
      .map((document) => document.id),
  )
  const taskIds = new Set(state.tasks.filter((task) => task.dealId === dealId).map((task) => task.id))
  const installerNoteIds = new Set(state.installerNotes.filter((note) => note.dealId === dealId).map((note) => note.id))
  const removedEntityIds = new Set([
    dealId,
    ...quoteIds,
    ...paymentIds,
    ...documentIds,
    ...taskIds,
    ...installerNoteIds,
  ])

  if (shouldRemoveObject) {
    removedEntityIds.add(deal.objectId)
  }

  if (shouldRemoveCounterparty) {
    removedEntityIds.add(deal.counterpartyId)
  }

  return {
    ...state,
    counterparties: shouldRemoveCounterparty
      ? state.counterparties.filter((counterparty) => counterparty.id !== deal.counterpartyId)
      : state.counterparties,
    contacts: shouldRemoveCounterparty
      ? state.contacts.filter((contact) => contact.counterpartyId !== deal.counterpartyId)
      : state.contacts,
    objects: shouldRemoveObject ? state.objects.filter((object) => object.id !== deal.objectId) : state.objects,
    deals: nextDeals,
    quotes: state.quotes.filter((quote) => quote.dealId !== dealId),
    documents: state.documents.filter((document) => !documentIds.has(document.id)),
    payments: state.payments.filter((payment) => payment.dealId !== dealId),
    tasks: state.tasks.filter((task) => !taskIds.has(task.id)),
    installerNotes: state.installerNotes.filter((note) => !installerNoteIds.has(note.id)),
    activity: state.activity.filter((item) => !removedEntityIds.has(item.entityId)),
  }
}

const projectQuoteFilterLabels: Record<ProjectQuoteFilter, string> = {
  all: 'Любое состояние',
  missing: 'КП не создано',
  draft: 'Черновик / готовится',
  sent: 'Отправлено клиенту',
  accepted: 'Принято клиентом',
}

const projectAmountFilterLabels: Record<ProjectAmountFilter, string> = {
  all: 'Любая сумма',
  under250: 'До 250 тыс.',
  from250to1000: '250 тыс. - 1 млн',
  over1000: 'Больше 1 млн',
}

const projectNextActionFilterLabels: Record<ProjectNextActionFilter, string> = {
  all: 'Любой срок',
  overdue: 'Просрочено',
  today: 'Сегодня',
  week: 'Ближайшие 7 дней',
  month: 'Ближайшие 30 дней',
  empty: 'Без следующего шага',
}

const projectDocumentFilterLabels: Record<ProjectDocumentFilter, string> = {
  all: 'Любые документы',
  hasDocuments: 'Есть вложения',
  missingContract: 'Нет договора',
  hasInvoice: 'Есть счет',
}

const projectTaskFilterLabels: Record<ProjectTaskFilter, string> = {
  all: 'Любые задачи',
  hasOpen: 'Есть открытые',
  urgent: 'Срочные задачи',
}

const sidebarModuleTitles: Record<SidebarModuleId, string> = {
  overview: 'Главная',
  projects: 'Проекты',
  counterparties: 'Контрагенты',
  objects: 'Объекты',
  deals: 'Сделки',
  quotes: 'КП',
  catalog: 'Каталог',
  suppliers: 'Поставщики',
  payments: 'Оплаты',
  documents: 'Документы',
  tasks: 'Задачи',
  analytics: 'Аналитика',
  settings: 'Настройки',
}

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
}

function getBrowserOnlineStatus() {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

function useNetworkPresence() {
  const [isOnline, setIsOnline] = useState(getBrowserOnlineStatus)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const syncNetworkStatus = () => {
      setIsOnline(getBrowserOnlineStatus())
    }

    syncNetworkStatus()
    window.addEventListener('online', syncNetworkStatus)
    window.addEventListener('offline', syncNetworkStatus)

    return () => {
      window.removeEventListener('online', syncNetworkStatus)
      window.removeEventListener('offline', syncNetworkStatus)
    }
  }, [])

  return isOnline
}

function getPrimaryContact(state: CrmState, counterpartyId: string) {
  return (
    state.contacts.find((contact) => contact.counterpartyId === counterpartyId && contact.isPrimary) ??
    state.contacts.find((contact) => contact.counterpartyId === counterpartyId)
  )
}

function relativeAction(value: string) {
  if (!value) {
    return 'дата не указана'
  }

  const target = new Date(value).getTime()
  const base = new Date(`${demoTodayIso}T00:00:00.000Z`).getTime()

  if (Number.isNaN(target)) {
    return 'дата не указана'
  }

  const dayMs = 24 * 60 * 60 * 1000
  const days = Math.ceil((target - base) / dayMs)

  if (days < 0) return `просрочено ${Math.abs(days)} дн.`
  if (days === 0) return 'сегодня'
  if (days === 1) return 'завтра'
  return `через ${days} дн.`
}

function safeFormatDateTime(value: string, fallback = 'не указано') {
  if (!value) {
    return fallback
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return fallback
  }

  return formatDateTime(value)
}

function getNextActionDetail(deal: Deal) {
  const action = deal.nextActionText.trim()

  if (!action && !deal.nextActionAt) {
    return 'Следующее действие не указано.'
  }

  const relative = deal.nextActionAt ? ` (${relativeAction(deal.nextActionAt)})` : ''
  return `${action || 'Действие не указано'}. Контроль: ${safeFormatDateTime(deal.nextActionAt)}${relative}.`
}

function getNextActionSummary(deal: Deal) {
  return `${deal.nextActionText.trim() || 'не указано'} · ${relativeAction(deal.nextActionAt)}`
}

function isClosedDeal(record: WorkRecord) {
  return record.deal.status === 'closed_won' || record.deal.status === 'closed_lost'
}

function isUrgentRecord(record: WorkRecord) {
  const date = record.deal.nextActionAt.slice(0, 10)
  return Boolean(date) && date <= demoTodayIso && !isClosedDeal(record)
}

function matchesWorkFilter(record: WorkRecord, filter: WorkFilterId) {
  switch (filter) {
    case 'overdue':
      return record.overdueAmount > 0
    case 'due':
      return record.dueAmount > 0
    case 'urgent':
      return isUrgentRecord(record)
    case 'withoutQuote':
      return record.quotes.length === 0 && !isClosedDeal(record)
    case 'installation':
      return record.deal.status === 'installation' || record.object?.status === 'installation'
    case 'documents':
      return record.documents.length > 0
    case 'tasks':
      return record.reminders.some((reminder) => reminder.status !== 'done')
    case 'closed':
      return isClosedDeal(record)
    case 'all':
    default:
      return true
  }
}

function getDaysUntil(value: string) {
  if (!value) {
    return null
  }

  const target = new Date(value).getTime()
  const base = new Date(`${demoTodayIso}T00:00:00.000Z`).getTime()

  if (Number.isNaN(target)) {
    return null
  }

  return Math.ceil((target - base) / (24 * 60 * 60 * 1000))
}

function matchesAmountFilter(amount: number, filter: ProjectAmountFilter) {
  if (filter === 'under250') return amount < 250_000
  if (filter === 'from250to1000') return amount >= 250_000 && amount <= 1_000_000
  if (filter === 'over1000') return amount > 1_000_000
  return true
}

function matchesNextActionFilter(record: WorkRecord, filter: ProjectNextActionFilter) {
  if (filter === 'all') {
    return true
  }

  const days = getDaysUntil(record.deal.nextActionAt)

  if (filter === 'empty') return days === null
  if (days === null) return false
  if (filter === 'overdue') return days < 0
  if (filter === 'today') return days === 0
  if (filter === 'week') return days >= 0 && days <= 7
  if (filter === 'month') return days >= 0 && days <= 30
  return true
}

function matchesQuoteFilter(record: WorkRecord, filter: ProjectQuoteFilter) {
  if (filter === 'missing') return record.quotes.length === 0
  if (filter === 'draft') return record.quotes.some((quote) => quote.status === 'draft' || quote.status === 'ready')
  if (filter === 'sent') return record.quotes.some((quote) => quote.status === 'sent' || quote.status === 'exported')
  if (filter === 'accepted') return record.quotes.some((quote) => quote.status === 'accepted')
  return true
}

function matchesDocumentFilter(record: WorkRecord, filter: ProjectDocumentFilter) {
  if (filter === 'hasDocuments') return record.documents.length > 0
  if (filter === 'missingContract') return !record.documents.some((document) => document.type === 'contract')
  if (filter === 'hasInvoice') return record.documents.some((document) => document.type === 'invoice') || record.payments.length > 0
  return true
}

function matchesTaskFilter(record: WorkRecord, filter: ProjectTaskFilter) {
  if (filter === 'hasOpen') return record.reminders.some((reminder) => reminder.status !== 'done')
  if (filter === 'urgent') return record.reminders.some((reminder) => reminder.status !== 'done' && reminder.priority === 'urgent')
  return true
}

function matchesProjectAdvancedFilters(record: WorkRecord, filters: ProjectAdvancedFilters) {
  if (filters.status !== 'all' && record.deal.status !== filters.status) return false
  if (filters.payment !== 'all' && record.deal.paymentStatus !== filters.payment) return false
  if (filters.responsibleUserId !== 'all' && record.deal.responsibleUserId !== filters.responsibleUserId) return false
  if (!matchesQuoteFilter(record, filters.quote)) return false
  if (!matchesAmountFilter(record.deal.expectedAmount, filters.amount)) return false
  if (!matchesNextActionFilter(record, filters.nextAction)) return false
  if (!matchesDocumentFilter(record, filters.documents)) return false
  if (!matchesTaskFilter(record, filters.tasks)) return false
  return true
}

function countProjectAdvancedFilters(filters: ProjectAdvancedFilters) {
  return Object.values(filters).filter((value) => value !== 'all').length
}

function buildWorkRecords(state: CrmState): WorkRecord[] {
  return state.deals
    .map((deal) => {
      const counterparty = state.counterparties.find((item) => item.id === deal.counterpartyId)
      const object = state.objects.find((item) => item.id === deal.objectId)
      const quotes = getDealQuotes(state, deal.id)
      const payments = getDealPayments(state, deal.id)
      const documents = getDealDocuments(state, deal.id)
      const reminders = getDealTasks(state, deal.id)
      const notes = state.installerNotes.filter(
        (note) => note.dealId === deal.id || note.objectId === deal.objectId,
      )
      const relatedIds = new Set<string>([
        deal.id,
        deal.counterpartyId,
        deal.objectId,
        ...quotes.map((quote) => quote.id),
        ...payments.map((payment) => payment.id),
        ...documents.map((document) => document.id),
      ])

      return {
        deal,
        counterparty,
        object,
        quotes,
        payments,
        documents,
        reminders,
        notes,
        dueAmount: payments.reduce((sum, payment) => sum + getPaymentDue(payment), 0),
        overdueAmount: payments
          .filter(isPaymentOverdue)
          .reduce((sum, payment) => sum + getPaymentDue(payment), 0),
        quoteTotal: quotes.reduce((sum, quote) => sum + getQuoteSaleTotal(quote), 0),
        activityCount: state.activity.filter((item) => relatedIds.has(item.entityId)).length,
      }
    })
    .sort((left, right) => right.deal.updatedAt.localeCompare(left.deal.updatedAt))
}

function buildCounterpartyRecords(state: CrmState): CounterpartyRecord[] {
  return state.counterparties
    .map((counterparty) => {
      const contacts = state.contacts.filter((contact) => contact.counterpartyId === counterparty.id)
      const objects = state.objects.filter((object) => object.counterpartyId === counterparty.id)
      const deals = state.deals.filter((deal) => deal.counterpartyId === counterparty.id)
      const documents = state.documents.filter((document) => document.counterpartyId === counterparty.id)
      const payments = state.payments.filter((payment) => payment.counterpartyId === counterparty.id)
      const quotes = state.quotes.filter((quote) => quote.counterpartyId === counterparty.id)
      const contracts = documents.filter(
        (document) =>
          document.type === 'contract' ||
          /договор/i.test(`${document.title} ${document.originalFilename} ${document.comment}`),
      )
      const relatedIds = new Set<string>([
        counterparty.id,
        ...objects.map((object) => object.id),
        ...deals.map((deal) => deal.id),
        ...documents.map((document) => document.id),
        ...payments.map((payment) => payment.id),
        ...quotes.map((quote) => quote.id),
      ])
      const activity = state.activity.filter((item) => relatedIds.has(item.entityId)).slice(0, 8)

      return {
        counterparty,
        contacts,
        objects,
        deals,
        documents,
        contracts,
        payments,
        quotes,
        activity,
      }
    })
    .sort((left, right) => right.counterparty.updatedAt.localeCompare(left.counterparty.updatedAt))
}

function buildCatalogRecords(state: CrmState): CatalogRecord[] {
  const productsById = new Map(state.products.map((product) => [product.id, product]))
  const suppliersById = new Map(state.suppliers.map((supplier) => [supplier.id, supplier]))

  const records: CatalogRecord[] = []

  state.variants.forEach((variant) => {
    const product = productsById.get(variant.supplierProductId)

    if (!product) {
      return
    }

    const supplier = suppliersById.get(product.supplierId)
    const priceHistory = state.priceHistory
      .filter((item) => item.productVariantId === variant.id || item.supplierProductId === product.id)
      .sort((left, right) => right.capturedAt.localeCompare(left.capturedAt))

    records.push({
      product,
      variant,
      supplier,
      priceHistory,
    })
  })

  const demoParserRows = records.length < 24 ? buildDemoParserCatalogRows(records) : []

  return [...records, ...demoParserRows].sort((left, right) =>
    right.variant.updatedAt.localeCompare(left.variant.updatedAt),
  )
}

function normalizeCatalogText(value: string) {
  return value.toLocaleLowerCase('ru-RU').trim()
}

function getCatalogSearchText(record: CatalogRecord) {
  return normalizeCatalogText(
    [
      record.product.name,
      record.product.category,
      record.product.description,
      record.product.sku,
      record.product.externalId,
      record.variant.variantName,
      record.variant.sku,
      record.variant.size,
      record.variant.color,
      record.variant.material,
      record.supplier?.name ?? '',
      record.supplier?.code ?? '',
    ].join(' '),
  )
}

function matchesCatalogAvailability(record: CatalogRecord, filter: CatalogAvailabilityFilter) {
  if (filter === 'all') {
    return true
  }

  const text = normalizeCatalogText(
    `${record.product.availability} ${record.variant.availability} ${record.supplier?.updateStatus ?? ''} ${
      record.supplier?.updateNote ?? ''
    }`,
  )
  const needsCheck =
    record.supplier?.updateStatus !== 'fresh' ||
    /проверк|сохран|устар|needs_check|outdated/.test(text)
  const orderOnly = /под заказ|изготов/.test(text)
  const inStock = /\d/.test(text) && !needsCheck && !orderOnly

  if (filter === 'stock') return inStock
  if (filter === 'order') return orderOnly
  return needsCheck
}

function getCatalogUpdateTone(status?: Supplier['updateStatus']): Tone {
  if (status === 'fresh') return 'green'
  if (status === 'outdated') return 'amber'
  if (status === 'needs_check') return 'violet'
  return 'slate'
}

function getSupplierSourceLabel(source?: Supplier['sourceType']) {
  if (source === 'site_catalog') return 'Парсер сайта'
  if (source === 'excel') return 'Excel-прайс'
  if (source === 'manual') return 'Ручной ввод'
  return 'Источник не указан'
}

function getCatalogInitials(value: string) {
  const initials = value
    .split(/\s+/)
    .map((item) => item.slice(0, 1))
    .join('')
    .slice(0, 2)
    .toLocaleUpperCase('ru-RU')

  return initials || 'Т'
}

function getCatalogToneIndex(value: string) {
  return Array.from(value).reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % 6
}

function escapeSvgText(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function getCatalogPreviewDataUri(record: CatalogRecord) {
  const palettes = [
    ['#f2f7ff', '#cfe0ff', '#2563eb'],
    ['#f3fbfa', '#bfe8df', '#0f766e'],
    ['#f6f8fb', '#d8e1ea', '#475569'],
    ['#f7f5ff', '#ddd6fe', '#6840c6'],
    ['#fff7ed', '#fed7aa', '#b45309'],
    ['#f1f7f4', '#c7e7d2', '#15803d'],
  ] as const
  const [background, surface, accent] = palettes[getCatalogToneIndex(record.product.category)]
  const label = escapeSvgText(getCatalogInitials(record.product.category))
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="72" viewBox="0 0 96 72">
    <rect width="96" height="72" rx="10" fill="${background}"/>
    <rect x="14" y="16" width="68" height="40" rx="6" fill="${surface}" stroke="${accent}" stroke-opacity=".22"/>
    <path d="M27 45h42M30 29h36M34 36h28" stroke="${accent}" stroke-width="4" stroke-linecap="round" opacity=".72"/>
    <circle cx="76" cy="18" r="7" fill="${accent}" opacity=".92"/>
    <text x="20" y="26" font-family="Arial, sans-serif" font-size="11" font-weight="700" fill="${accent}">${label}</text>
  </svg>`

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

function getDemoCatalogTemplates(category: string) {
  const normalized = normalizeCatalogText(category)

  if (/пандус/.test(normalized)) {
    return [
      { code: '090', name: 'секция 900 мм', size: '900 мм', color: 'алюминий', material: 'алюминий', factor: 0.86, availability: '14 секций' },
      { code: '150', name: 'секция 1500 мм', size: '1500 мм', color: 'алюминий', material: 'алюминий', factor: 1.12, availability: '6 секций' },
      { code: '180', name: 'секция 1800 мм', size: '1800 мм', color: 'серый', material: 'сталь', factor: 1.24, availability: 'под заказ 7 дней' },
    ]
  }

  if (/тактиль|указател/.test(normalized)) {
    return [
      { code: 'RD', name: '300x300, красная', size: '300x300', color: 'красный', material: 'ПВХ', factor: 0.96, availability: '900 шт' },
      { code: '500', name: '500x500, желтая', size: '500x500', color: 'желтый', material: 'полиуретан', factor: 1.58, availability: '240 шт' },
      { code: 'CN', name: '300x300, конусная', size: '300x300', color: 'желтый', material: 'ПВХ', factor: 1.08, availability: 'под заказ 4 дня' },
    ]
  }

  if (/таблич/.test(normalized)) {
    return [
      { code: '150', name: '150x150, ПВХ', size: '150x150', color: 'синий/белый', material: 'ПВХ', factor: 0.82, availability: '28 шт' },
      { code: '300', name: '300x200, акрил', size: '300x200', color: 'синий/белый', material: 'акрил', factor: 1.22, availability: 'изготовление 3 дня' },
      { code: 'QR', name: '210x150, Брайль + QR', size: '210x150', color: 'синий/белый', material: 'ПВХ', factor: 1.34, availability: 'под заказ 5 дней' },
    ]
  }

  if (/кнопк/.test(normalized)) {
    return [
      { code: 'WR', name: 'беспроводная, IP54', size: 'комплект', color: 'синий', material: 'пластик', factor: 0.92, availability: '12 комплектов' },
      { code: 'RX', name: 'с приемником, IP65', size: 'комплект', color: 'синий', material: 'металл', factor: 1.16, availability: '7 комплектов' },
      { code: 'CB', name: 'проводная, антивандальная', size: 'комплект', color: 'серый', material: 'металл', factor: 0.74, availability: 'под заказ 3 дня' },
    ]
  }

  if (/маркиров|лент/.test(normalized)) {
    return [
      { code: '25', name: '25 мм x 18 м', size: '25 мм x 18 м', color: 'желто-черный', material: 'ПВХ', factor: 0.72, availability: '64 рулонов' },
      { code: '100', name: '100 мм x 18 м', size: '100 мм x 18 м', color: 'желто-черный', material: 'ПВХ', factor: 1.72, availability: '24 рулонов' },
      { code: 'FL', name: 'фотолюминесцентная 50 мм', size: '50 мм x 18 м', color: 'зеленый/белый', material: 'ПВХ', factor: 1.28, availability: 'под заказ 5 дней' },
    ]
  }

  return [
    { code: '060', name: '600 мм, нержавейка', size: '600 мм', color: 'нержавейка', material: 'AISI 304', factor: 0.78, availability: '18 шт' },
    { code: '080', name: '800 мм, нержавейка', size: '800 мм', color: 'нержавейка', material: 'AISI 304', factor: 0.9, availability: '16 шт' },
    { code: '120', name: '1200 мм, усиленный', size: '1200 мм', color: 'нержавейка', material: 'AISI 201', factor: 1.18, availability: 'под заказ 5 дней' },
  ]
}

function buildDemoParserCatalogRows(records: CatalogRecord[]): CatalogRecord[] {
  return records.flatMap((record) =>
    getDemoCatalogTemplates(record.product.category).map((template, index) => {
      const purchasePrice = Math.round(record.variant.purchasePrice * template.factor)
      const variant: ProductVariant = {
        ...record.variant,
        id: `${record.variant.id}-parser-${template.code}`,
        variantName: template.name,
        size: template.size,
        color: template.color,
        material: template.material,
        sku: `${record.variant.sku}-${template.code}`,
        purchasePrice,
        availability: template.availability,
        updatedAt: record.variant.updatedAt,
      }
      const priceHistory: PriceHistory[] = [
        {
          id: `ph-${variant.id}-latest`,
          supplierProductId: record.product.id,
          productVariantId: variant.id,
          supplierId: record.product.supplierId,
          purchasePrice,
          currency: record.product.currency,
          source: record.supplier?.sourceType === 'excel' ? 'excel' : 'parser',
          capturedAt: variant.updatedAt,
        },
        {
          id: `ph-${variant.id}-previous`,
          supplierProductId: record.product.id,
          productVariantId: variant.id,
          supplierId: record.product.supplierId,
          purchasePrice: Math.round(purchasePrice * (index % 2 === 0 ? 0.96 : 1.03)),
          currency: record.product.currency,
          source: 'demo-parser-cache',
          capturedAt: '2026-06-01T09:00:00.000Z',
        },
      ]

      return {
        product: record.product,
        variant,
        supplier: record.supplier,
        priceHistory,
      }
    }),
  )
}

function summarizeRecords(records: WorkRecord[]) {
  const openRecords = records.filter(
    (record) => record.deal.status !== 'closed_won' && record.deal.status !== 'closed_lost',
  )
  const quoteTotal = records.reduce((sum, record) => sum + record.quoteTotal, 0)
  const due = records.reduce((sum, record) => sum + record.dueAmount, 0)
  const overdue = records.reduce((sum, record) => sum + record.overdueAmount, 0)
  const pipeline = openRecords.reduce((sum, record) => sum + record.deal.expectedAmount, 0)
  const reminders = records.reduce(
    (sum, record) => sum + record.reminders.filter((reminder) => reminder.status !== 'done').length,
    0,
  )

  return {
    total: records.length,
    open: openRecords.length,
    pipeline,
    quoteTotal,
    due,
    overdue,
    reminders,
  }
}

function canSeeSystemNotification(state: CrmState, currentUserId: string, record?: WorkRecord) {
  const currentUser = state.users.find((user) => user.id === currentUserId)
  const roleCode = currentUser?.roleCode

  if (!record) {
    return roleCode === 'admin' || roleCode === 'director' || roleCode === 'deputy_director'
  }

  if (roleCode === 'admin' || roleCode === 'director' || roleCode === 'deputy_director' || roleCode === 'accountant') {
    return true
  }

  return (
    record.deal.responsibleUserId === currentUserId ||
    record.payments.some((payment) => payment.responsibleUserId === currentUserId) ||
    record.quotes.some((quote) => quote.createdByUserId === currentUserId)
  )
}

function getSystemRecordLabel(record: WorkRecord) {
  return record.deal.title
}

function buildSidebarSystemNotifications(
  state: CrmState,
  records: WorkRecord[],
  currentUserId: string,
  limit = 24,
): OverviewLatestItem[] {
  const visibleRecords = records.filter((record) => canSeeSystemNotification(state, currentUserId, record))

  const paymentItems: OverviewLatestItem[] = visibleRecords.flatMap((record) =>
    record.payments
      .filter((payment) => payment.status !== 'paid' && payment.amountDue > 0)
      .map((payment) => {
        const isOverdue = payment.status === 'overdue' || isPaymentOverdue(payment)
        const statusLabel = isOverdue
          ? 'Просрочена'
          : payment.status === 'partially_paid'
            ? 'Остаток к оплате'
            : payment.status === 'needs_clarification'
              ? 'Нужно уточнение'
              : 'Ожидается поступление'

        return {
          id: `system-payment-${payment.id}`,
          kind: 'notification',
          title: `Оплата: ${getSystemRecordLabel(record)}`,
          details: `${formatMoney(payment.amountDue)} к оплате`,
          meta: statusLabel,
          createdAt: payment.updatedAt || payment.createdAt,
        }
      }),
  )

  const quoteItems: OverviewLatestItem[] = visibleRecords.flatMap((record) =>
    record.quotes
      .filter((quote) => quote.status === 'draft' || quote.status === 'ready')
      .map((quote) => ({
        id: `system-quote-${quote.id}`,
        kind: 'notification',
        title:
          quote.status === 'draft'
            ? `КП: ${getSystemRecordLabel(record)}`
            : `КП готово: ${getSystemRecordLabel(record)}`,
        details: quote.status === 'draft' ? 'Нужно завершить документ' : 'Можно отправить клиенту',
        meta: quote.status === 'draft' ? 'Черновик не завершен' : 'Готово к отправке',
        createdAt: quote.updatedAt || quote.createdAt,
      })),
  )

  const documentItems: OverviewLatestItem[] = state.documents
    .map((document) => {
      const record = visibleRecords.find((item) => item.deal.id === document.dealId)
      return { document, record }
    })
    .filter(({ document, record }) => record && document.status === 'needs_review')
    .map(({ document, record }) => ({
      id: `system-document-${document.id}`,
      kind: 'notification',
      title: `Документ: ${record ? getSystemRecordLabel(record) : 'проект не найден'}`,
      details: document.title,
      meta: 'Ожидает проверки',
      createdAt: document.updatedAt || document.createdAt,
    }))

  const catalogItems: OverviewLatestItem[] = state.suppliers
    .filter(
      (supplier) =>
        (supplier.updateStatus === 'needs_check' || supplier.updateStatus === 'outdated') &&
        canSeeSystemNotification(state, currentUserId),
    )
    .map((supplier) => ({
      id: `system-catalog-${supplier.id}`,
      kind: 'notification',
      title: 'Каталог: прайс требует проверки',
      details: supplier.updateNote || `Поставщик ${supplier.name} ожидает обновления данных.`,
      meta: supplier.name,
      createdAt: supplier.lastUpdatedAt,
    }))

  const syncItems: OverviewLatestItem[] = state.installerNotes
    .filter((note) => note.status === 'local_draft')
    .filter((note) => note.installerUserId === currentUserId || canSeeSystemNotification(state, currentUserId))
    .map((note) => {
      const record = records.find((item) => item.deal.id === note.dealId)

      return {
        id: `system-sync-${note.id}`,
        kind: 'notification',
        title: `Синхронизация: ${record ? getSystemRecordLabel(record) : 'локальный черновик'}`,
        details: 'Осмотр сохранен локально и ожидает отправки в общую базу.',
        meta: 'Ожидает отправки',
        createdAt: note.updatedAt || note.createdAt,
      }
    })

  return [...paymentItems, ...quoteItems, ...documentItems, ...catalogItems, ...syncItems]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit)
}

function getRoleName(state: CrmState, roleCode: string) {
  return state.roles.find((role) => role.code === roleCode)?.name ?? roleCode
}

function getPaymentTone(status: Payment['status']): Tone {
  if (status === 'paid') return 'green'
  if (status === 'overdue' || status === 'needs_clarification') return 'red'
  if (status === 'partially_paid' || status === 'awaiting_payment') return 'amber'
  if (status === 'invoice_issued') return 'blue'
  return 'slate'
}

function buildManagerAnalyticsRows(state: CrmState, records: WorkRecord[]): ManagerAnalyticsRow[] {
  return state.users
    .filter((user) => user.isActive)
    .map((user) => {
      const userRecords = records.filter((record) => record.deal.responsibleUserId === user.id)
      const activeProjects = userRecords.filter((record) => !isClosedDeal(record)).length
      const tasks = state.tasks.filter((task) => task.assignedToUserId === user.id && task.status !== 'done').length

      return {
        userId: user.id,
        name: user.fullName,
        role: getRoleName(state, user.roleCode),
        projects: userRecords.length,
        activeProjects,
        quotes: userRecords.reduce((sum, record) => sum + record.quotes.length, 0),
        pipeline: userRecords
          .filter((record) => !isClosedDeal(record))
          .reduce((sum, record) => sum + record.deal.expectedAmount, 0),
        quoteTotal: userRecords.reduce((sum, record) => sum + record.quoteTotal, 0),
        due: userRecords.reduce((sum, record) => sum + record.dueAmount, 0),
        tasks,
      }
    })
    .filter((row) => row.projects > 0 || row.tasks > 0)
    .sort((left, right) => right.pipeline - left.pipeline)
}

function buildPaymentAnalyticsRows(payments: Payment[]): PaymentAnalyticsRow[] {
  const totalAmount = payments.reduce((sum, payment) => sum + payment.amountTotal, 0) || 1

  return (Object.keys(paymentStatusLabels) as Payment['status'][])
    .map((status) => {
      const statusPayments = payments.filter((payment) => payment.status === status)
      const amount = statusPayments.reduce((sum, payment) => sum + payment.amountTotal, 0)
      const due = statusPayments.reduce((sum, payment) => sum + getPaymentDue(payment), 0)

      return {
        status,
        label: paymentStatusLabels[status],
        count: statusPayments.length,
        amount,
        due,
        percent: Math.round((amount / totalAmount) * 100),
        tone: getPaymentTone(status),
      }
    })
    .filter((row) => row.count > 0)
}

const analyticsMonthLabels = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']

function getAnalyticsMonthLabel(value: string | null | undefined) {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return analyticsMonthLabels[date.getMonth()] ?? ''
}

function getPercent(value: number, max: number) {
  if (!max) {
    return 0
  }

  return Math.max(3, Math.min(100, Math.round((value / max) * 100)))
}

function getLocalStorageSizeLabel() {
  if (typeof window === 'undefined') {
    return 'недоступно'
  }

  try {
    const total = Object.keys(window.localStorage).reduce((sum, key) => {
      return sum + key.length + (window.localStorage.getItem(key)?.length ?? 0)
    }, 0)

    return `${Math.max(1, Math.round((total * 2) / 1024))} КБ`
  } catch {
    return 'недоступно'
  }
}

const projectAmountFormatter = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 0,
})

function formatProjectAmount(value: number) {
  return projectAmountFormatter.format(Math.round(value))
}

function isBlankProjectRecord(record: WorkRecord) {
  const textValues = [
    record.deal.title,
    record.deal.description,
    record.deal.source,
    record.deal.nextActionText,
    record.deal.inlineComment ?? '',
    record.counterparty?.name ?? '',
    record.counterparty?.shortName ?? '',
    record.counterparty?.inn ?? '',
    record.counterparty?.phone ?? '',
    record.counterparty?.email ?? '',
    record.object?.name ?? '',
    record.object?.address ?? '',
  ]

  return (
    record.deal.status === 'new' &&
    record.deal.paymentStatus === 'invoice_not_issued' &&
    record.deal.expectedAmount === 0 &&
    record.deal.actualAmount === 0 &&
    record.quotes.length === 0 &&
    record.payments.length === 0 &&
    record.documents.length === 0 &&
    record.reminders.length === 0 &&
    textValues.every((value) => !value.trim())
  )
}

function addDays(value: string, days: number) {
  const date = new Date(value)
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

function getProjectPeriod(record: WorkRecord, index: number) {
  if (isBlankProjectRecord(record)) {
    return ''
  }

  const contract = record.documents.find(
    (document) =>
      document.type === 'contract' ||
      /договор/i.test(`${document.title} ${document.originalFilename} ${document.comment}`),
  )
  const startDate = contract?.createdAt ?? record.deal.createdAt

  if (record.deal.closedAt) {
    return `${formatDate(startDate)} - ${formatDate(record.deal.closedAt)}`
  }

  const isOpenEnded = index % 4 === 0 || record.deal.status === 'new' || record.deal.status === 'quote_preparation'
  if (isOpenEnded) {
    return `${formatDate(startDate)} - ...`
  }

  const durationDays = [14, 21, 30, 45, 60][index % 5]
  return `${formatDate(startDate)} - ${formatDate(addDays(startDate, durationDays))}`
}

function getProjectContractInfo(record: WorkRecord) {
  const contract = record.documents.find(
    (document) =>
      document.type === 'contract' ||
      /договор/i.test(`${document.title} ${document.originalFilename} ${document.comment}`),
  )

  if (!contract) {
    return { value: '—', detail: 'не прикреплен' }
  }

  return {
    value: contract.title.replace(/^договор\s*/i, '').trim() || contract.originalFilename,
    detail: formatDate(contract.createdAt),
  }
}

function getProjectSupplyInfo(state: CrmState, record: WorkRecord) {
  const supplierById = new Map(state.suppliers.map((supplier) => [supplier.id, supplier.name]))
  const supplierNames = [
    ...new Set(
      record.quotes
        .flatMap((quote) => quote.items)
        .map((item) => supplierById.get(item.supplierId))
        .filter((value): value is string => Boolean(value)),
    ),
  ]
  const invoices = [...new Set(record.payments.map((payment) => payment.invoiceNumber).filter(Boolean))]

  return {
    source: supplierNames.slice(0, 2).join(', ') || 'поставщик не выбран',
    invoice: invoices.slice(0, 2).join(', ') || 'счет не создан',
  }
}

function getProjectSupplyDocument(record: WorkRecord, index: number) {
  if (isBlankProjectRecord(record)) {
    return {
      title: '',
      detail: '',
    }
  }

  const suppliers = [
    'Вертикаль',
    'Исток',
    'САН',
    'Доступная среда',
    'Навигатор',
    'Рельеф Плюс',
    'Городские решения',
    'Тактильный стандарт',
  ]
  const invoiceSeries = ['СЧ', 'INV', 'САН', 'ДС', 'НВ', 'РП']
  const supplier = suppliers[index % suppliers.length]
  const series = invoiceSeries[index % invoiceSeries.length]
  const number = 6400 + index * 19 + (record.deal.expectedAmount % 17)
  const invoices = [
    `счет № ${series}-${number}`,
    `счет № ${number}-${String((index % 4) + 1).padStart(2, '0')}`,
    `счет № ${series}-${String(number).slice(1)}/26`,
    `счет № ${number}-У`,
  ]

  return {
    title: supplier,
    detail: invoices[index % invoices.length],
  }
}

function getProjectPaymentInfo(record: WorkRecord) {
  if (isBlankProjectRecord(record)) {
    return {
      value: '',
      detail: '',
    }
  }

  return {
    value: paymentStatusLabels[record.deal.paymentStatus],
    detail: record.dueAmount ? `остаток ${formatMoneyCompact(record.dueAmount)}` : 'закрыто',
  }
}

function getProjectComment(record: WorkRecord) {
  if (record.deal.inlineComment !== undefined) {
    return record.deal.inlineComment.trim()
  }

  const parts: string[] = []
  const seen = new Set<string>()
  const description = record.deal.description.trim()
  const objectNote = record.object?.importantNotes.trim()
  const objectComment = record.object?.comment.trim()
  const nextAction = record.deal.nextActionText.trim()
  const visibleDocuments = record.documents.slice(0, 3).map((document) => document.title)
  const moneyText = (value: number) => formatMoney(value).replace(/\.$/, '')

  const sentence = (prefix: string, value: string | undefined) => {
    const text = value?.replace(/\s+/g, ' ').trim()

    if (!text) return undefined

    return `${prefix}${text}${/[.!?]$/.test(text) ? '' : '.'}`
  }

  const addPart = (value: string | undefined) => {
    const normalized = value?.replace(/\s+/g, ' ').trim()

    if (!normalized) return

    const key = normalized.toLowerCase()

    if (seen.has(key)) return

    seen.add(key)
    parts.push(normalized)
  }

  addPart(sentence('Ситуация: ', description))
  addPart(
    record.object
      ? `Объект: ${record.object.name}, адрес работ ${record.object.address}. Текущий статус объекта: ${objectStatusLabels[record.object.status]}.`
      : undefined,
  )
  addPart(objectNote && objectNote !== nextAction ? sentence('Ограничения по объекту: ', objectNote) : undefined)
  addPart(objectComment && objectComment !== description ? sentence('Комментарий по площадке: ', objectComment) : undefined)
  addPart(
    record.quotes.length
      ? `КП в работе: ${record.quotes.map((quote) => quote.number).join(', ')}; сумма по КП ${record.quoteTotal ? moneyText(record.quoteTotal) : 'уточняется'}.`
      : `КП еще не создано, нужно собрать состав работ и зафиксировать закупочные цены перед отправкой заказчику.`,
  )
  addPart(
    record.payments.length
      ? `Оплата: ${paymentStatusLabels[record.deal.paymentStatus]}, остаток к контролю ${moneyText(record.dueAmount)}.`
      : `Оплата: счет пока не выставлен, ориентир проекта ${moneyText(record.deal.expectedAmount)}.`,
  )
  addPart(
    record.overdueAmount
      ? `Риск: есть просрочка ${moneyText(record.overdueAmount)}, отгрузку и монтаж не запускать без решения по оплате.`
      : undefined,
  )
  addPart(
    visibleDocuments.length
      ? `Документы в карточке: ${visibleDocuments.join(', ')}${record.documents.length > visibleDocuments.length ? ' и другие вложения' : ''}.`
      : `Документы нужно дозаполнить: договор, ТЗ, план работ и счет должны быть доступны в карточке проекта.`,
  )
  addPart(nextAction ? `Следующий шаг: ${nextAction}; контроль ${safeFormatDateTime(record.deal.nextActionAt)} (${relativeAction(record.deal.nextActionAt)}).` : undefined)

  return parts.join(' ') || 'Комментарий не указан.'
}

function getHashIndex(value: string, modulo: number) {
  return Math.abs([...value].reduce((sum, char) => sum + char.charCodeAt(0), 0)) % modulo
}

function getProjectContacts(state: CrmState, record: WorkRecord): ProjectInlineContact[] {
  const contacts = record.counterparty
    ? state.contacts
        .filter((contact) => contact.counterpartyId === record.counterparty?.id)
        .slice(0, 2)
        .map((contact) => ({
          id: contact.id,
          fullName: contact.fullName,
          phone: contact.phone || record.counterparty?.phone || '+7 (843) 000-00-00',
          position: contact.position || 'Контакт по проекту',
        }))
    : []

  if (contacts.length >= 2) {
    return contacts
  }

  if (!contacts.length && isBlankProjectRecord(record)) {
    return []
  }

  const fallbackNames = [
    'Ирина Соколова',
    'Марат Сафиуллин',
    'Ольга Никитина',
    'Рустем Валеев',
    'Екатерина Морозова',
  ]
  const fallbackPhones = [
    '+7 843 221-18-04',
    '+7 843 240-66-17',
    '+7 843 206-45-31',
    '+7 843 218-09-54',
    '+7 843 275-13-88',
  ]
  const fallbackIndex = getHashIndex(record.deal.id, fallbackNames.length)

  return [
    ...contacts,
    {
      id: `${record.deal.id}-site-contact`,
      fullName: fallbackNames[fallbackIndex],
      phone: fallbackPhones[fallbackIndex],
      position: 'Ответственный на объекте',
    },
  ].slice(0, 2)
}

function getDocumentKind(document: Pick<DocumentRecord, 'mimeType' | 'originalFilename' | 'title'>): ProjectPreviewDocumentKind {
  const lookup = `${document.mimeType} ${document.originalFilename} ${document.title}`.toLowerCase()

  if (lookup.includes('spreadsheet') || /\.(xlsx|xls|csv)\b/.test(lookup)) return 'excel'
  if (lookup.includes('word') || /\.(docx|doc)\b/.test(lookup)) return 'word'
  if (lookup.includes('image') || /\.(jpg|jpeg|png|webp)\b/.test(lookup)) return 'image'
  if (lookup.includes('pdf') || /\.pdf\b/.test(lookup)) return 'pdf'

  return 'file'
}

function getDocumentFileName(title: string, kind: ProjectPreviewDocumentKind, number: string) {
  const extensionByKind: Record<ProjectPreviewDocumentKind, string> = {
    pdf: 'pdf',
    word: 'docx',
    excel: 'xlsx',
    image: 'jpg',
    file: 'pdf',
  }
  const normalizedTitle = title
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 46)

  return `${number}_${normalizedTitle || 'document'}.${extensionByKind[kind]}`
}

function toProjectPreviewDocument(document: DocumentRecord): ProjectPreviewDocument {
  const kind = getDocumentKind(document)

  return {
    id: document.id,
    title: document.title,
    fileName: document.originalFilename || getDocumentFileName(document.title, kind, document.id),
    kind,
    typeLabel: document.type === 'drawing' ? 'План' : document.type === 'quote' ? 'КП' : document.type === 'contract' ? 'Договор' : 'Документ',
    summary: document.comment || 'Документ приложен к проекту и доступен для просмотра внутри карточки.',
    issuedAt: document.createdAt,
    statusLabel: document.status === 'active' ? 'Активен' : document.status,
    sizeBytes: document.sizeBytes,
  }
}

function makeGeneratedProjectDocument(
  record: WorkRecord,
  index: number,
  title: string,
  kind: ProjectPreviewDocumentKind,
  typeLabel: string,
  summary: string,
): ProjectPreviewDocument {
  return {
    id: `${record.deal.id}-mock-document-${index}`,
    title,
    fileName: getDocumentFileName(title, kind, record.deal.number),
    kind,
    typeLabel,
    summary,
    issuedAt: record.deal.updatedAt,
    statusLabel: 'Черновой просмотр',
    sizeBytes: 420000 + index * 185000,
  }
}

function applyProjectDocumentTitleOverrides(
  documents: ProjectPreviewDocument[],
  overrides: Deal['inlineProjectDocuments'],
  dealNumber: string,
) {
  const titleById = new Map(
    (overrides ?? [])
      .map((document) => [document.id, document.title.trim()] as const)
      .filter(([, title]) => Boolean(title)),
  )

  if (!titleById.size) return documents

  return documents.map((document) => {
    const title = titleById.get(document.id)

    if (!title) return document

    return {
      ...document,
      title,
      fileName: getDocumentFileName(title, document.kind, dealNumber),
    }
  })
}

function getProjectDocumentsForInline(record: WorkRecord): ProjectPreviewDocument[] {
  const documents = record.documents.map(toProjectPreviewDocument)
  const templates: Array<{
    matcher: RegExp
    title: string
    kind: ProjectPreviewDocumentKind
    typeLabel: string
    summary: string
  }> = [
    {
      matcher: /договор/i,
      title: `Договор по проекту ${record.deal.number}`,
      kind: 'word',
      typeLabel: 'Договор',
      summary: 'Юридическая версия договора с реквизитами контрагента, предметом работ и сроками выполнения.',
    },
    {
      matcher: /кп|коммерчес/i,
      title: `Коммерческое предложение ${record.deal.number}`,
      kind: 'pdf',
      typeLabel: 'КП',
      summary: 'Коммерческое предложение с составом работ, поставкой материалов и итоговой суммой.',
    },
    {
      matcher: /техническ|тз/i,
      title: 'Техническое задание заказчика',
      kind: 'word',
      typeLabel: 'ТЗ',
      summary: 'Требования к объекту, ограничения по монтажу, зонам работ и допускам сотрудников.',
    },
    {
      matcher: /план|чертеж|схем/i,
      title: `План работ: ${record.object?.name ?? record.deal.title}`,
      kind: 'pdf',
      typeLabel: 'План',
      summary: 'Строительный план с зонами монтажа, точками крепления и пометками для выездной бригады.',
    },
    {
      matcher: /спецификац|ведомост/i,
      title: 'Спецификация материалов',
      kind: 'excel',
      typeLabel: 'Excel',
      summary: 'Сводная таблица материалов, количества, закупочных цен и привязки к поставщикам.',
    },
    {
      matcher: /акт|обслед/i,
      title: 'Акт обследования объекта',
      kind: 'pdf',
      typeLabel: 'Акт',
      summary: 'Итоги осмотра объекта, замеры, замечания заказчика и список уточнений перед КП.',
    },
    {
      matcher: /фото|отчет/i,
      title: 'Фотоотчет с объекта',
      kind: 'image',
      typeLabel: 'Фото',
      summary: 'Подборка фотографий входной зоны, стен, проходов и мест будущего монтажа.',
    },
  ]

  const enriched = [...documents]

  templates.forEach((template, index) => {
    if (enriched.length >= 7) return
    if (enriched.some((document) => template.matcher.test(document.title))) return

    enriched.push(
      makeGeneratedProjectDocument(
        record,
        index + 1,
        template.title,
        template.kind,
        template.typeLabel,
        template.summary,
      ),
    )
  })

  return applyProjectDocumentTitleOverrides(enriched.slice(0, 7), record.deal.inlineProjectDocuments, record.deal.number)
}

function getProjectInvoiceDocuments(record: WorkRecord): ProjectPreviewDocument[] {
  const paymentDocuments = record.payments.map((payment, index) => ({
    id: `${payment.id}-invoice-preview`,
    title: payment.invoiceNumber ? `Счет ${payment.invoiceNumber}` : `Счет на оплату ${index + 1}`,
    fileName: getDocumentFileName(payment.invoiceNumber || `Счет_${index + 1}`, 'pdf', record.deal.number),
    kind: 'pdf' as ProjectPreviewDocumentKind,
    typeLabel: 'Счет',
    summary: `${paymentStatusLabels[payment.status]}. Оплачено ${formatMoney(payment.amountPaid)} из ${formatMoney(payment.amountTotal)}, остаток ${formatMoney(getPaymentDue(payment))}.`,
    issuedAt: payment.invoiceDate || payment.createdAt,
    statusLabel: paymentStatusLabels[payment.status],
    amountLabel: formatMoney(payment.amountTotal),
    sizeBytes: 260000 + index * 90000,
  }))

  if (paymentDocuments.length) {
    return applyProjectDocumentTitleOverrides([
      ...paymentDocuments,
      makeGeneratedProjectDocument(
        record,
        22,
        'Акт сверки взаиморасчетов',
        'excel',
        'Сверка',
        'Сводка выставленных счетов, оплат, остатков и комментариев бухгалтерии.',
      ),
    ].slice(0, 4), record.deal.inlineInvoiceDocuments, record.deal.number)
  }

  return applyProjectDocumentTitleOverrides([
    {
      id: `${record.deal.id}-invoice-draft`,
      title: 'Черновик счета на аванс',
      fileName: getDocumentFileName('Черновик счета на аванс', 'pdf', record.deal.number),
      kind: 'pdf',
      typeLabel: 'Счет',
      summary: 'Счет пока не выставлен: сумма и состав работ готовы для передачи в бухгалтерию.',
      issuedAt: record.deal.updatedAt,
      statusLabel: paymentStatusLabels[record.deal.paymentStatus],
      amountLabel: formatMoney(record.deal.expectedAmount),
      sizeBytes: 280000,
    },
    makeGeneratedProjectDocument(
      record,
      23,
      'Расчет аванса и финального платежа',
      'excel',
      'Расчет',
      'Простая таблица по этапам оплаты: аванс, поставка, монтаж и закрывающие документы.',
    ),
  ], record.deal.inlineInvoiceDocuments, record.deal.number)
}

function getProjectPaymentSummary(record: WorkRecord) {
  const customSummary = record.deal.inlineInvoiceSummary?.trim()

  if (customSummary) {
    return customSummary
  }

  if (!record.payments.length) {
    return `Счет еще не выставлен. Ориентир по сумме проекта: ${formatMoney(record.deal.expectedAmount)}, бухгалтерии нужно выпустить авансовый счет.`
  }

  const amountTotal = record.payments.reduce((sum, payment) => sum + payment.amountTotal, 0)
  const amountPaid = record.payments.reduce((sum, payment) => sum + payment.amountPaid, 0)
  const amountDue = record.payments.reduce((sum, payment) => sum + getPaymentDue(payment), 0)

  if (record.overdueAmount) {
    return `Есть просрочка ${formatMoney(record.overdueAmount)}. Оплачено ${formatMoney(amountPaid)} из ${formatMoney(amountTotal)}, остаток нужно закрыть до отгрузки.`
  }

  if (amountDue > 0) {
    return `Счета выставлены, оплачено ${formatMoney(amountPaid)} из ${formatMoney(amountTotal)}. Остаток к контролю: ${formatMoney(amountDue)}.`
  }

  return `Оплата закрыта: ${formatMoney(amountPaid)} оплачено, счета и закрывающие документы можно смотреть ниже.`
}

function normalizeInlineSingleLine(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function normalizeInlineText(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function normalizeInlineDocumentDrafts(documents: ProjectInlineDocumentDraft[]) {
  const seen = new Set<string>()

  return documents
    .map((document) => ({
      id: document.id,
      title: normalizeInlineSingleLine(document.title),
    }))
    .filter((document) => {
      if (!document.id || !document.title || seen.has(document.id)) return false
      seen.add(document.id)
      return true
    })
}

function createProjectInlineDraft(state: CrmState, record: WorkRecord): ProjectInlineDraft {
  const contacts = getProjectContacts(state, record)

  return {
    projectTitle: record.deal.title,
    expectedAmount: record.deal.expectedAmount ? String(record.deal.expectedAmount) : '',
    source: record.deal.source,
    status: record.deal.status,
    paymentStatus: record.deal.paymentStatus,
    nextActionText: record.deal.nextActionText,
    nextActionAt: isoToDateTimeInput(record.deal.nextActionAt),
    counterpartyName: record.counterparty?.name ?? '',
    counterpartyInn: record.counterparty?.inn ?? '',
    workAddress: record.object?.address ?? record.counterparty?.actualAddress ?? '',
    objectName: record.object?.name ?? record.deal.title,
    legalAddress: record.counterparty?.legalAddress || record.counterparty?.actualAddress || '',
    contacts: contacts.length
      ? contacts
      : [
          {
            id: `${record.deal.id}-site-contact`,
            fullName: '',
            phone: '',
            position: '',
          },
        ],
    invoiceSummary: getProjectPaymentSummary(record),
    invoiceDocuments: getProjectInvoiceDocuments(record).map((document) => ({
      id: document.id,
      title: document.title,
    })),
    projectDocuments: getProjectDocumentsForInline(record).map((document) => ({
      id: document.id,
      title: document.title,
    })),
    comment: getProjectComment(record),
  }
}

function applyProjectInlineDraft(state: CrmState, record: WorkRecord, draft: ProjectInlineDraft): CrmState {
  const now = new Date().toISOString()
  const counterpartyId = record.counterparty?.id ?? record.deal.counterpartyId
  const objectId = record.object?.id ?? record.deal.objectId
  const counterpartyName = normalizeInlineSingleLine(draft.counterpartyName)
  const counterpartyInn = normalizeInlineSingleLine(draft.counterpartyInn)
  const workAddress = normalizeInlineSingleLine(draft.workAddress)
  const objectName = normalizeInlineSingleLine(draft.objectName)
  const legalAddress = normalizeInlineSingleLine(draft.legalAddress)
  const projectTitle = normalizeInlineSingleLine(draft.projectTitle)
  const source = normalizeInlineSingleLine(draft.source)
  const expectedAmount = parseProjectAmount(draft.expectedAmount)
  const nextActionText = normalizeInlineSingleLine(draft.nextActionText)
  const nextActionAt = dateTimeInputToIso(draft.nextActionAt)
  const invoiceDocuments = normalizeInlineDocumentDrafts(draft.invoiceDocuments)
  const projectDocuments = normalizeInlineDocumentDrafts(draft.projectDocuments)
  const allDocumentTitles = new Map(
    [...invoiceDocuments, ...projectDocuments].map((document) => [document.id, document.title] as const),
  )
  const existingContactIds = new Set(state.contacts.map((contact) => contact.id))
  const editedContacts = draft.contacts
    .map((contact) => ({
      id: contact.id,
      fullName: normalizeInlineSingleLine(contact.fullName),
      phone: normalizeInlineSingleLine(contact.phone),
      position: normalizeInlineSingleLine(contact.position),
    }))
    .filter((contact) => contact.fullName || contact.phone || contact.position)
  const contactById = new Map(editedContacts.map((contact) => [contact.id, contact] as const))
  const createdContacts: ContactPerson[] = editedContacts
    .filter((contact) => counterpartyId && !existingContactIds.has(contact.id))
    .map((contact, index) => ({
      id: contact.id,
      counterpartyId,
      fullName: contact.fullName || 'Контактное лицо',
      position: contact.position || 'Контакт по проекту',
      phone: contact.phone,
      email: '',
      messenger: '',
      comment: 'Добавлено из краткой карточки проекта.',
      isPrimary: !state.contacts.some((item) => item.counterpartyId === counterpartyId) && index === 0,
    }))

  return {
    ...state,
    counterparties: state.counterparties.map((counterparty) =>
      counterparty.id === counterpartyId
        ? {
            ...counterparty,
            name: counterpartyName || counterparty.name,
            shortName: counterpartyName || counterparty.shortName,
            inn: counterpartyInn,
            legalAddress,
            actualAddress: objectId ? counterparty.actualAddress : workAddress,
            updatedAt: now,
          }
        : counterparty,
    ),
    objects: state.objects.map((object) =>
      object.id === objectId
        ? {
            ...object,
            name: objectName || object.name,
            address: workAddress,
            importantNotes: nextActionText,
            status: getObjectStatusForDeal(draft.status),
            updatedAt: now,
          }
        : object,
    ),
    contacts: [
      ...state.contacts.map((contact) => {
        const editedContact = contactById.get(contact.id)

        if (!editedContact) return contact

        return {
          ...contact,
          fullName: editedContact.fullName || contact.fullName,
          phone: editedContact.phone,
          position: editedContact.position || contact.position,
        }
      }),
      ...createdContacts,
    ],
    documents: state.documents.map((document) => {
      const title = allDocumentTitles.get(document.id)

      if (!title) return document

      return {
        ...document,
        title,
        updatedAt: now,
      }
    }),
    deals: state.deals.map((deal) =>
      deal.id === record.deal.id
        ? {
            ...deal,
            title: projectTitle,
            source,
            status: draft.status,
            paymentStatus: draft.paymentStatus,
            expectedAmount,
            actualAmount: draft.paymentStatus === 'paid' ? expectedAmount : deal.actualAmount,
            nextActionText,
            nextActionAt,
            closedAt: draft.status === 'closed_won' || draft.status === 'closed_lost' ? deal.closedAt ?? now : null,
            inlineInvoiceSummary: normalizeInlineText(draft.invoiceSummary),
            inlineInvoiceDocuments: invoiceDocuments,
            inlineProjectDocuments: projectDocuments,
            inlineComment: normalizeInlineText(draft.comment),
            updatedAt: now,
          }
        : deal,
    ),
  }
}

function getWorkSearchText(record: WorkRecord) {
  return normalizeCatalogText(
    [
      record.deal.number,
      record.deal.title,
      record.deal.description,
      record.deal.inlineComment ?? '',
      record.deal.inlineInvoiceSummary ?? '',
      record.counterparty?.shortName ?? '',
      record.counterparty?.name ?? '',
      record.object?.name ?? '',
      record.object?.address ?? '',
      record.quotes.map((quote) => quote.number).join(' '),
      record.payments.map((payment) => payment.invoiceNumber).join(' '),
    ].join(' '),
  )
}

function StatusBadge({ tone = 'slate', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`work-badge work-badge-${tone}`}>{children}</span>
}

function ProjectCreateModal({
  state,
  currentUserId,
  isResponsibleLocked = false,
  onClose,
  onCreate,
}: {
  state: CrmState
  currentUserId: string
  isResponsibleLocked?: boolean
  onClose: () => void
  onCreate: (draft: ProjectCreateDraft) => void
}) {
  const [draft, setDraft] = useState(() => createDefaultProjectDraft(currentUserId))
  const responsibleUsers = useMemo(
    () =>
      state.users
        .filter((user) => user.isActive && (!isResponsibleLocked || user.id === currentUserId))
        .sort((left, right) => left.fullName.localeCompare(right.fullName, 'ru-RU')),
    [currentUserId, isResponsibleLocked, state.users],
  )

  const updateDraft = <Key extends keyof ProjectCreateDraft>(key: Key, value: ProjectCreateDraft[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onCreate(draft)
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="work-window-backdrop work-project-create-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="work-project-create-window"
        role="dialog"
        aria-modal="true"
        aria-label="Создание проекта"
        onSubmit={handleSubmit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span>Новая позиция</span>
            <h2>Создать проект</h2>
          </div>
          <button type="button" className="work-icon-button" aria-label="Закрыть окно создания проекта" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="work-project-create-body">
          <section className="work-project-create-section">
            <h3>Проект</h3>
            <div className="work-project-create-grid">
              <label className="work-project-create-field is-wide">
                <span>Название проекта</span>
                <input
                  data-testid="project-create-title"
                  value={draft.projectTitle}
                  placeholder="Например: Пандус и навигация входной группы"
                  onChange={(event) => updateDraft('projectTitle', event.target.value)}
                />
              </label>
              <label className="work-project-create-field">
                <span>Сумма, руб.</span>
                <input
                  value={draft.expectedAmount}
                  inputMode="decimal"
                  placeholder="0"
                  onChange={(event) => updateDraft('expectedAmount', event.target.value)}
                />
              </label>
              <label className="work-project-create-field">
                <span>Источник</span>
                <input
                  value={draft.source}
                  placeholder="Новая заявка"
                  onChange={(event) => updateDraft('source', event.target.value)}
                />
              </label>
              <label className="work-project-create-field">
                <span>Статус</span>
                <select value={draft.status} onChange={(event) => updateDraft('status', event.target.value as Deal['status'])}>
                  {(Object.entries(dealStatusLabels) as Array<[Deal['status'], string]>).map(([status, label]) => (
                    <option key={status} value={status}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="work-project-create-field">
                <span>Оплата</span>
                <select
                  value={draft.paymentStatus}
                  onChange={(event) => updateDraft('paymentStatus', event.target.value as Payment['status'])}
                >
                  {(Object.entries(paymentStatusLabels) as Array<[Payment['status'], string]>).map(([status, label]) => (
                    <option key={status} value={status}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="work-project-create-field is-wide">
                <span>Описание</span>
                <textarea
                  value={draft.description}
                  placeholder="Состав работ, вводные по объекту, ограничения"
                  onChange={(event) => updateDraft('description', event.target.value)}
                />
              </label>
            </div>
          </section>

          <section className="work-project-create-section">
            <h3>Клиент</h3>
            <div className="work-project-create-grid">
              <label className="work-project-create-field is-wide">
                <span>Контрагент</span>
                <input
                  data-testid="project-create-counterparty"
                  value={draft.counterpartyName}
                  placeholder="ООО, АО, учреждение или ИП"
                  onChange={(event) => updateDraft('counterpartyName', event.target.value)}
                />
              </label>
              <label className="work-project-create-field">
                <span>ИНН</span>
                <input value={draft.counterpartyInn} onChange={(event) => updateDraft('counterpartyInn', event.target.value)} />
              </label>
              <label className="work-project-create-field">
                <span>Телефон</span>
                <input value={draft.counterpartyPhone} onChange={(event) => updateDraft('counterpartyPhone', event.target.value)} />
              </label>
              <label className="work-project-create-field">
                <span>Email</span>
                <input
                  value={draft.counterpartyEmail}
                  type="email"
                  onChange={(event) => updateDraft('counterpartyEmail', event.target.value)}
                />
              </label>
              <label className="work-project-create-field">
                <span>Юридический адрес</span>
                <input value={draft.legalAddress} onChange={(event) => updateDraft('legalAddress', event.target.value)} />
              </label>
            </div>
          </section>

          <section className="work-project-create-section">
            <h3>Объект и контакт</h3>
            <div className="work-project-create-grid">
              <label className="work-project-create-field">
                <span>Объект</span>
                <input
                  value={draft.objectName}
                  placeholder="Входная группа, корпус, филиал"
                  onChange={(event) => updateDraft('objectName', event.target.value)}
                />
              </label>
              <label className="work-project-create-field">
                <span>Адрес работ</span>
                <input
                  data-testid="project-create-address"
                  value={draft.objectAddress}
                  onChange={(event) => updateDraft('objectAddress', event.target.value)}
                />
              </label>
              <label className="work-project-create-field">
                <span>Контактное лицо</span>
                <input value={draft.contactName} onChange={(event) => updateDraft('contactName', event.target.value)} />
              </label>
              <label className="work-project-create-field">
                <span>Должность</span>
                <input value={draft.contactPosition} onChange={(event) => updateDraft('contactPosition', event.target.value)} />
              </label>
              <label className="work-project-create-field">
                <span>Телефон контакта</span>
                <input value={draft.contactPhone} onChange={(event) => updateDraft('contactPhone', event.target.value)} />
              </label>
              <label className="work-project-create-field">
                <span>Email контакта</span>
                <input
                  value={draft.contactEmail}
                  type="email"
                  onChange={(event) => updateDraft('contactEmail', event.target.value)}
                />
              </label>
            </div>
          </section>

          <section className="work-project-create-section">
            <h3>Контроль</h3>
            <div className="work-project-create-grid">
              <label className="work-project-create-field">
                <span>Ответственный</span>
                <select
                  value={draft.responsibleUserId}
                  disabled={isResponsibleLocked}
                  onChange={(event) => updateDraft('responsibleUserId', event.target.value)}
                >
                  {responsibleUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.fullName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="work-project-create-field">
                <span>Контрольная дата</span>
                <input
                  value={draft.nextActionAt}
                  type="datetime-local"
                  onChange={(event) => updateDraft('nextActionAt', event.target.value)}
                />
              </label>
              <label className="work-project-create-field is-wide">
                <span>Следующее действие</span>
                <input
                  value={draft.nextActionText}
                  onChange={(event) => updateDraft('nextActionText', event.target.value)}
                />
              </label>
              <label className="work-project-create-field is-wide">
                <span>Комментарий в таблицу</span>
                <textarea
                  value={draft.comment}
                  placeholder="Короткий рабочий комментарий для строки проекта"
                  onChange={(event) => updateDraft('comment', event.target.value)}
                />
              </label>
            </div>
          </section>
        </div>

        <div className="work-project-create-actions">
          <button type="button" className="work-secondary-button" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="work-primary-button" data-testid="project-create-submit">
            <Plus size={16} />
            Создать
          </button>
        </div>
      </form>
    </div>
  )
}

function SidebarModuleButton({
  icon,
  label,
  meta,
  active,
  danger,
  onClick,
}: {
  icon: ReactNode
  label: string
  meta: string
  active?: boolean
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={classNames('work-sidebar-module-button', active && 'is-active', danger && 'is-danger')}
      aria-label={`${label}. ${meta}`}
      onClick={onClick}
    >
      <span>{icon}</span>
      <b>{label}</b>
    </button>
  )
}

function SidebarNotificationLog({
  items,
  readIds,
  unreadCount,
  onOpen,
}: {
  items: OverviewLatestItem[]
  readIds: ReadonlySet<string>
  unreadCount: number
  onOpen: () => void
}) {
  const previewItems = items.slice(0, 3)

  return (
    <section className="work-sidebar-notifications" aria-label="Журнал уведомлений">
      <button type="button" className="work-sidebar-notifications-card" onClick={onOpen}>
        <span className="work-sidebar-notifications-title">
          <span className="work-sidebar-notifications-icon" aria-hidden="true">
            <Bell size={15} />
          </span>
          <b>Уведомления</b>
          {unreadCount ? <small>{unreadCount}</small> : null}
        </span>
        <span className="work-sidebar-notifications-table">
          {previewItems.map((item) => (
            <span key={item.id} className="work-sidebar-notification-row">
              <i className={classNames(!readIds.has(item.id) && 'is-unread')} aria-hidden="true" />
              <span>
                <b>{item.title}</b>
                <em>{item.meta}</em>
              </span>
            </span>
          ))}
          {!previewItems.length ? (
            <span className="work-sidebar-notification-empty">Пока нет новых уведомлений.</span>
          ) : null}
        </span>
      </button>
    </section>
  )
}

function SidebarNotificationModal({
  items,
  readIds,
  unreadCount,
  onClose,
  onMarkRead,
  onClear,
}: {
  items: OverviewLatestItem[]
  readIds: ReadonlySet<string>
  unreadCount: number
  onClose: () => void
  onMarkRead: (ids: string[]) => void
  onClear: () => void
}) {
  const unreadIds = items.filter((item) => !readIds.has(item.id)).map((item) => item.id)

  return (
    <div className="work-window-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="work-notification-window"
        role="dialog"
        aria-modal="true"
        aria-label="Все уведомления"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span>Журнал</span>
            <h2>Уведомления</h2>
            <p>{unreadCount ? `Непрочитанных: ${unreadCount}` : 'Все просмотрено'}</p>
          </div>
          <div className="work-notification-window-actions">
            <button
              type="button"
              className="work-secondary-button"
              onClick={() => onMarkRead(unreadIds)}
              disabled={!unreadIds.length}
            >
              <CheckCircle2 size={16} />
              <span>Прочитано</span>
            </button>
            <button type="button" className="work-secondary-button" onClick={onClear} disabled={!items.length}>
              <Trash2 size={16} />
              <span>Очистить</span>
            </button>
            <button type="button" className="work-icon-button" aria-label="Закрыть журнал" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="work-notification-modal-list" tabIndex={0}>
          {items.map((item) => {
            const isUnread = !readIds.has(item.id)

            return (
              <button
                key={item.id}
                type="button"
                className={classNames('work-notification-modal-row', isUnread && 'is-unread')}
                onClick={() => onMarkRead([item.id])}
              >
                <span className="work-notification-modal-icon" aria-hidden="true">
                  {item.kind === 'notification' ? <Bell size={16} /> : <Activity size={16} />}
                </span>
                <span className="work-notification-modal-copy">
                  <span>
                    <b>{item.title}</b>
                    {isUnread ? <i aria-label="Непрочитано" /> : null}
                  </span>
                  <small>{item.meta}</small>
                  {item.details ? <em>{item.details}</em> : null}
                </span>
              </button>
            )
          })}
          {!items.length ? <p className="work-notification-modal-empty">Журнал очищен. Новые напоминания появятся здесь автоматически.</p> : null}
        </div>
      </section>
    </div>
  )
}

function WorkOverview({
  isPersonalScope,
  onNavigate,
  onOpenKpEditor,
}: {
  isPersonalScope: boolean
  onNavigate: (filter: WorkFilterId, module?: SidebarModuleId) => void
  onOpenKpEditor: (dealId?: string) => void
}) {
  const actionCards = [
    {
      icon: <BriefcaseBusiness size={26} />,
      title: 'Проекты',
      text: isPersonalScope ? 'Мои проекты: статусы, сроки и действия' : 'Реестр работ: статусы, сроки, ответственные',
      tone: 'blue' as Tone,
      orbit: 'is-projects',
      onClick: () => onNavigate('all', 'projects'),
    },
    {
      icon: <Building2 size={26} />,
      title: 'Контрагенты',
      text: 'Клиенты, реквизиты, объекты и контакты',
      tone: 'slate' as Tone,
      orbit: 'is-counterparties',
      onClick: () => onNavigate('all', 'counterparties'),
    },
    {
      icon: <PackageSearch size={26} />,
      title: 'Каталог',
      text: 'Товары, цены, поставщики и история прайсов',
      tone: 'blue' as Tone,
      orbit: 'is-catalog',
      onClick: () => onNavigate('all', 'catalog'),
    },
    {
      icon: <BarChart3 size={26} />,
      title: 'Аналитика',
      text: isPersonalScope ? 'Мои показатели без сравнения с командой' : 'Воронка, оплаты, КП и показатели команды',
      tone: 'green' as Tone,
      orbit: 'is-analytics',
      onClick: () => onNavigate('all', 'analytics'),
    },
    {
      icon: <FileText size={26} />,
      title: 'КП',
      text: 'Собрать позиции, рассчитать цену и выгрузить документ',
      tone: 'violet' as Tone,
      orbit: 'is-quotes',
      onClick: () => onOpenKpEditor(),
    },
    {
      icon: <Wrench size={26} />,
      title: 'Настройки',
      text: isPersonalScope ? 'Параметры рабочего места и документов' : 'Пользователи, роли, источники и резервные копии',
      tone: 'slate' as Tone,
      orbit: 'is-settings',
      onClick: () => onNavigate('all', 'settings'),
    },
  ]

  return (
    <section className="work-overview" aria-label="Главная">
      <div className="work-overview-orbit">
        <div className="work-overview-hub">
          <h2>Главная</h2>
        </div>
        {actionCards.map((action) => (
          <button
            key={action.title}
            type="button"
            className={classNames('work-overview-action', `is-${action.tone}`, action.orbit)}
            onClick={action.onClick}
          >
            <span className="work-overview-action-icon">{action.icon}</span>
            <span className="work-overview-action-copy">
              <b>{action.title}</b>
              <small>{action.text}</small>
            </span>
            <span className="work-overview-action-meta">
              <ArrowRight size={18} />
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

function InfoField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <label className="work-field">
      <span>{label}</span>
      <div>{value}</div>
    </label>
  )
}

interface ProjectDetailField {
  label: string
  value: ReactNode
  note?: ReactNode
  tone?: Tone
  wide?: boolean
  actionLabel?: string
  onClick?: () => void
  edit?: {
    value: string
    placeholder?: string
    multiline?: boolean
    type?: 'text' | 'number' | 'email' | 'tel' | 'url'
    inputMode?: 'text' | 'numeric' | 'decimal' | 'tel' | 'email' | 'url'
    onSave: (value: string) => void
  }
}

function ProjectDetailInfoCard({ field }: { field: ProjectDetailField }) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(field.edit?.value ?? '')
  const canEdit = Boolean(field.edit)
  const className = classNames(
    'work-project-info-card work-project-detail-card',
    field.tone && `is-${field.tone}`,
    field.wide && 'is-wide',
    field.onClick && !canEdit && 'is-clickable',
    canEdit && 'is-editable',
    isEditing && 'is-editing',
  )

  const saveDraft = () => {
    if (!field.edit) return

    if (draft !== field.edit.value) {
      field.edit.onSave(draft)
    }

    setIsEditing(false)
  }

  const cancelDraft = () => {
    setDraft(field.edit?.value ?? '')
    setIsEditing(false)
  }

  if (isEditing && field.edit) {
    return (
      <article className={className}>
        <span>{field.label}</span>
        {field.edit.multiline ? (
          <textarea
            className="work-project-detail-edit-input"
            aria-label={field.label}
            value={draft}
            placeholder={field.edit.placeholder}
            autoFocus
            rows={4}
            onBlur={saveDraft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                saveDraft()
              }

              if (event.key === 'Escape') {
                event.preventDefault()
                cancelDraft()
              }
            }}
          />
        ) : (
          <input
            className="work-project-detail-edit-input"
            aria-label={field.label}
            value={draft}
            placeholder={field.edit.placeholder}
            type={field.edit.type ?? 'text'}
            inputMode={field.edit.inputMode}
            autoFocus
            onBlur={saveDraft}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                saveDraft()
              }

              if (event.key === 'Escape') {
                event.preventDefault()
                cancelDraft()
              }
            }}
          />
        )}
        {field.note ? <small>{field.note}</small> : null}
      </article>
    )
  }

  const content = (
    <>
      <span>{field.label}</span>
      <strong>{field.value}</strong>
      {field.note ? <small>{field.note}</small> : null}
      {field.actionLabel ? <em>{field.actionLabel}</em> : null}
    </>
  )

  if (field.onClick) {
    return (
      <button
        type="button"
        className={className}
        aria-label={`${field.label}: ${field.actionLabel ?? 'открыть'}`}
        onClick={field.onClick}
      >
        {content}
      </button>
    )
  }

  if (canEdit) {
    return (
      <button
        type="button"
        className={className}
        aria-label={`Редактировать: ${field.label}`}
        onClick={() => {
          setDraft(field.edit?.value ?? '')
          setIsEditing(true)
        }}
      >
        {content}
      </button>
    )
  }

  return <article className={className}>{content}</article>
}

interface WorkObjectCommentItem {
  id: string
  author: string
  role: string
  date: string
  title: string
  text: string
  editValue?: string
  onSave?: (value: string) => void
}

function WorkObjectCommentCard({ comment }: { comment: WorkObjectCommentItem }) {
  const [isEditing, setIsEditing] = useState(false)
  const editValue = comment.editValue ?? comment.text
  const [draft, setDraft] = useState(editValue)

  const saveDraft = () => {
    if (comment.onSave && draft !== editValue) {
      comment.onSave(draft)
    }

    setIsEditing(false)
  }

  const cancelDraft = () => {
    setDraft(editValue)
    setIsEditing(false)
  }

  if (isEditing && comment.onSave) {
    return (
      <article className="work-object-comment-card is-editing">
        <div>
          <strong>{comment.title}</strong>
          <span>{comment.author} · {comment.role} · {comment.date}</span>
        </div>
        <textarea
          className="work-project-detail-edit-input"
          aria-label={comment.title}
          value={draft}
          autoFocus
          rows={5}
          onBlur={saveDraft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              saveDraft()
            }

            if (event.key === 'Escape') {
              event.preventDefault()
              cancelDraft()
            }
          }}
        />
      </article>
    )
  }

  if (comment.onSave) {
    return (
      <button
        type="button"
        className="work-object-comment-card is-editable"
        onClick={() => {
          setDraft(editValue)
          setIsEditing(true)
        }}
      >
        <div>
          <strong>{comment.title}</strong>
          <span>{comment.author} · {comment.role} · {comment.date}</span>
        </div>
        <p>{comment.text}</p>
      </button>
    )
  }

  return (
    <article className="work-object-comment-card">
      <div>
        <strong>{comment.title}</strong>
        <span>{comment.author} · {comment.role} · {comment.date}</span>
      </div>
      <p>{comment.text}</p>
    </article>
  )
}

function getQuoteActivity(state: CrmState, record: WorkRecord) {
  const relatedIds = new Set<string>([
    record.deal.id,
    record.deal.counterpartyId,
    record.deal.objectId,
    ...record.quotes.map((quote) => quote.id),
    ...record.payments.map((payment) => payment.id),
    ...record.documents.map((document) => document.id),
  ])

  return state.activity.filter((item) => relatedIds.has(item.entityId)).slice(0, 8)
}

function ProjectDocumentIcon({ kind }: { kind: ProjectPreviewDocumentKind }) {
  const labelByKind: Record<ProjectPreviewDocumentKind, string> = {
    pdf: 'PDF',
    word: 'DOC',
    excel: 'XLS',
    image: 'IMG',
    file: 'FILE',
  }

  return <span className="work-project-doc-format">{labelByKind[kind]}</span>
}

function ProjectDocumentList({
  documents,
  draftDocuments,
  isEditing = false,
  onDocumentTitleChange,
  onPreview,
}: {
  documents: ProjectPreviewDocument[]
  draftDocuments?: ProjectInlineDocumentDraft[]
  isEditing?: boolean
  onDocumentTitleChange?: (documentId: string, title: string) => void
  onPreview: (document: ProjectPreviewDocument) => void
}) {
  const draftTitleById = new Map((draftDocuments ?? []).map((document) => [document.id, document.title] as const))

  return (
    <div className="work-project-doc-list">
      {documents.map((document) => {
        const title = draftTitleById.get(document.id) ?? document.title
        const previewDocument =
          title === document.title
            ? document
            : {
                ...document,
                title,
                fileName: getDocumentFileName(title, document.kind, document.id),
              }

        const content = (
          <>
            <span className={`work-project-doc-icon is-${document.kind}`} aria-hidden="true">
              <ProjectDocumentIcon kind={document.kind} />
            </span>
            {isEditing ? (
              <input
                className="work-project-doc-title-input"
                aria-label="Название документа"
                value={title}
                onChange={(event) => onDocumentTitleChange?.(document.id, event.target.value)}
              />
            ) : (
              <span className="work-project-doc-title" title={title}>
                {title}
              </span>
            )}
          </>
        )

        if (!isEditing) {
          return (
            <button
              key={document.id}
              type="button"
              className="work-project-doc-item is-clickable"
              aria-label={`Посмотреть ${title}`}
              onClick={() => onPreview(previewDocument)}
            >
              {content}
              <span className="work-project-doc-preview-button" aria-hidden="true">
                <Eye size={15} />
              </span>
            </button>
          )
        }

        return (
          <div key={document.id} className="work-project-doc-item">
            {content}
            <button
              type="button"
              className="work-project-doc-preview-button"
              aria-label={`Посмотреть ${title}`}
              onClick={() => onPreview(previewDocument)}
            >
              <Eye size={15} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

function ProjectDocumentPreviewModal({
  document,
  onClose,
}: {
  document: ProjectPreviewDocument
  onClose: () => void
}) {
  const extensionLabel: Record<ProjectPreviewDocumentKind, string> = {
    pdf: 'PDF',
    word: 'DOC',
    excel: 'XLS',
    image: 'IMG',
    file: 'FILE',
  }

  return (
    <div className="work-window-backdrop work-document-preview-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="work-document-preview-window"
        role="dialog"
        aria-modal="true"
        aria-label={`Предпросмотр документа ${document.title}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span>{document.typeLabel} · {extensionLabel[document.kind]}</span>
            <h2>{document.title}</h2>
          </div>
          <button type="button" className="work-icon-button" aria-label="Закрыть предпросмотр" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="work-document-preview-body">
          <aside className="work-document-preview-aside">
            <span className={`work-document-preview-icon is-${document.kind}`} aria-hidden="true">
              <ProjectDocumentIcon kind={document.kind} />
            </span>
            <dl>
              <div>
                <dt>Файл</dt>
                <dd>{document.fileName}</dd>
              </div>
              <div>
                <dt>Дата</dt>
                <dd>{formatDate(document.issuedAt)}</dd>
              </div>
              <div>
                <dt>Статус</dt>
                <dd>{document.statusLabel ?? 'К просмотру'}</dd>
              </div>
              {document.amountLabel ? (
                <div>
                  <dt>Сумма</dt>
                  <dd>{document.amountLabel}</dd>
                </div>
              ) : null}
              {document.sizeBytes ? (
                <div>
                  <dt>Размер</dt>
                  <dd>{formatBytes(document.sizeBytes)}</dd>
                </div>
              ) : null}
            </dl>
          </aside>

          <div className="work-document-viewer">
            <article className={`work-document-page is-${document.kind}`}>
              <div className="work-document-page-mark">{extensionLabel[document.kind]}</div>
              <div className="work-document-page-head">
                <span>{document.typeLabel}</span>
                <strong>{document.title}</strong>
                <small>{document.fileName}</small>
              </div>
              <section>
                <h3>Краткое содержание</h3>
                <p>{document.summary}</p>
              </section>
              <section>
                <h3>Поля документа</h3>
                <div className="work-document-preview-grid">
                  <span>Наименование</span>
                  <strong>{document.title}</strong>
                  <span>Дата</span>
                  <strong>{formatDate(document.issuedAt)}</strong>
                  <span>Формат</span>
                  <strong>{extensionLabel[document.kind]}</strong>
                  <span>Режим</span>
                  <strong>Только просмотр</strong>
                </div>
              </section>
              <section>
                <h3>Предпросмотр</h3>
                <div className="work-document-preview-lines" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
              </section>
            </article>
          </div>
        </div>
      </section>
    </div>
  )
}

function ProjectInlineDetails({
  state,
  record,
  onOpenDetails,
  onOpenKpEditor,
  onPreviewDocument,
  onSaveInlineDetails,
  onRequestDelete,
}: {
  state: CrmState
  record: WorkRecord
  onOpenDetails: () => void
  onOpenKpEditor: (dealId?: string) => void
  onPreviewDocument: (document: ProjectPreviewDocument) => void
  onSaveInlineDetails: (draft: ProjectInlineDraft) => void
  onRequestDelete: () => void
}) {
  const currentDraft = useMemo(() => createProjectInlineDraft(state, record), [record, state])
  const [draft, setDraft] = useState<ProjectInlineDraft>(currentDraft)
  const [isEditing, setIsEditing] = useState(false)
  const visibleDraft = isEditing ? draft : currentDraft
  const projectDocuments = getProjectDocumentsForInline(record)
  const invoiceDocuments = getProjectInvoiceDocuments(record)

  const updateDraftField = <Key extends keyof ProjectInlineDraft,>(key: Key, value: ProjectInlineDraft[Key]) => {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }))
  }

  const updateContactDraft = (contactId: string, field: keyof ProjectInlineContact, value: string) => {
    setDraft((current) => ({
      ...current,
      contacts: current.contacts.map((contact) =>
        contact.id === contactId
          ? {
              ...contact,
              [field]: value,
            }
          : contact,
      ),
    }))
  }

  const updateInvoiceDocumentDraft = (documentId: string, title: string) => {
    setDraft((current) => ({
      ...current,
      invoiceDocuments: current.invoiceDocuments.map((document) =>
        document.id === documentId ? { ...document, title } : document,
      ),
    }))
  }

  const updateProjectDocumentDraft = (documentId: string, title: string) => {
    setDraft((current) => ({
      ...current,
      projectDocuments: current.projectDocuments.map((document) =>
        document.id === documentId ? { ...document, title } : document,
      ),
    }))
  }

  const handleEditStart = () => {
    setDraft(currentDraft)
    setIsEditing(true)
  }

  const handleEditCancel = () => {
    setDraft(currentDraft)
    setIsEditing(false)
  }

  const handleEditSave = () => {
    onSaveInlineDetails(draft)
    setIsEditing(false)
  }

  return (
    <div className={classNames('work-inline-detail work-project-inline-detail', isEditing && 'is-editing')}>
      <div className="work-project-inline-toolbar">
        <div className="work-project-inline-meta">
          <span>Ответственный: {getUserName(state, record.deal.responsibleUserId)}</span>
          <span>Следующее действие: {relativeAction(record.deal.nextActionAt)}</span>
          <span>{record.deal.nextActionText || 'не указано'}</span>
        </div>
        <div className="work-inline-detail-actions work-project-inline-actions">
          {isEditing ? (
            <>
              <button
                type="button"
                className="work-primary-button"
                data-testid="project-inline-save"
                onClick={handleEditSave}
              >
                <Save size={15} />
                Сохранить
              </button>
              <button
                type="button"
                className="work-secondary-button"
                data-testid="project-inline-cancel"
                onClick={handleEditCancel}
              >
                <X size={15} />
                Отмена
              </button>
            </>
          ) : (
            <button
              type="button"
              className="work-secondary-button"
              data-testid="project-inline-edit"
              onClick={handleEditStart}
            >
              <Pencil size={15} />
              Изменить
            </button>
          )}
          <button type="button" className="work-secondary-button" onClick={() => onOpenKpEditor(record.deal.id)}>
            <FileText size={15} />
            Создать КП
          </button>
          <button
            type="button"
            className="work-secondary-button work-danger-button"
            data-testid="project-inline-delete"
            onClick={onRequestDelete}
          >
            <Trash2 size={15} />
            Удалить
          </button>
          <button type="button" className="work-primary-button" onClick={onOpenDetails}>
            Подробнее
          </button>
        </div>
      </div>

      <div className="work-project-info-grid">
        <article className="work-project-info-card work-project-info-card-project">
          <span>Проект</span>
          {isEditing ? (
            <div className="work-project-inline-edit-stack">
              <input
                className="work-project-inline-input"
                data-testid="project-inline-title"
                aria-label="Название проекта"
                value={draft.projectTitle}
                onChange={(event) => updateDraftField('projectTitle', event.target.value)}
              />
              <div className="work-project-contact-edit-grid">
                <input
                  className="work-project-inline-input"
                  aria-label="Сумма проекта"
                  inputMode="decimal"
                  value={draft.expectedAmount}
                  onChange={(event) => updateDraftField('expectedAmount', event.target.value)}
                />
                <input
                  className="work-project-inline-input"
                  aria-label="Источник проекта"
                  value={draft.source}
                  onChange={(event) => updateDraftField('source', event.target.value)}
                />
              </div>
              <div className="work-project-contact-edit-grid">
                <select
                  className="work-project-inline-input"
                  aria-label="Статус проекта"
                  value={draft.status}
                  onChange={(event) => updateDraftField('status', event.target.value as Deal['status'])}
                >
                  {(Object.entries(dealStatusLabels) as Array<[Deal['status'], string]>).map(([status, label]) => (
                    <option key={status} value={status}>
                      {label}
                    </option>
                  ))}
                </select>
                <select
                  className="work-project-inline-input"
                  aria-label="Статус оплаты"
                  value={draft.paymentStatus}
                  onChange={(event) => updateDraftField('paymentStatus', event.target.value as Payment['status'])}
                >
                  {(Object.entries(paymentStatusLabels) as Array<[Payment['status'], string]>).map(([status, label]) => (
                    <option key={status} value={status}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="work-project-contact-edit-grid">
                <input
                  className="work-project-inline-input"
                  aria-label="Следующее действие"
                  value={draft.nextActionText}
                  onChange={(event) => updateDraftField('nextActionText', event.target.value)}
                />
                <input
                  className="work-project-inline-input"
                  aria-label="Дата следующего действия"
                  type="datetime-local"
                  value={draft.nextActionAt}
                  onChange={(event) => updateDraftField('nextActionAt', event.target.value)}
                />
              </div>
            </div>
          ) : (
            <>
              <strong>{visibleDraft.projectTitle || record.deal.number}</strong>
              <small>
                {dealStatusLabels[visibleDraft.status]} · {visibleDraft.expectedAmount ? `${formatProjectAmount(parseProjectAmount(visibleDraft.expectedAmount))} руб.` : 'сумма не указана'}
              </small>
            </>
          )}
        </article>

        <article className="work-project-info-card">
          <span>Наименование</span>
          {isEditing ? (
            <div className="work-project-inline-edit-stack">
              <input
                className="work-project-inline-input"
                data-testid="project-inline-counterparty-name"
                aria-label="Наименование контрагента"
                value={draft.counterpartyName}
                onChange={(event) => updateDraftField('counterpartyName', event.target.value)}
              />
              <input
                className="work-project-inline-input"
                aria-label="ИНН контрагента"
                value={draft.counterpartyInn}
                onChange={(event) => updateDraftField('counterpartyInn', event.target.value)}
              />
            </div>
          ) : (
            <>
              <strong>{visibleDraft.counterpartyName || 'Контрагент не указан'}</strong>
              <small>ИНН {visibleDraft.counterpartyInn || 'не указан'}</small>
            </>
          )}
        </article>

        <article className="work-project-info-card">
          <span>Адрес</span>
          {isEditing ? (
            <div className="work-project-inline-edit-stack">
              <input
                className="work-project-inline-input"
                aria-label="Адрес работ"
                value={draft.workAddress}
                onChange={(event) => updateDraftField('workAddress', event.target.value)}
              />
              <input
                className="work-project-inline-input"
                aria-label="Название объекта"
                value={draft.objectName}
                onChange={(event) => updateDraftField('objectName', event.target.value)}
              />
            </div>
          ) : (
            <>
              <strong>{visibleDraft.workAddress || 'Адрес работ не указан'}</strong>
              <small>{visibleDraft.objectName || record.deal.title}</small>
            </>
          )}
        </article>

        <article className="work-project-info-card">
          <span>Юридический адрес</span>
          {isEditing ? (
            <textarea
              className="work-project-inline-textarea is-compact"
              aria-label="Юридический адрес"
              value={draft.legalAddress}
              onChange={(event) => updateDraftField('legalAddress', event.target.value)}
            />
          ) : (
            <>
              <strong>{visibleDraft.legalAddress || 'Юридический адрес не указан'}</strong>
              <small>Адрес для договора и закрывающих документов</small>
            </>
          )}
        </article>

        <article className="work-project-info-card">
          <span>Контактные лица</span>
          <div className="work-project-contact-list">
            {visibleDraft.contacts.map((contact) => {
              const contactMeta = [contact.phone, contact.position].filter(Boolean).join(' · ')

              return (
                <div key={contact.id} className={classNames('work-project-contact-row', isEditing && 'is-editing')}>
                  {isEditing ? (
                    <>
                      <input
                        className="work-project-inline-input"
                        aria-label="ФИО контактного лица"
                        value={contact.fullName}
                        onChange={(event) => updateContactDraft(contact.id, 'fullName', event.target.value)}
                      />
                      <div className="work-project-contact-edit-grid">
                        <input
                          className="work-project-inline-input"
                          aria-label="Телефон контактного лица"
                          value={contact.phone}
                          onChange={(event) => updateContactDraft(contact.id, 'phone', event.target.value)}
                        />
                        <input
                          className="work-project-inline-input"
                          aria-label="Должность контактного лица"
                          value={contact.position}
                          onChange={(event) => updateContactDraft(contact.id, 'position', event.target.value)}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <strong>{contact.fullName || 'Контакт не указан'}</strong>
                      <small>{contactMeta || 'телефон и должность не указаны'}</small>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </article>

        <article className="work-project-info-card work-project-info-card-docs">
          <span>Счета</span>
          {isEditing ? (
            <textarea
              className="work-project-inline-textarea"
              aria-label="Ситуация по оплате и счетам"
              value={draft.invoiceSummary}
              onChange={(event) => updateDraftField('invoiceSummary', event.target.value)}
            />
          ) : (
            <p>{visibleDraft.invoiceSummary}</p>
          )}
          <ProjectDocumentList
            documents={invoiceDocuments}
            draftDocuments={visibleDraft.invoiceDocuments}
            isEditing={isEditing}
            onDocumentTitleChange={updateInvoiceDocumentDraft}
            onPreview={onPreviewDocument}
          />
        </article>

        <article className="work-project-info-card work-project-info-card-docs">
          <span>Документы</span>
          <ProjectDocumentList
            documents={projectDocuments}
            draftDocuments={visibleDraft.projectDocuments}
            isEditing={isEditing}
            onDocumentTitleChange={updateProjectDocumentDraft}
            onPreview={onPreviewDocument}
          />
        </article>

        <article className="work-project-info-card work-project-info-card-comment">
          <span>Комментарий</span>
          {isEditing ? (
            <textarea
              className="work-project-inline-textarea is-comment"
              data-testid="project-inline-comment"
              aria-label="Комментарий по проекту"
              value={draft.comment}
              onChange={(event) => updateDraftField('comment', event.target.value)}
            />
          ) : (
            <p>{visibleDraft.comment}</p>
          )}
        </article>
      </div>
    </div>
  )
}

function ProjectDeleteConfirmModal({
  record,
  onClose,
  onConfirm,
}: {
  record: WorkRecord
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <div className="work-window-backdrop work-project-delete-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="work-project-delete-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`Удалить проект ${record.deal.number}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <span>Подтверждение</span>
          <button type="button" className="work-icon-button" aria-label="Закрыть подтверждение" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="work-project-delete-body">
          <div className="work-project-delete-icon" aria-hidden="true">
            <Trash2 size={24} />
          </div>
          <div>
            <h2>Удалить проект?</h2>
            <p>
              Проект <strong>{record.deal.number}</strong> «{record.deal.title}» будет удален из списка вместе с
              привязанными КП, платежами, документами, задачами и заметками.
            </p>
          </div>
        </div>
        <div className="work-project-delete-actions">
          <button type="button" className="work-secondary-button" onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className="work-primary-button work-danger-confirm-button"
            data-testid="project-delete-confirm"
            onClick={onConfirm}
          >
            <Trash2 size={16} />
            Удалить
          </button>
        </div>
      </section>
    </div>
  )
}

function CounterpartyInlineDetails({
  state,
  record,
  onOpenDetails,
}: {
  state: CrmState
  record: CounterpartyRecord
  onOpenDetails: () => void
}) {
  const primaryContact = record.contacts.find((contact) => contact.isPrimary) ?? record.contacts[0]
  const latestContract = record.contracts[0]
  const activeDeals = record.deals.filter((deal) => deal.status !== 'closed_won' && deal.status !== 'closed_lost')

  return (
    <div className="work-inline-detail work-counterparty-inline">
      <div className="work-inline-detail-main">
        <article>
          <span>Наименование</span>
          <strong>{record.counterparty.name}</strong>
          <small>{counterpartyStatusLabels[record.counterparty.status]} · {getUserName(state, record.counterparty.responsibleUserId)}</small>
        </article>
        <article>
          <span>Реквизиты</span>
          <strong>ИНН {record.counterparty.inn || 'не указан'}</strong>
          <small>КПП {record.counterparty.kpp || 'не указан'} · ОГРН {record.counterparty.ogrn || 'не указан'}</small>
        </article>
        <article>
          <span>Связь</span>
          <strong>{primaryContact?.fullName ?? (record.counterparty.phone || 'контакт не указан')}</strong>
          <small>{primaryContact ? `${primaryContact.position} · ${primaryContact.phone}` : record.counterparty.email || 'email не указан'}</small>
        </article>
        <article>
          <span>Договоры и работы</span>
          <strong>{record.contracts.length} договоров · {activeDeals.length} активных проектов</strong>
          <small>{latestContract ? `${latestContract.title} · ${formatDate(latestContract.createdAt)}` : 'договоры еще не прикреплены'}</small>
        </article>
      </div>

      <div className="work-inline-detail-actions">
        <span>{record.documents.length} док. · {record.objects.length} объектов</span>
        <button type="button" className="work-primary-button" onClick={onOpenDetails}>
          Подробнее
        </button>
      </div>
    </div>
  )
}

function CounterpartyRegistry({
  state,
  records,
  selectedId,
  onToggle,
  onOpenDetails,
}: {
  state: CrmState
  records: CounterpartyRecord[]
  selectedId: string | null
  onToggle: (counterpartyId: string) => void
  onOpenDetails: (counterpartyId: string) => void
}) {
  return (
    <section className="work-registry" id="counterparty-registry">
      <div className="work-registry-head">
        <div>
          <h2>Список контрагентов</h2>
          <p>Нажмите на строку, чтобы раскрыть карточку с реквизитами, контактами, договорами и объектами.</p>
        </div>
        <StatusBadge tone="slate">{records.length} карточек</StatusBadge>
      </div>

      <div className="work-table-wrap">
        <table className="work-table work-counterparty-table">
          <thead>
            <tr>
              <th>№</th>
              <th>Контрагент</th>
              <th>ИНН</th>
              <th>Телефон</th>
              <th>Договоры</th>
              <th>Проекты</th>
              <th>Ответственный</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record, index) => {
              const isSelected = selectedId === record.counterparty.id
              const primaryContact = record.contacts.find((contact) => contact.isPrimary) ?? record.contacts[0]
              const rowNumber = `К-${String(index + 1).padStart(3, '0')}`

              return (
                <Fragment key={record.counterparty.id}>
                  <tr
                    className={classNames(isSelected && 'is-selected')}
                    tabIndex={0}
                    aria-expanded={isSelected}
                    onClick={() => onToggle(record.counterparty.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onToggle(record.counterparty.id)
                      }
                    }}
                  >
                    <td className="work-number-cell">
                      <strong>{rowNumber}</strong>
                      <small>{formatDate(record.counterparty.createdAt)}</small>
                    </td>
                    <td className="work-project-cell">
                      <strong>{record.counterparty.shortName}</strong>
                      <small>{record.counterparty.name}</small>
                    </td>
                    <td>
                      <strong>{record.counterparty.inn || 'не указан'}</strong>
                      <small>КПП {record.counterparty.kpp || 'не указан'}</small>
                    </td>
                    <td>
                      <strong>{primaryContact?.phone || record.counterparty.phone || 'не указан'}</strong>
                      <small>{primaryContact?.fullName ?? (record.counterparty.email || 'контакт не указан')}</small>
                    </td>
                    <td>
                      <strong>{record.contracts.length}</strong>
                      <small>{record.contracts[0]?.title ?? 'нет вложений'}</small>
                    </td>
                    <td>
                      <strong>{record.deals.length}</strong>
                      <small>{record.objects.length} объектов</small>
                    </td>
                    <td>
                      <strong>{getUserName(state, record.counterparty.responsibleUserId)}</strong>
                      <small>{counterpartyStatusLabels[record.counterparty.status]}</small>
                    </td>
                  </tr>
                  {isSelected ? (
                    <tr className="work-expanded-row">
                      <td colSpan={7}>
                        <CounterpartyInlineDetails
                          state={state}
                          record={record}
                          onOpenDetails={() => onOpenDetails(record.counterparty.id)}
                        />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function CatalogPreview({ record }: { record: CatalogRecord }) {
  return (
    <span className="work-catalog-preview">
      <img src={getCatalogPreviewDataUri(record)} alt="" loading="lazy" />
    </span>
  )
}

function CatalogInlineDetails({ record }: { record: CatalogRecord }) {
  const latestPrice = record.priceHistory[0]
  const previousPrice = record.priceHistory[1]
  const delta = latestPrice && previousPrice ? latestPrice.purchasePrice - previousPrice.purchasePrice : null
  const deltaText =
    delta === null
      ? 'история пока короткая'
      : delta === 0
        ? 'без изменения'
        : `${delta > 0 ? '+' : ''}${formatMoney(delta)} к прошлой цене`

  return (
    <div className="work-inline-detail work-catalog-expanded">
      <div className="work-inline-detail-main">
        <article>
          <span>Характеристики</span>
          <strong>{record.variant.size || record.variant.variantName}</strong>
          <small>{record.variant.color} · {record.variant.material} · {record.product.unit}</small>
        </article>
        <article>
          <span>Источник</span>
          <strong>{getSupplierSourceLabel(record.supplier?.sourceType)}</strong>
          <small>{record.supplier?.updateNote ?? 'Заметка поставщика не указана'}</small>
        </article>
        <article>
          <span>История цены</span>
          <strong>{latestPrice ? formatMoney(latestPrice.purchasePrice) : formatMoney(record.variant.purchasePrice)}</strong>
          <small>{deltaText}</small>
        </article>
        <article>
          <span>Идентификаторы</span>
          <strong>{record.product.externalId}</strong>
          <small>{record.product.id} · {record.variant.id}</small>
        </article>
      </div>

      <div className="work-inline-detail-actions">
        <StatusBadge tone={getCatalogUpdateTone(record.supplier?.updateStatus)}>
          {record.supplier?.updateStatus === 'fresh'
            ? 'Актуально'
            : record.supplier?.updateStatus === 'outdated'
              ? 'Старая цена'
              : 'Проверить'}
        </StatusBadge>
        <span>{record.priceHistory.length ? `${record.priceHistory.length} снимка цен` : 'нет истории'}</span>
      </div>
    </div>
  )
}

function CatalogRegistry({
  records,
  allRecordsCount,
  suppliers,
  categories,
  selectedId,
  search,
  supplierFilter,
  categoryFilter,
  availabilityFilter,
  onSearchChange,
  onSupplierFilterChange,
  onCategoryFilterChange,
  onAvailabilityFilterChange,
  onResetFilters,
  onToggle,
}: {
  records: CatalogRecord[]
  allRecordsCount: number
  suppliers: Supplier[]
  categories: string[]
  selectedId: string | null
  search: string
  supplierFilter: string
  categoryFilter: string
  availabilityFilter: CatalogAvailabilityFilter
  onSearchChange: (value: string) => void
  onSupplierFilterChange: (value: string) => void
  onCategoryFilterChange: (value: string) => void
  onAvailabilityFilterChange: (value: CatalogAvailabilityFilter) => void
  onResetFilters: () => void
  onToggle: (variantId: string) => void
}) {
  return (
    <section className="work-registry work-catalog-registry" id="catalog-registry">
      <div className="work-registry-head">
        <div>
          <h2>Каталог товаров</h2>
          <p>Единая таблица товаров из прайсов, Excel и парсера поставщиков.</p>
        </div>
        <StatusBadge tone="slate">
          {records.length} из {allRecordsCount}
        </StatusBadge>
      </div>

      <div className="work-catalog-toolbar" role="search">
        <label className="work-catalog-filter work-catalog-filter-search">
          <span>Поиск</span>
          <input
            value={search}
            placeholder="Название, SKU, категория, поставщик"
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>
        <label className="work-catalog-filter">
          <span>Поставщик</span>
          <select value={supplierFilter} onChange={(event) => onSupplierFilterChange(event.target.value)}>
            <option value="all">Все поставщики</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </label>
        <label className="work-catalog-filter">
          <span>Категория</span>
          <select value={categoryFilter} onChange={(event) => onCategoryFilterChange(event.target.value)}>
            <option value="all">Все категории</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <label className="work-catalog-filter">
          <span>Наличие</span>
          <select
            value={availabilityFilter}
            onChange={(event) => onAvailabilityFilterChange(event.target.value as CatalogAvailabilityFilter)}
          >
            {(Object.keys(catalogAvailabilityLabels) as CatalogAvailabilityFilter[]).map((filter) => (
              <option key={filter} value={filter}>
                {catalogAvailabilityLabels[filter]}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="work-table-button" onClick={onResetFilters}>
          Сбросить
        </button>
      </div>

      <div className="work-table-wrap">
        <table className="work-table work-catalog-table">
          <thead>
            <tr>
              <th>Фото</th>
              <th>Товар</th>
              <th>SKU</th>
              <th>Поставщик</th>
              <th>Наличие</th>
              <th>Закупка</th>
              <th>Обновлено</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record, index) => {
              const isSelected = selectedId === record.variant.id
              const supplierTone = getCatalogUpdateTone(record.supplier?.updateStatus)
              const rowNumber = `Т-${String(index + 1).padStart(3, '0')}`

              return (
                <Fragment key={record.variant.id}>
                  <tr
                    className={classNames(isSelected && 'is-selected')}
                    tabIndex={0}
                    aria-expanded={isSelected}
                    onClick={() => onToggle(record.variant.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onToggle(record.variant.id)
                      }
                    }}
                  >
                    <td className="work-catalog-photo-cell">
                      <CatalogPreview record={record} />
                    </td>
                    <td className="work-catalog-product-cell">
                      <strong>{record.product.name}</strong>
                      <small>{rowNumber} · {record.variant.variantName} · {record.product.category}</small>
                    </td>
                    <td>
                      <strong>{record.variant.sku}</strong>
                      <small>{record.product.sku}</small>
                    </td>
                    <td>
                      <strong>{record.supplier?.name ?? 'Поставщик не указан'}</strong>
                      <small>{getSupplierSourceLabel(record.supplier?.sourceType)}</small>
                    </td>
                    <td>
                      <StatusBadge tone={supplierTone}>{record.variant.availability}</StatusBadge>
                      <small>{record.product.availability}</small>
                    </td>
                    <td>
                      <strong>{formatMoney(record.variant.purchasePrice)}</strong>
                      <small>{record.product.unit}</small>
                    </td>
                    <td>
                      <strong>{formatDateTime(record.variant.updatedAt)}</strong>
                      <small>{record.supplier ? formatDateTime(record.supplier.lastUpdatedAt) : 'нет даты'}</small>
                    </td>
                  </tr>
                  {isSelected ? (
                    <tr className="work-expanded-row">
                      <td colSpan={7}>
                        <CatalogInlineDetails record={record} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {!records.length ? (
        <div className="work-empty">
          По выбранным фильтрам товаров нет. Измените поиск, поставщика или категорию.
        </div>
      ) : null}
    </section>
  )
}

function AnalyticsScreen({
  state,
  records,
  summary,
  currentUserId,
  isPersonalScope,
}: {
  state: CrmState
  records: WorkRecord[]
  summary: ReturnType<typeof summarizeRecords>
  currentUserId: string
  isPersonalScope: boolean
}) {
  const scopedQuotes = isPersonalScope ? records.flatMap((record) => record.quotes) : state.quotes
  const scopedPayments = isPersonalScope ? records.flatMap((record) => record.payments) : state.payments
  const scopedDocuments = isPersonalScope ? records.flatMap((record) => record.documents) : state.documents
  const scopedObjects = isPersonalScope
    ? Array.from(
        new Map(
          records
            .map((record) => record.object)
            .filter((object): object is WorkObject => Boolean(object))
            .map((object) => [object.id, object]),
        ).values(),
      )
    : state.objects
  const scopedTasks = isPersonalScope
    ? state.tasks.filter((task) => task.assignedToUserId === currentUserId || task.createdByUserId === currentUserId)
    : state.tasks
  const scopedSupplierIds = new Set(scopedQuotes.flatMap((quote) => quote.items.map((item) => item.supplierId)))
  const scopedVariantIds = new Set(scopedQuotes.flatMap((quote) => quote.items.map((item) => item.productVariantId)))
  const supplierUniverse = isPersonalScope
    ? state.suppliers.filter((supplier) => scopedSupplierIds.has(supplier.id))
    : state.suppliers
  const managerRows = isPersonalScope ? [] : buildManagerAnalyticsRows(state, records)
  const paymentRows = buildPaymentAnalyticsRows(scopedPayments)
  const totalPayments = scopedPayments.reduce((sum, payment) => sum + payment.amountPaid, 0)
  const totalInvoiced = scopedPayments.reduce((sum, payment) => sum + payment.amountTotal, 0)
  const receivables = scopedPayments.reduce((sum, payment) => sum + getPaymentDue(payment), 0)
  const overduePayments = scopedPayments.filter(isPaymentOverdue)
  const overdueAmount = overduePayments.reduce((sum, payment) => sum + getPaymentDue(payment), 0)
  const totalQuotes = scopedQuotes.length
  const acceptedQuotes = scopedQuotes.filter((quote) => quote.status === 'accepted').length
  const totalQuoteSale = scopedQuotes.reduce((sum, quote) => sum + getQuoteSaleTotal(quote), 0)
  const totalQuotePurchase = scopedQuotes.reduce((sum, quote) => sum + getQuotePurchaseTotal(quote), 0)
  const quoteMargin = scopedQuotes.reduce((sum, quote) => sum + getQuoteMargin(quote), 0)
  const quoteMarginPercent = totalQuotePurchase ? Math.round((quoteMargin / totalQuotePurchase) * 100) : 0
  const averageQuote = totalQuotes ? Math.round(totalQuoteSale / totalQuotes) : 0
  const quoteConversion = totalQuotes ? Math.round((acceptedQuotes / totalQuotes) * 100) : 0
  const closedWon = records.filter((record) => record.deal.status === 'closed_won').length
  const closedLost = records.filter((record) => record.deal.status === 'closed_lost').length
  const winRate = closedWon + closedLost ? Math.round((closedWon / (closedWon + closedLost)) * 100) : 0
  const activeRecords = records.filter((record) => !isClosedDeal(record))
  const overdueRecords = activeRecords.filter((record) => record.overdueAmount > 0)
  const urgentRecords = activeRecords.filter(isUrgentRecord)
  const recordsWithoutQuote = activeRecords.filter((record) => record.quotes.length === 0)
  const installRecords = activeRecords.filter(
    (record) => record.deal.status === 'installation' || record.object?.status === 'installation',
  )
  const openTasks = scopedTasks.filter((task) => task.status !== 'done')
  const urgentTasks = openTasks.filter(
    (task) => task.priority === 'urgent' || task.dueAt.slice(0, 10) <= demoTodayIso,
  )
  const completedTasks = scopedTasks.filter((task) => task.status === 'done')
  const documentsForReview = scopedDocuments.filter((document) => document.status === 'needs_review')
  const freshSuppliers = supplierUniverse.filter((supplier) => supplier.updateStatus === 'fresh').length
  const staleSuppliers = supplierUniverse.length - freshSuppliers
  const priceChecks = isPersonalScope
    ? state.priceHistory.filter((price) => scopedVariantIds.has(price.productVariantId)).length
    : state.priceHistory.length
  const analyticsMonths = isPersonalScope
    ? state.analyticsMonths.map((month) => ({
        month: month.month,
        deals: records.filter((record) => getAnalyticsMonthLabel(record.deal.createdAt) === month.month).length,
        quotes: scopedQuotes.filter((quote) => getAnalyticsMonthLabel(quote.createdAt) === month.month).length,
        payments: scopedPayments
          .filter((payment) => getAnalyticsMonthLabel(payment.paidAt ?? payment.expectedPaymentDate) === month.month)
          .reduce((sum, payment) => sum + (payment.amountPaid || payment.amountTotal), 0),
        overdue: scopedPayments
          .filter((payment) => isPaymentOverdue(payment) && getAnalyticsMonthLabel(payment.expectedPaymentDate) === month.month)
          .reduce((sum, payment) => sum + getPaymentDue(payment), 0),
      }))
    : state.analyticsMonths
  const maxPayment = Math.max(...analyticsMonths.map((month) => month.payments), 1)
  const maxDeals = Math.max(...analyticsMonths.map((month) => month.deals), 1)
  const maxPaymentRow = Math.max(...paymentRows.map((row) => row.amount), 1)
  const getShare = (value: number, total: number) => (total ? Math.round((value / total) * 100) : 0)
  const getBarWidth = (value: number, max: number) => (value > 0 ? getPercent(value, max) : 0)
  const analyticsBadgeTone = (tone: Tone): Tone => (tone === 'green' || tone === 'teal' ? 'blue' : tone)

  const kpiCards: Array<{
    label: string
    value: string | number
    caption: string
    progress: number
    tone: 'blue' | 'amber' | 'red' | 'slate' | 'violet'
    icon: ReactNode
  }> = [
    {
      label: isPersonalScope ? 'Мои активные проекты' : 'Активные проекты',
      value: summary.open,
      caption: isPersonalScope
        ? `${summary.total} моих всего · ${installRecords.length} на монтаже · ${urgentRecords.length} срочных`
        : `${summary.total} всего · ${installRecords.length} на монтаже · ${urgentRecords.length} срочных`,
      progress: getShare(summary.open, Math.max(summary.total, 1)),
      tone: 'blue',
      icon: <BriefcaseBusiness size={17} />,
    },
    {
      label: isPersonalScope ? 'Мой портфель' : 'Портфель работ',
      value: formatMoneyCompact(summary.pipeline),
      caption: isPersonalScope ? 'ожидаемый объем моих активных проектов' : 'ожидаемый объем активных объектов',
      progress: 86,
      tone: 'slate',
      icon: <BarChart3 size={17} />,
    },
    {
      label: 'КП и маржа',
      value: formatMoneyCompact(totalQuoteSale),
      caption: `${quoteMarginPercent}% маржа · среднее КП ${formatMoneyCompact(averageQuote)}`,
      progress: Math.min(100, Math.max(0, quoteMarginPercent * 2)),
      tone: quoteMarginPercent >= 25 ? 'blue' : 'amber',
      icon: <FileText size={17} />,
    },
    {
      label: 'Дебиторка',
      value: formatMoneyCompact(receivables),
      caption: `${formatMoneyCompact(overdueAmount)} просрочено · ${overdueRecords.length} проектов`,
      progress: getShare(receivables, Math.max(totalInvoiced, 1)),
      tone: overdueAmount ? 'red' : receivables ? 'amber' : 'blue',
      icon: <ReceiptText size={17} />,
    },
    {
      label: 'Контроль задач',
      value: openTasks.length,
      caption: `${urgentTasks.length} срочных · ${completedTasks.length} закрыто`,
      progress: getShare(openTasks.length, Math.max(openTasks.length + completedTasks.length, 1)),
      tone: urgentTasks.length ? 'amber' : 'blue',
      icon: <Bell size={17} />,
    },
    {
      label: isPersonalScope ? 'Принятые КП' : 'Прайсы',
      value: isPersonalScope ? `${acceptedQuotes}/${totalQuotes}` : `${freshSuppliers}/${supplierUniverse.length}`,
      caption: isPersonalScope
        ? `${quoteConversion}% конверсия по моим КП`
        : `${staleSuppliers} требуют проверки · ${priceChecks} ценовых срезов`,
      progress: isPersonalScope ? quoteConversion : getShare(freshSuppliers, Math.max(supplierUniverse.length, 1)),
      tone: isPersonalScope ? (quoteConversion >= 40 ? 'blue' : 'amber') : staleSuppliers ? 'amber' : 'blue',
      icon: isPersonalScope ? <CheckCircle2 size={17} /> : <PackageSearch size={17} />,
    },
  ]

  const financialRows = [
    {
      label: isPersonalScope ? 'Мой активный портфель' : 'Активный портфель объектов',
      value: summary.pipeline,
      caption: `${activeRecords.length} проектов в работе`,
      tone: 'blue',
    },
    {
      label: isPersonalScope ? 'Мои КП к продаже' : 'КП к продаже',
      value: totalQuoteSale,
      caption: `${totalQuotes} коммерческих предложений`,
      tone: 'slate',
    },
    {
      label: 'Плановая маржа КП',
      value: quoteMargin,
      caption: `${quoteMarginPercent}% к закупке`,
      tone: quoteMarginPercent >= 25 ? 'blue' : 'amber',
    },
    {
      label: isPersonalScope ? 'Оплачено по моим проектам' : 'Оплачено клиентами',
      value: totalPayments,
      caption: `${getShare(totalPayments, Math.max(totalInvoiced, 1))}% от выставленного`,
      tone: 'violet',
    },
    {
      label: 'Дебиторка к контролю',
      value: receivables,
      caption: overdueAmount ? `${formatMoneyCompact(overdueAmount)} просрочено` : 'без просроченной части',
      tone: overdueAmount ? 'red' : 'amber',
    },
  ]
  const maxFinancialValue = Math.max(...financialRows.map((row) => row.value), 1)

  const healthRings = [
    {
      label: 'Оплаты',
      value: getShare(totalPayments, Math.max(totalInvoiced, 1)),
      detail: `${formatMoneyCompact(totalPayments)} получено`,
      tone: overdueAmount ? 'red' : 'blue',
    },
    {
      label: 'Конверсия КП',
      value: quoteConversion,
      detail: `${acceptedQuotes} принято из ${totalQuotes}`,
      tone: quoteConversion >= 40 ? 'blue' : 'amber',
    },
    {
      label: 'Выигрыш сделок',
      value: winRate,
      detail: `${closedWon} выиграно · ${closedLost} проиграно`,
      tone: winRate >= 55 ? 'blue' : 'amber',
    },
    {
      label: isPersonalScope ? 'Задачи' : 'Актуальность прайсов',
      value: isPersonalScope
        ? getShare(completedTasks.length, Math.max(openTasks.length + completedTasks.length, 1))
        : getShare(freshSuppliers, Math.max(supplierUniverse.length, 1)),
      detail: isPersonalScope ? `${completedTasks.length} закрыто` : `${freshSuppliers} поставщиков обновлены`,
      tone: isPersonalScope ? (urgentTasks.length ? 'amber' : 'blue') : staleSuppliers ? 'amber' : 'blue',
    },
  ]

  const processRows = [
    {
      label: 'Новые заявки и осмотры',
      value: activeRecords.filter((record) => record.deal.status === 'new' || record.object?.status === 'survey').length,
      secondary: 'первичный вход и замер',
      tone: 'slate',
    },
    {
      label: 'КП в подготовке',
      value: activeRecords.filter(
        (record) => record.deal.status === 'quote_preparation' || record.deal.status === 'quote_ready',
      ).length,
      secondary: `${recordsWithoutQuote.length} без КП`,
      tone: recordsWithoutQuote.length ? 'amber' : 'blue',
    },
    {
      label: 'Переговоры и договор',
      value: activeRecords.filter((record) => record.deal.status === 'negotiation' || record.deal.status === 'contract').length,
      secondary: 'решение клиента и документы',
      tone: 'violet',
    },
    {
      label: 'Ожидание оплаты',
      value: activeRecords.filter((record) => record.deal.status === 'awaiting_payment' || record.dueAmount > 0).length,
      secondary: `${formatMoneyCompact(receivables)} к поступлению`,
      tone: receivables ? 'amber' : 'blue',
    },
    {
      label: 'Монтаж и закрытие',
      value: installRecords.length,
      secondary: 'выезд, фотоотчет, акты',
      tone: 'blue',
    },
  ]
  const maxProcessValue = Math.max(...processRows.map((row) => row.value), 1)

  const objectStatusRows = (Object.keys(objectStatusLabels) as WorkObject['status'][]).map((status) => ({
    status,
    label: objectStatusLabels[status],
    count: scopedObjects.filter((object) => object.status === status).length,
  }))
  const maxObjectStatus = Math.max(...objectStatusRows.map((row) => row.count), 1)

  const riskRows = activeRecords
    .map((record) => {
      const risks: string[] = []

      if (record.overdueAmount > 0) risks.push(`просрочено ${formatMoneyCompact(record.overdueAmount)}`)
      if (isUrgentRecord(record)) risks.push(getNextActionSummary(record.deal))
      if (!record.quotes.length) risks.push('нет КП')
      if (record.documents.some((document) => document.status === 'needs_review')) risks.push('документы на проверке')
      if (record.deal.paymentStatus === 'invoice_not_issued' && record.deal.expectedAmount > 0) risks.push('счет не выставлен')

      return {
        record,
        risks,
        score:
          (record.overdueAmount > 0 ? 5 : 0) +
          (isUrgentRecord(record) ? 3 : 0) +
          (!record.quotes.length ? 2 : 0) +
          (record.documents.some((document) => document.status === 'needs_review') ? 2 : 0),
      }
    })
    .filter((row) => row.risks.length > 0)
    .sort((left, right) => right.score - left.score || right.record.deal.expectedAmount - left.record.deal.expectedAmount)
    .slice(0, 5)

  const supplierRows = supplierUniverse
    .map((supplier) => {
      if (isPersonalScope) {
        const quoteItems = scopedQuotes.flatMap((quote) => quote.items.filter((item) => item.supplierId === supplier.id))
        const productIds = new Set(quoteItems.map((item) => item.supplierProductId))
        const variantIds = new Set(quoteItems.map((item) => item.productVariantId))

        return {
          supplier,
          products: productIds.size,
          variants: variantIds.size,
        }
      }

      const products = state.products.filter((product) => product.supplierId === supplier.id)
      const productIds = new Set(products.map((product) => product.id))
      const variants = state.variants.filter((variant) => productIds.has(variant.supplierProductId))

      return {
        supplier,
        products: products.length,
        variants: variants.length,
      }
    })
    .sort((left, right) => right.products - left.products)
  const maxSupplierProducts = Math.max(...supplierRows.map((row) => row.products), 1)

  return (
    <section className="work-analytics" id="analytics-screen">
      <section className="work-panel work-analytics-hero">
        <div className="work-analytics-hero-head">
          <div>
            <h2>{isPersonalScope ? 'Моя аналитика' : 'Аналитика управления NuOperator'}</h2>
            <p>
              {isPersonalScope
                ? 'Личные проекты, КП, оплаты, задачи и риски без сравнения с другими менеджерами.'
                : 'Продажи, сметы, платежи, монтаж, поставщики и операционные риски в одном рабочем контуре.'}
            </p>
          </div>
          <div className="work-analytics-hero-actions">
            <StatusBadge tone={overdueAmount ? 'red' : urgentTasks.length ? 'amber' : 'blue'}>
              {overdueAmount ? 'Есть финансовый риск' : urgentTasks.length ? 'Нужен контроль задач' : 'Контур стабилен'}
            </StatusBadge>
            <span>{formatDate(demoTodayIso)}</span>
          </div>
        </div>

      <div className="work-analytics-kpi-grid">
          {kpiCards.map((card, index) => (
            <article
              className={`work-analytics-kpi-card is-${card.tone}`}
              key={card.label}
              style={{ '--analytics-delay': `${80 + index * 45}ms` } as CSSProperties}
            >
              <div className="work-analytics-kpi-icon">{card.icon}</div>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <small>{card.caption}</small>
              <b className="work-analytics-progress">
                <i style={{ width: `${card.progress}%` }} />
              </b>
            </article>
          ))}
      </div>
      </section>

      <div className="work-analytics-layout">
        <section className="work-panel work-analytics-panel work-analytics-panel-wide work-analytics-finance-panel">
          <div className="work-analytics-panel-head">
            <div className="work-panel-title">
              <ReceiptText size={18} />
              <h3>Финансовая устойчивость</h3>
            </div>
            <span>портфель · КП · маржа · дебиторка</span>
          </div>
          <div className="work-analytics-finance-grid">
            <div className="work-analytics-finance-bars">
              {financialRows.map((row, index) => (
                <article
                  className={`work-analytics-finance-row is-${row.tone}`}
                  key={row.label}
                  style={{ '--analytics-delay': `${120 + index * 55}ms` } as CSSProperties}
                >
                  <div>
                    <strong>{row.label}</strong>
                    <small>{row.caption}</small>
                  </div>
                  <span>{formatMoneyCompact(row.value)}</span>
                  <b className="work-analytics-progress">
                    <i style={{ width: `${getBarWidth(row.value, maxFinancialValue)}%` }} />
                  </b>
                </article>
              ))}
            </div>

            <div className="work-analytics-ring-grid">
              {healthRings.map((ring, index) => (
                <article
                  className={`work-analytics-ring is-${ring.tone}`}
                  key={ring.label}
                  style={
                    {
                      '--analytics-ring': `${ring.value}%`,
                      '--analytics-delay': `${220 + index * 60}ms`,
                    } as CSSProperties
                  }
                >
                  <div>
                    <strong>{ring.value}%</strong>
                  </div>
                  <span>{ring.label}</span>
                  <small>{ring.detail}</small>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="work-panel work-analytics-panel">
          <div className="work-analytics-panel-head">
            <div className="work-panel-title">
              <Activity size={18} />
              <h3>Операционный поток</h3>
            </div>
            <span>{activeRecords.length} активных</span>
          </div>
          <div className="work-analytics-process-list">
            {processRows.map((row, index) => (
              <article
                className={`work-analytics-process-row is-${row.tone}`}
                key={row.label}
                style={{ '--analytics-delay': `${180 + index * 50}ms` } as CSSProperties}
              >
                <div>
                  <strong>{row.label}</strong>
                  <small>{row.secondary}</small>
                </div>
                <b>
                  <i style={{ width: `${getBarWidth(row.value, maxProcessValue)}%` }} />
                </b>
                <span>{row.value}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="work-panel work-analytics-panel">
          <div className="work-analytics-panel-head">
            <div className="work-panel-title">
              <Bell size={18} />
              <h3>Риски и действия</h3>
            </div>
            <StatusBadge tone={riskRows.length ? 'amber' : 'blue'}>{riskRows.length || 'чисто'}</StatusBadge>
          </div>
          <div className="work-analytics-risk-list">
            {riskRows.length ? (
              riskRows.map((row, index) => (
                <article
                  key={row.record.deal.id}
                  className={classNames('work-analytics-risk-row', row.record.overdueAmount > 0 && 'is-red')}
                  style={{ '--analytics-delay': `${220 + index * 45}ms` } as CSSProperties}
                >
                  <div>
                    <strong>{row.record.deal.title}</strong>
                    <small>{row.record.counterparty?.shortName || row.record.counterparty?.name || row.record.object?.name}</small>
                  </div>
                  <span>{row.risks.slice(0, 2).join(' · ')}</span>
                </article>
              ))
            ) : (
              <div className="work-empty">Критичных отклонений по активным проектам нет.</div>
            )}
          </div>
        </section>

        <section className="work-panel work-analytics-panel work-analytics-panel-wide work-analytics-month-panel">
          <div className="work-analytics-panel-head">
            <div className="work-panel-title">
              <BarChart3 size={18} />
              <h3>Динамика месяца</h3>
            </div>
            <span>оплаты · сделки · КП · просрочки</span>
          </div>
          <div className="work-analytics-month-chart">
            {analyticsMonths.map((month, index) => (
              <article
                className={classNames('work-analytics-month-card', month.payments === maxPayment && 'is-peak')}
                key={month.month}
                style={{ '--analytics-delay': `${260 + index * 40}ms` } as CSSProperties}
              >
                <div className="work-analytics-month-top">
                  <strong>{month.month}</strong>
                  <span>{formatMoneyCompact(month.payments)}</span>
                </div>
                <div className="work-analytics-month-plot" aria-hidden="true">
                  <i style={{ height: `${getBarWidth(month.payments, maxPayment)}%` }} />
                </div>
                <span className="work-analytics-month-activity">
                  <i style={{ width: `${getBarWidth(month.deals, maxDeals)}%` }} />
                </span>
                <div className="work-analytics-month-facts">
                  <small><b>{month.deals}</b> сделок</small>
                  <small><b>{month.quotes}</b> КП</small>
                </div>
                <em>{month.overdue ? `${formatMoneyCompact(month.overdue)} проср.` : 'без просрочек'}</em>
              </article>
            ))}
          </div>
        </section>

        <section className="work-panel work-analytics-panel">
          <div className="work-analytics-panel-head">
            <div className="work-panel-title">
              <ReceiptText size={18} />
              <h3>Статусы оплат</h3>
            </div>
            <span>{formatMoneyCompact(totalInvoiced)} выставлено</span>
          </div>
          <div className="work-analytics-status-list">
            {paymentRows.map((row, index) => (
              <article key={row.status} style={{ '--analytics-delay': `${300 + index * 45}ms` } as CSSProperties}>
                <div>
                  <StatusBadge tone={analyticsBadgeTone(row.tone)}>{row.label}</StatusBadge>
                  <strong>{formatMoneyCompact(row.amount)}</strong>
                </div>
                <span><i style={{ width: `${getBarWidth(row.amount, maxPaymentRow)}%` }} /></span>
                <small>{row.count} счетов · остаток {formatMoneyCompact(row.due)}</small>
              </article>
            ))}
          </div>
        </section>

        <section className="work-panel work-analytics-panel">
          <div className="work-analytics-panel-head">
            <div className="work-panel-title">
              <Building2 size={18} />
              <h3>Стадии объектов</h3>
            </div>
            <span>{scopedObjects.length} объектов</span>
          </div>
          <div className="work-analytics-object-list">
            {objectStatusRows.map((row, index) => (
              <article key={row.status} style={{ '--analytics-delay': `${320 + index * 35}ms` } as CSSProperties}>
                <div>
                  <strong>{row.label}</strong>
                  <small>{getShare(row.count, Math.max(scopedObjects.length, 1))}% от базы объектов</small>
                </div>
                <b><i style={{ width: `${getBarWidth(row.count, maxObjectStatus)}%` }} /></b>
                <span>{row.count}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="work-panel work-analytics-panel work-analytics-panel-wide">
          <div className="work-analytics-panel-head">
            <div className="work-panel-title">
              <PackageSearch size={18} />
              <h3>{isPersonalScope ? 'Поставщики в моих КП' : 'Поставщики и ценовая база'}</h3>
            </div>
            <span>{isPersonalScope ? `${supplierRows.length} поставщиков` : `${documentsForReview.length} документов на проверке`}</span>
          </div>
          <div className="work-analytics-supplier-list">
            {supplierRows.map((row, index) => (
              <article key={row.supplier.id} style={{ '--analytics-delay': `${360 + index * 38}ms` } as CSSProperties}>
                <div>
                  <strong>{row.supplier.name}</strong>
                  <small>{getSupplierSourceLabel(row.supplier.sourceType)} · {row.variants} вариантов</small>
                </div>
                <b><i style={{ width: `${getBarWidth(row.products, maxSupplierProducts)}%` }} /></b>
                <StatusBadge tone={analyticsBadgeTone(getCatalogUpdateTone(row.supplier.updateStatus))}>
                  {row.supplier.updateStatus === 'fresh' ? 'Актуально' : row.supplier.updateStatus === 'outdated' ? 'Старая версия' : 'Проверка'}
                </StatusBadge>
                <small>{formatDateTime(row.supplier.lastUpdatedAt)}</small>
              </article>
            ))}
          </div>
        </section>

        {!isPersonalScope ? (
        <section className="work-panel work-analytics-panel work-analytics-panel-wide">
          <div className="work-analytics-panel-head">
            <div className="work-panel-title">
              <UserCog size={18} />
              <h3>Команда и нагрузка</h3>
            </div>
            <span>{summary.reminders} активных напоминаний по проектам</span>
          </div>
          <div className="work-table-wrap work-analytics-table-wrap">
            <table className="work-table work-analytics-table">
              <thead>
                <tr>
                  <th>Сотрудник</th>
                  <th>Проекты</th>
                  <th>КП</th>
                  <th>Портфель</th>
                  <th>Остаток</th>
                  <th>Задачи</th>
                </tr>
              </thead>
              <tbody>
                {managerRows.map((row, index) => (
                  <tr key={row.userId}>
                    <td>
                      <strong>{row.name}</strong>
                      <small>{row.role}</small>
                    </td>
                    <td>
                      <strong>{row.projects}</strong>
                      <small>{row.activeProjects} активных</small>
                    </td>
                    <td>
                      <strong>{row.quotes}</strong>
                      <small>{formatMoneyCompact(row.quoteTotal)}</small>
                    </td>
                    <td>
                      <strong>{formatMoneyCompact(row.pipeline)}</strong>
                      <small>в работе</small>
                    </td>
                    <td>
                      <strong>{formatMoneyCompact(row.due)}</strong>
                      <small>по счетам</small>
                    </td>
                    <td>
                      <strong>{row.tasks}</strong>
                      <small>{index === 0 ? 'самый большой портфель' : 'активных'}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        ) : null}
      </div>
    </section>
  )
}

function SettingsScreen({
  state,
  currentUserId,
  backupAt,
  backupVersion,
  onCreateBackup,
}: {
  state: CrmState
  currentUserId: string
  backupAt: string
  backupVersion: number
  onCreateBackup: () => void
}) {
  const currentUser = state.users.find((user) => user.id === currentUserId) ?? state.users[0]
  const activeUsers = state.users.filter((user) => user.isActive)
  const draftNotes = state.installerNotes.filter((note) => note.status === 'local_draft')
  const savedNotes = state.installerNotes.filter((note) => note.status === 'saved')
  const catalogNeedsAttention = state.suppliers.filter((supplier) => supplier.updateStatus !== 'fresh')
  const latestActivity = state.activity[0]

  return (
    <section className="work-settings" id="settings-screen">
      <div className="work-settings-grid">
        <section className="work-panel work-settings-panel">
          <div className="work-panel-title">
            <UserCog size={18} />
            <h3>Пользователь</h3>
          </div>
          <div className="work-form-grid">
            <InfoField label="Имя" value={currentUser.fullName} />
            <InfoField label="Роль" value={getRoleName(state, currentUser.roleCode)} />
            <InfoField label="Логин" value={currentUser.username} />
            <InfoField label="Последний вход" value={formatDateTime(currentUser.lastLoginAt)} />
          </div>
        </section>

        <section className="work-panel work-settings-panel">
          <div className="work-panel-title">
            <DatabaseBackup size={18} />
            <h3>Резервные копии</h3>
          </div>
          <div className="work-settings-backup">
            <article>
              <span>Последняя копия</span>
              <strong>{backupAt}</strong>
              <small>Копия №{backupVersion} · данные хранятся в localStorage · {getLocalStorageSizeLabel()}</small>
            </article>
            <div className="work-settings-actions">
              <button type="button" className="work-secondary-button" onClick={onCreateBackup}>
                <Download size={16} />
                Сформировать
              </button>
              <button type="button" className="work-table-button">
                <RefreshCw size={15} />
                Проверить
              </button>
            </div>
          </div>
        </section>

        <section className="work-panel work-settings-panel">
          <div className="work-panel-title">
            <WifiOff size={18} />
            <h3>Офлайн монтажника</h3>
          </div>
          <div className="work-settings-status-grid">
            <article>
              <span>Локальные черновики</span>
              <strong>{draftNotes.length}</strong>
              <small>замеры и заметки без синхронизации</small>
            </article>
            <article>
              <span>Сохранено</span>
              <strong>{savedNotes.length}</strong>
              <small>уже доступно менеджеру</small>
            </article>
            <article>
              <span>Последнее действие</span>
              <strong>{latestActivity ? formatDateTime(latestActivity.createdAt) : 'нет данных'}</strong>
              <small>{latestActivity?.title ?? 'история пока пустая'}</small>
            </article>
          </div>
        </section>

        <section className="work-panel work-settings-panel">
          <div className="work-panel-title">
            <Settings2 size={18} />
            <h3>Источники каталога</h3>
          </div>
          <div className="work-settings-source-list">
            {state.suppliers.map((supplier) => (
              <article key={supplier.id}>
                <span>
                  <strong>{supplier.name}</strong>
                  <small>{getSupplierSourceLabel(supplier.sourceType)} · {supplier.updateNote}</small>
                </span>
                <StatusBadge tone={getCatalogUpdateTone(supplier.updateStatus)}>
                  {supplier.updateStatus === 'fresh' ? 'OK' : supplier.updateStatus === 'outdated' ? 'Обновить' : 'Проверить'}
                </StatusBadge>
              </article>
            ))}
          </div>
          {catalogNeedsAttention.length ? (
            <p className="work-panel-note">{catalogNeedsAttention.length} источника требуют внимания перед следующей загрузкой прайсов.</p>
          ) : null}
        </section>

        <section className="work-panel work-settings-panel work-settings-panel-wide">
          <div className="work-panel-title">
            <KeyRound size={18} />
            <h3>Пользователи и роли</h3>
          </div>
          <div className="work-settings-role-strip">
            {state.roles.map((role) => (
              <article key={role.id}>
                <strong>{role.name}</strong>
                <small>{role.summary}</small>
                <span>{role.permissions.length} прав</span>
              </article>
            ))}
          </div>
          <div className="work-table-wrap work-settings-table-wrap">
            <table className="work-table work-settings-user-table">
              <thead>
                <tr>
                  <th>Пользователь</th>
                  <th>Роль</th>
                  <th>Контакты</th>
                  <th>Статус</th>
                  <th>Вход</th>
                </tr>
              </thead>
              <tbody>
                {activeUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.fullName}</strong>
                      <small>{user.username}</small>
                    </td>
                    <td>
                      <strong>{getRoleName(state, user.roleCode)}</strong>
                      <small>{user.roleCode}</small>
                    </td>
                    <td>
                      <strong>{user.phone}</strong>
                      <small>{user.email}</small>
                    </td>
                    <td>
                      <StatusBadge tone={user.isActive ? 'green' : 'slate'}>{user.isActive ? 'Активен' : 'Выключен'}</StatusBadge>
                    </td>
                    <td>
                      <strong>{formatDateTime(user.lastLoginAt)}</strong>
                      <small>демо-аккаунт</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="work-panel work-settings-panel work-settings-panel-wide">
          <div className="work-panel-title">
            <Activity size={18} />
            <h3>Системные параметры</h3>
          </div>
          <div className="work-settings-toggle-grid">
            <article>
              <span>Автосохранение</span>
              <strong>Включено</strong>
              <small>КП, карточки и таблицы сохраняются локально</small>
            </article>
            <article>
              <span>Проверка дублей</span>
              <strong>Демо</strong>
              <small>по ИНН, телефону и названию контрагента</small>
            </article>
            <article>
              <span>Журнал действий</span>
              <strong>{state.activity.length}</strong>
              <small>последних событий в ленте</small>
            </article>
            <article>
              <span>Режим доступа</span>
              <strong>Ролевой</strong>
              <small>{state.roles.length} ролей · {activeUsers.length} активных пользователей</small>
            </article>
          </div>
        </section>
      </div>
    </section>
  )
}

function WorkDetails({
  state,
  record,
  currentUserId,
  selectedVariantId,
  onVariantChange,
  commit,
  onOpenKpEditor,
  onOpenCounterparty,
  onOpenProject,
  onPreviewDocument,
}: {
  state: CrmState
  record: WorkRecord
  currentUserId: string
  selectedVariantId: string
  onVariantChange: (variantId: string) => void
  commit: (updater: (state: CrmState) => CrmState) => void
  onOpenKpEditor: (dealId?: string) => void
  onOpenCounterparty: (counterpartyId: string) => void
  onOpenProject: (dealId: string) => void
  onPreviewDocument: (document: ProjectPreviewDocument) => void
}) {
  const primaryContact = record.counterparty
    ? getPrimaryContact(state, record.counterparty.id)
    : undefined
  const counterpartyId = record.counterparty?.id
  const activeQuote = record.quotes[0]
  const selectedBundle = getVariantBundle(state, selectedVariantId)
  const activity = getQuoteActivity(state, record)
  const supplierNameById = new Map(state.suppliers.map((supplier) => [supplier.id, supplier.name]))
  const contractInfo = getProjectContractInfo(record)
  const supplyInfo = getProjectSupplyInfo(state, record)
  const paymentInfo = getProjectPaymentInfo(record)
  const relatedDeals = (counterpartyId
    ? state.deals.filter((deal) => deal.counterpartyId === counterpartyId)
    : [record.deal]
  ).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  const relatedDealIds = new Set(relatedDeals.map((deal) => deal.id))
  const relatedObjects = counterpartyId
    ? state.objects.filter((object) => object.counterpartyId === counterpartyId)
    : record.object
      ? [record.object]
      : []
  const relatedObjectIds = new Set(relatedObjects.map((object) => object.id))
  const relatedQuotes = state.quotes.filter(
    (quote) => relatedDealIds.has(quote.dealId) || quote.counterpartyId === counterpartyId,
  )
  const relatedPayments = state.payments.filter(
    (payment) => relatedDealIds.has(payment.dealId) || payment.counterpartyId === counterpartyId,
  )
  const relatedDocuments = state.documents.filter(
    (document) => relatedDealIds.has(document.dealId) || document.counterpartyId === counterpartyId,
  )
  const relatedContracts = relatedDocuments.filter(
    (document) =>
      document.type === 'contract' ||
      /договор/i.test(`${document.title} ${document.originalFilename} ${document.comment}`),
  )
  const relatedTasks = state.tasks.filter(
    (task) =>
      task.counterpartyId === counterpartyId ||
      (task.dealId ? relatedDealIds.has(task.dealId) : false) ||
      (task.objectId ? relatedObjectIds.has(task.objectId) : false),
  )
  const relatedActivityIds = new Set<string>([
    counterpartyId ?? '',
    ...relatedDeals.map((deal) => deal.id),
    ...relatedObjects.map((object) => object.id),
    ...relatedQuotes.map((quote) => quote.id),
    ...relatedPayments.map((payment) => payment.id),
    ...relatedDocuments.map((document) => document.id),
  ])
  const counterpartyActivity = state.activity
    .filter((item) => relatedActivityIds.has(item.entityId))
    .slice(0, 8)
  const openRelatedDeals = relatedDeals.filter(
    (deal) => deal.status !== 'closed_won' && deal.status !== 'closed_lost',
  )
  const totalContractAmount = relatedDeals.reduce(
    (sum, deal) => sum + (deal.actualAmount || deal.expectedAmount),
    0,
  )
  const expectedCounterpartyAmount = openRelatedDeals.reduce((sum, deal) => sum + deal.expectedAmount, 0)
  const paidCounterpartyAmount = relatedPayments.reduce((sum, payment) => sum + payment.amountPaid, 0)
  const dueCounterpartyAmount = relatedPayments.reduce((sum, payment) => sum + getPaymentDue(payment), 0)
  const overdueCounterpartyAmount = relatedPayments
    .filter(isPaymentOverdue)
    .reduce((sum, payment) => sum + getPaymentDue(payment), 0)
  const activeQuotePurchaseTotal = activeQuote ? getQuotePurchaseTotal(activeQuote) : 0
  const activeQuoteSaleTotal = activeQuote ? getQuoteSaleTotal(activeQuote) : 0
  const latestQuote = relatedQuotes[0]
  const latestPayment = relatedPayments[0]
  const activeTasksCount = relatedTasks.filter((task) => task.status !== 'done').length
  const objectMeasurements = record.notes.flatMap((note) => note.measurements)
  const primaryContactValue = primaryContact
    ? `${primaryContact.fullName}, ${primaryContact.position || 'должность не указана'}`
    : 'не указан'
  const primaryContactNote = primaryContact
    ? [primaryContact.phone, primaryContact.email].filter(Boolean).join(' · ') || 'контакты не указаны'
    : 'контактное лицо не закреплено'
  const invoiceDocuments = getProjectInvoiceDocuments(record)
  const projectDocuments = getProjectDocumentsForInline(record)
  const quoteDocuments = projectDocuments.filter((document) => document.typeLabel === 'КП')
  const regularProjectDocuments = projectDocuments.filter((document) => document.typeLabel !== 'КП')
  const firstInvoiceDocument = invoiceDocuments[0]
  const firstRegularDocument = regularProjectDocuments[0] ?? projectDocuments[0]
  const paymentSummary = getProjectPaymentSummary(record)
  const saveDealText = (field: 'title' | 'description' | 'source' | 'nextActionText', value: string) => {
    const normalized = field === 'description' || field === 'nextActionText'
      ? normalizeInlineText(value)
      : normalizeInlineSingleLine(value)

    commit((current) => ({
      ...current,
      deals: current.deals.map((deal) =>
        deal.id === record.deal.id
          ? {
              ...deal,
              [field]: normalized,
              updatedAt: new Date().toISOString(),
            }
          : deal,
      ),
    }))
  }
  const saveDealAmount = (field: 'expectedAmount' | 'actualAmount', value: string) => {
    commit((current) => ({
      ...current,
      deals: current.deals.map((deal) =>
        deal.id === record.deal.id
          ? {
              ...deal,
              [field]: parseProjectAmount(value),
              updatedAt: new Date().toISOString(),
            }
          : deal,
      ),
    }))
  }
  const saveCounterpartyText = (
    field:
      | 'name'
      | 'shortName'
      | 'inn'
      | 'kpp'
      | 'ogrn'
      | 'phone'
      | 'email'
      | 'website'
      | 'legalAddress'
      | 'actualAddress'
      | 'comment',
    value: string,
    multiline = false,
  ) => {
    if (!counterpartyId) return

    const normalized = multiline ? normalizeInlineText(value) : normalizeInlineSingleLine(value)

    commit((current) => ({
      ...current,
      counterparties: current.counterparties.map((counterparty) =>
        counterparty.id === counterpartyId
          ? {
              ...counterparty,
              [field]: normalized,
              updatedAt: new Date().toISOString(),
            }
          : counterparty,
      ),
    }))
  }
  const saveCounterpartyName = (value: string) => {
    if (!counterpartyId) return

    const normalized = normalizeInlineSingleLine(value)

    commit((current) => ({
      ...current,
      counterparties: current.counterparties.map((counterparty) =>
        counterparty.id === counterpartyId
          ? {
              ...counterparty,
              name: normalized,
              shortName: normalized,
              updatedAt: new Date().toISOString(),
            }
          : counterparty,
      ),
    }))
  }
  const saveObjectText = (
    field: 'name' | 'address' | 'importantNotes' | 'comment',
    value: string,
    multiline = false,
  ) => {
    const workObjectId = record.object?.id ?? record.deal.objectId

    if (!workObjectId) return

    const normalized = multiline ? normalizeInlineText(value) : normalizeInlineSingleLine(value)

    commit((current) => ({
      ...current,
      objects: current.objects.map((object) =>
        object.id === workObjectId
          ? {
              ...object,
              [field]: normalized,
              updatedAt: new Date().toISOString(),
            }
          : object,
      ),
    }))
  }
  const saveManagerObjectConditions = (value: string) => {
    const normalized = normalizeInlineText(value)

    if (record.object?.id) {
      saveObjectText('importantNotes', normalized, true)
      return
    }

    saveDealText('description', normalized)
  }
  const saveManagerNextAction = (value: string) => saveDealText('nextActionText', value)
  const saveInstallerNoteText = (noteId: string, value: string) => {
    const normalized = normalizeInlineText(value)

    commit((current) => {
      const now = new Date().toISOString()

      if (noteId === 'installer-object-default') {
        const workObjectId = record.object?.id ?? record.deal.objectId

        if (!workObjectId || !normalized) {
          return current
        }

        const newNote: InstallerNote = {
          id: makeProjectEntityId('note'),
          objectId: workObjectId,
          dealId: record.deal.id,
          installerUserId: currentUserId,
          text: normalized,
          measurements: [],
          localClientId: makeProjectEntityId('local-note'),
          status: 'saved',
          createdOfflineAt: now,
          createdAt: now,
          updatedAt: now,
        }

        return {
          ...current,
          installerNotes: [newNote, ...current.installerNotes],
        }
      }

      return {
        ...current,
        installerNotes: current.installerNotes.map((note) =>
          note.id === noteId
            ? {
                ...note,
                text: normalized,
                updatedAt: now,
              }
            : note,
        ),
      }
    })
  }
  const managerObjectComments = [
    {
      id: 'manager-object-conditions',
      author: getUserName(state, record.deal.responsibleUserId),
      role: 'Менеджер проекта',
      date: safeFormatDateTime(record.deal.updatedAt),
      title: 'Особенности объекта со слов заказчика',
      text:
        record.object?.importantNotes ||
        record.object?.comment ||
        record.deal.description ||
        'Заказчик просит предварительно согласовать время доступа, контакт ответственного на объекте и порядок передачи материалов. Перед выездом нужно подтвердить адрес, режим работы объекта и возможность заноса оборудования.',
      editValue: record.object?.importantNotes || record.object?.comment || record.deal.description || '',
      onSave: saveManagerObjectConditions,
    },
    {
      id: 'manager-next-action',
      author: getUserName(state, record.deal.responsibleUserId),
      role: 'Менеджер проекта',
      date: safeFormatDateTime(record.deal.nextActionAt),
      title: 'Комментарий к следующему действию',
      text: record.deal.nextActionText.trim() || 'Следующее действие не заполнено.',
      editValue: record.deal.nextActionText,
      onSave: saveManagerNextAction,
    },
  ]
  const installerObjectComments = record.notes.length
    ? record.notes.map((note, index) => ({
        id: note.id,
        author: getUserName(state, note.installerUserId),
        role: 'Монтажник',
        date: safeFormatDateTime(note.createdAt || note.createdOfflineAt),
        title: `Заметка с объекта ${index + 1}`,
        text: [
          note.text,
          note.measurements.length
            ? `Замеры: ${note.measurements.map((measurement) => `${measurement.label}: ${measurement.value}`).join(', ')}.`
            : '',
        ].filter(Boolean).join(' '),
        editValue: note.text,
        onSave: (value: string) => saveInstallerNoteText(note.id, value),
      }))
    : [
        {
          id: 'installer-object-default',
          author: 'Монтажная группа',
          role: 'Монтажник',
          date: 'после выезда',
          title: 'Что проверить на месте',
          text: 'Перед монтажом нужно осмотреть основание под крепеж, проверить ширину проходов, состояние стен и пола, наличие препятствий для установки, а также согласовать с представителем заказчика места крепления и порядок уборки после работ.',
          editValue: '',
          onSave: (value: string) => saveInstallerNoteText('installer-object-default', value),
        },
      ]

  const projectFields: ProjectDetailField[] = [
    {
      label: 'Номер проекта',
      value: record.deal.number,
      note: `создан ${formatDate(record.deal.createdAt)}`,
    },
    {
      label: 'Наименование проекта',
      value: record.deal.title || 'не указано',
      note: record.deal.description || 'описание не заполнено',
      wide: true,
      edit: {
        value: record.deal.title,
        onSave: (value) => saveDealText('title', value),
      },
    },
    {
      label: 'Описание проекта',
      value: record.deal.description || 'не заполнено',
      note: 'внутреннее описание проекта',
      wide: true,
      edit: {
        value: record.deal.description,
        multiline: true,
        onSave: (value) => saveDealText('description', value),
      },
    },
    {
      label: 'Статус проекта',
      value: dealStatusLabels[record.deal.status],
      note: `обновлено ${safeFormatDateTime(record.deal.updatedAt)}`,
      tone: record.deal.status === 'closed_lost' ? 'red' : 'blue',
    },
    {
      label: 'Ответственный',
      value: getUserName(state, record.deal.responsibleUserId),
      note: 'основной исполнитель по проекту',
    },
    {
      label: 'Источник обращения',
      value: record.deal.source || 'не указан',
      note: 'канал поступления обращения',
      edit: {
        value: record.deal.source,
        onSave: (value) => saveDealText('source', value),
      },
    },
    {
      label: 'Следующее действие',
      value: getNextActionSummary(record.deal),
      note: getNextActionDetail(record.deal),
      tone: record.deal.nextActionAt && relativeAction(record.deal.nextActionAt).startsWith('просрочено') ? 'red' : 'slate',
      wide: true,
      edit: {
        value: record.deal.nextActionText,
        multiline: true,
        onSave: (value) => saveDealText('nextActionText', value),
      },
    },
    {
      label: 'Плановая сумма договора',
      value: formatMoney(record.deal.expectedAmount),
      note: 'по текущей карточке проекта',
      edit: {
        value: String(record.deal.expectedAmount || ''),
        type: 'number',
        inputMode: 'decimal',
        onSave: (value) => saveDealAmount('expectedAmount', value),
      },
    },
    {
      label: 'Фактическая сумма',
      value: record.deal.actualAmount ? formatMoney(record.deal.actualAmount) : 'не указана',
      note: record.deal.closedAt ? `закрыто ${formatDate(record.deal.closedAt)}` : 'уточняется в ходе проекта',
      edit: {
        value: String(record.deal.actualAmount || ''),
        type: 'number',
        inputMode: 'decimal',
        onSave: (value) => saveDealAmount('actualAmount', value),
      },
    },
    {
      label: 'Состояние договора',
      value: contractInfo.value,
      note: contractInfo.detail,
      tone: contractInfo.value === '—' ? 'amber' : 'green',
    },
  ]

  const counterpartyFields: ProjectDetailField[] = [
    {
      label: 'Контрагент',
      value: record.counterparty?.shortName || record.counterparty?.name || 'не указан',
      note: record.counterparty?.name || 'наименование не заполнено',
      wide: true,
      edit: counterpartyId
        ? {
            value: record.counterparty?.shortName || record.counterparty?.name || '',
            onSave: saveCounterpartyName,
          }
        : undefined,
    },
    {
      label: 'Тип контрагента',
      value: record.counterparty ? counterpartyTypeLabels[record.counterparty.type] : 'не указан',
      note: record.counterparty ? counterpartyStatusLabels[record.counterparty.status] : 'статус не указан',
    },
    {
      label: 'ИНН',
      value: record.counterparty?.inn || 'не указан',
      note: 'обязателен для договора и счета',
      tone: record.counterparty?.inn ? 'green' : 'amber',
      edit: counterpartyId
        ? {
            value: record.counterparty?.inn || '',
            inputMode: 'numeric',
            onSave: (value) => saveCounterpartyText('inn', value),
          }
        : undefined,
    },
    {
      label: 'КПП',
      value: record.counterparty?.kpp || 'не указан',
      note: 'для организаций',
      edit: counterpartyId
        ? {
            value: record.counterparty?.kpp || '',
            inputMode: 'numeric',
            onSave: (value) => saveCounterpartyText('kpp', value),
          }
        : undefined,
    },
    {
      label: 'ОГРН',
      value: record.counterparty?.ogrn || 'не указан',
      note: 'регистрационный номер',
      edit: counterpartyId
        ? {
            value: record.counterparty?.ogrn || '',
            inputMode: 'numeric',
            onSave: (value) => saveCounterpartyText('ogrn', value),
          }
        : undefined,
    },
    {
      label: 'Телефон',
      value: record.counterparty?.phone || 'не указан',
      note: 'общий телефон контрагента',
      edit: counterpartyId
        ? {
            value: record.counterparty?.phone || '',
            type: 'tel',
            inputMode: 'tel',
            onSave: (value) => saveCounterpartyText('phone', value),
          }
        : undefined,
    },
    {
      label: 'Email',
      value: record.counterparty?.email || 'не указан',
      note: 'адрес для переписки',
      edit: counterpartyId
        ? {
            value: record.counterparty?.email || '',
            type: 'email',
            inputMode: 'email',
            onSave: (value) => saveCounterpartyText('email', value),
          }
        : undefined,
    },
    {
      label: 'Сайт',
      value: record.counterparty?.website || 'не указан',
      note: 'официальный сайт',
      edit: counterpartyId
        ? {
            value: record.counterparty?.website || '',
            type: 'url',
            inputMode: 'url',
            onSave: (value) => saveCounterpartyText('website', value),
          }
        : undefined,
    },
    {
      label: 'Юридический адрес',
      value: record.counterparty?.legalAddress || 'не указан',
      note: 'для договора и закрывающих документов',
      wide: true,
      edit: counterpartyId
        ? {
            value: record.counterparty?.legalAddress || '',
            multiline: true,
            onSave: (value) => saveCounterpartyText('legalAddress', value, true),
          }
        : undefined,
    },
    {
      label: 'Фактический адрес',
      value: record.counterparty?.actualAddress || 'не указан',
      note: 'адрес для доставки корреспонденции',
      wide: true,
      edit: counterpartyId
        ? {
            value: record.counterparty?.actualAddress || '',
            multiline: true,
            onSave: (value) => saveCounterpartyText('actualAddress', value, true),
          }
        : undefined,
    },
    {
      label: 'Основное контактное лицо',
      value: primaryContactValue,
      note: primaryContactNote,
      wide: true,
    },
    {
      label: 'Комментарий по контрагенту',
      value: record.counterparty?.comment || 'не заполнен',
      note: 'служебная информация',
      wide: true,
      edit: counterpartyId
        ? {
            value: record.counterparty?.comment || '',
            multiline: true,
            onSave: (value) => saveCounterpartyText('comment', value, true),
          }
        : undefined,
    },
  ]

  const objectFields: ProjectDetailField[] = [
    {
      label: 'Объект работ',
      value: record.object?.name || 'не указан',
      note: record.object ? objectStatusLabels[record.object.status] : 'объект не закреплен',
      wide: true,
      edit: record.deal.objectId
        ? {
            value: record.object?.name || '',
            onSave: (value) => saveObjectText('name', value),
          }
        : undefined,
    },
    {
      label: 'Адрес объекта',
      value: record.object?.address || 'не указан',
      note: 'адрес выполнения работ или поставки',
      wide: true,
      edit: record.deal.objectId
        ? {
            value: record.object?.address || '',
            multiline: true,
            onSave: (value) => saveObjectText('address', value, true),
          }
        : undefined,
    },
    {
      label: 'Ответственный менеджер',
      value: record.object ? getUserName(state, record.object.responsibleManagerId) : 'не назначен',
      note: 'по объекту',
    },
    {
      label: 'Монтажная группа',
      value: record.object ? getUserName(state, record.object.assignedInstallerId) : 'не назначена',
      note: 'исполнитель на объекте',
    },
    {
      label: 'Координаты',
      value: record.object?.geoLat && record.object?.geoLng
        ? `${record.object.geoLat}, ${record.object.geoLng}`
        : 'не указаны',
      note: 'для выезда и логистики',
    },
    {
      label: 'Особые условия',
      value: record.object?.importantNotes || 'не указаны',
      note: 'ограничения доступа, режим работ, требования заказчика',
      wide: true,
      edit: record.deal.objectId
        ? {
            value: record.object?.importantNotes || '',
            multiline: true,
            onSave: (value) => saveObjectText('importantNotes', value, true),
          }
        : undefined,
    },
    {
      label: 'Комментарий по объекту',
      value: record.object?.comment || 'не заполнен',
      note: 'дополнительная информация',
      wide: true,
      edit: record.deal.objectId
        ? {
            value: record.object?.comment || '',
            multiline: true,
            onSave: (value) => saveObjectText('comment', value, true),
          }
        : undefined,
    },
    {
      label: 'Заметки с объекта',
      value: record.notes.length ? `${record.notes.length} записей` : 'нет записей',
      note: objectMeasurements.length
        ? objectMeasurements.map((item) => `${item.label}: ${item.value}`).join(', ')
        : 'замеры не добавлены',
      wide: true,
    },
  ]

  const documentPaymentFields: ProjectDetailField[] = [
    {
      label: 'Коммерческие предложения',
      value: record.quotes.length ? `${record.quotes.length} шт.` : 'нет',
      note: activeQuote ? `${activeQuote.number}; ${quoteStatusLabels[activeQuote.status]}` : 'по проекту не создано',
      actionLabel: 'Открыть КП',
      onClick: () => onOpenKpEditor(record.deal.id),
    },
    {
      label: 'Закупка по текущему КП',
      value: activeQuote ? formatMoney(activeQuotePurchaseTotal) : 'не указана',
      note: 'сумма закупки по позициям',
    },
    {
      label: 'Продажа по текущему КП',
      value: activeQuote ? formatMoney(activeQuoteSaleTotal) : 'не указана',
      note: 'с учетом заданных цен продажи',
      tone: activeQuote ? 'blue' : 'slate',
    },
    {
      label: 'Маржа по текущему КП',
      value: activeQuote ? formatMoney(getQuoteMargin(activeQuote)) : 'не рассчитана',
      note: activeQuote ? `${getQuoteMarginPercent(activeQuote)}%` : 'нет позиций',
    },
    {
      label: 'Счета по проекту',
      value: record.payments.length ? `${record.payments.length} шт.` : 'нет',
      note: latestPayment ? `${latestPayment.invoiceNumber}; ${paymentStatusLabels[latestPayment.status]}` : 'счет не выставлен',
      actionLabel: firstInvoiceDocument ? 'Открыть первый счет' : undefined,
      onClick: firstInvoiceDocument ? () => onPreviewDocument(firstInvoiceDocument) : undefined,
    },
    {
      label: 'Оплачено по проекту',
      value: formatMoney(record.payments.reduce((sum, payment) => sum + payment.amountPaid, 0)),
      note: `остаток ${formatMoney(record.dueAmount)}`,
      tone: record.dueAmount ? 'amber' : 'green',
    },
    {
      label: 'Просроченная задолженность',
      value: formatMoney(record.overdueAmount),
      note: record.overdueAmount ? 'требуется контроль оплаты' : 'просрочки нет',
      tone: record.overdueAmount ? 'red' : 'green',
    },
    {
      label: 'Документы по проекту',
      value: record.documents.length ? `${record.documents.length} шт.` : 'нет',
      note: record.documents[0]?.title || 'документы не приложены',
      actionLabel: firstRegularDocument ? 'Открыть первый документ' : undefined,
      onClick: firstRegularDocument ? () => onPreviewDocument(firstRegularDocument) : undefined,
    },
    {
      label: 'Договоры',
      value: relatedContracts.length ? `${relatedContracts.length} шт.` : 'нет',
      note: relatedContracts[0]?.title || 'договор не приложен',
      tone: relatedContracts.length ? 'green' : 'amber',
    },
    {
      label: 'Активные напоминания',
      value: activeTasksCount ? `${activeTasksCount} шт.` : 'нет',
      note: relatedTasks[0]?.title || 'задачи не назначены',
    },
  ]

  const counterpartyStatFields: ProjectDetailField[] = [
    {
      label: 'Проектов с контрагентом',
      value: relatedDeals.length,
      note: `${openRelatedDeals.length} в работе`,
    },
    {
      label: 'Сумма договоров за все время',
      value: formatMoney(totalContractAmount),
      note: 'по проектам данного контрагента',
      tone: 'blue',
    },
    {
      label: 'Ожидается по действующим проектам',
      value: formatMoney(expectedCounterpartyAmount),
      note: 'плановая сумма незакрытых проектов',
    },
    {
      label: 'Оплачено за все время',
      value: formatMoney(paidCounterpartyAmount),
      note: 'по счетам данного контрагента',
      tone: 'green',
    },
    {
      label: 'Ожидается к оплате',
      value: formatMoney(dueCounterpartyAmount),
      note: 'остаток по выставленным счетам',
      tone: dueCounterpartyAmount ? 'amber' : 'green',
    },
    {
      label: 'Просроченная задолженность',
      value: formatMoney(overdueCounterpartyAmount),
      note: overdueCounterpartyAmount ? 'есть просроченные счета' : 'просрочки нет',
      tone: overdueCounterpartyAmount ? 'red' : 'green',
    },
    {
      label: 'Коммерческих предложений',
      value: relatedQuotes.length,
      note: latestQuote ? `последнее: ${latestQuote.number}` : 'не создавались',
    },
    {
      label: 'Документов',
      value: relatedDocuments.length,
      note: `${relatedContracts.length} договоров`,
    },
  ]
  const catalogOptions = state.variants
    .map((variant) => {
      const bundle = getVariantBundle(state, variant.id)
      return { variant, product: bundle.product, supplier: bundle.supplier }
    })
    .filter((item) => item.product && item.supplier)
    .slice(0, 12)

  return (
    <section className="work-detail" id="work-detail" aria-label={`Карточка проекта ${record.deal.number}`}>
      <div className="work-detail-head">
        <div>
          <span>Карточка проекта</span>
          <h2>{record.deal.number} · {record.deal.title || 'Новый проект'}</h2>
        </div>
        <div className="work-detail-actions">
          {counterpartyId ? (
            <button type="button" className="work-secondary-button" onClick={() => onOpenCounterparty(counterpartyId)}>
              <ExternalLink size={16} />
              Открыть контрагента
            </button>
          ) : null}
          <button type="button" className="work-primary-button" onClick={() => onOpenKpEditor(record.deal.id)}>
            <FileText size={16} />
            Создать КП
          </button>
        </div>
      </div>

      <div className="work-detail-summary-grid" aria-label="Ключевые показатели проекта">
        <article>
          <span>Статус проекта</span>
          <strong>{dealStatusLabels[record.deal.status]}</strong>
          <small>{record.deal.source || 'источник не указан'} · обновлено {safeFormatDateTime(record.deal.updatedAt)}</small>
        </article>
        <article>
          <span>Договор</span>
          <strong>{contractInfo.value}</strong>
          <small>{contractInfo.detail}</small>
        </article>
        <article>
          <span>Поставка</span>
          <strong>{supplyInfo.source}</strong>
          <small>{supplyInfo.invoice}</small>
        </article>
        <article className={record.overdueAmount ? 'is-danger' : ''}>
          <span>Оплата</span>
          <strong>{paymentInfo.value}</strong>
          <small>{paymentInfo.detail}</small>
        </article>
      </div>

      <section className="work-panel work-panel-wide work-detail-section work-detail-documents-priority">
        <div className="work-panel-title">
          <FileText size={18} />
          <h3>Счета, КП и документы</h3>
        </div>
        <div className="work-project-info-grid work-detail-document-grid">
          <article className="work-project-info-card work-project-info-card-docs work-detail-document-card">
            <span>Счета</span>
            <p>{paymentSummary}</p>
            <ProjectDocumentList documents={invoiceDocuments} onPreview={onPreviewDocument} />
          </article>

          <article className="work-project-info-card work-project-info-card-docs work-detail-document-card">
            <span>КП</span>
            <p>
              {activeQuote
                ? `${activeQuote.number}; ${quoteStatusLabels[activeQuote.status]}; позиций ${activeQuote.items.length}; сумма продажи ${formatMoney(activeQuoteSaleTotal)}.`
                : 'Коммерческое предложение можно собрать в конструкторе и сохранить в проект.'}
            </p>
            <div className="work-detail-document-action">
              <button type="button" className="work-table-button" onClick={() => onOpenKpEditor(record.deal.id)}>
                <FileText size={15} />
                Открыть КП
              </button>
            </div>
            <ProjectDocumentList
              documents={quoteDocuments.length ? quoteDocuments : projectDocuments.slice(0, 1)}
              onPreview={onPreviewDocument}
            />
          </article>

          <article className="work-project-info-card work-project-info-card-docs work-detail-document-card">
            <span>Документы</span>
            <p>Договоры, планы, технические материалы и рабочие файлы по объекту.</p>
            <ProjectDocumentList
              documents={regularProjectDocuments.length ? regularProjectDocuments : projectDocuments}
              onPreview={onPreviewDocument}
            />
          </article>
        </div>
      </section>

      <div className="work-detail-grid">
        <section className="work-panel work-detail-section">
          <div className="work-panel-title">
            <BriefcaseBusiness size={18} />
            <h3>Сведения о проекте</h3>
          </div>
          <div className="work-project-info-grid work-project-detail-grid">
            {projectFields.map((field) => (
              <ProjectDetailInfoCard key={field.label} field={field} />
            ))}
          </div>
        </section>

        <section className="work-panel work-detail-section">
          <div className="work-panel-title">
            <Building2 size={18} />
            <h3>Сведения о контрагенте</h3>
          </div>
          <div className="work-project-info-grid work-project-detail-grid">
            {counterpartyFields.map((field) => (
              <ProjectDetailInfoCard key={field.label} field={field} />
            ))}
          </div>
        </section>

        <section className="work-panel work-detail-section">
          <div className="work-panel-title">
            <Wrench size={18} />
            <h3>Объект работ</h3>
          </div>
          <div className="work-project-info-grid work-project-detail-grid">
            {objectFields.map((field) => (
              <ProjectDetailInfoCard key={field.label} field={field} />
            ))}
          </div>
        </section>

        <section className="work-panel work-detail-section">
          <div className="work-panel-title">
            <Pencil size={18} />
            <h3>Свободные комментарии по объекту</h3>
          </div>
          <div className="work-object-comment-grid">
            <div className="work-object-comment-column">
              <b>Комментарии менеджера</b>
              {managerObjectComments.map((comment) => (
                <WorkObjectCommentCard key={comment.id} comment={comment} />
              ))}
            </div>
            <div className="work-object-comment-column">
              <b>Комментарии монтажника</b>
              {installerObjectComments.map((comment) => (
                <WorkObjectCommentCard key={comment.id} comment={comment} />
              ))}
            </div>
          </div>
        </section>

        <section className="work-panel work-detail-section">
          <div className="work-panel-title">
            <ReceiptText size={18} />
            <h3>Документы и расчеты</h3>
          </div>
          <div className="work-project-info-grid work-project-detail-grid">
            {documentPaymentFields.map((field) => (
              <ProjectDetailInfoCard key={field.label} field={field} />
            ))}
          </div>
        </section>

        <section className="work-panel work-detail-section">
          <div className="work-panel-title">
            <Activity size={18} />
            <h3>История взаимодействия с контрагентом</h3>
          </div>
          <div className="work-project-info-grid work-project-detail-grid">
            {counterpartyStatFields.map((field) => (
              <ProjectDetailInfoCard key={field.label} field={field} />
            ))}
          </div>
          <div className="work-counterparty-history-grid">
            <div className="work-counterparty-history-block">
              <b>Проекты данного контрагента</b>
              <div className="work-counterparty-project-list">
                {relatedDeals.slice(0, 8).map((deal) => {
                  const projectPayments = relatedPayments.filter((payment) => payment.dealId === deal.id)
                  const projectPaid = projectPayments.reduce((sum, payment) => sum + payment.amountPaid, 0)
                  const projectDue = projectPayments.reduce((sum, payment) => sum + getPaymentDue(payment), 0)

                  const content = (
                    <>
                      <div>
                        <strong>{deal.number} · {deal.title || 'Новый проект'}</strong>
                        <small>
                          {dealStatusLabels[deal.status]} · договор {formatMoney(deal.actualAmount || deal.expectedAmount)} · оплачено {formatMoney(projectPaid)} · остаток {formatMoney(projectDue)}
                        </small>
                      </div>
                      <span className="work-table-button" aria-hidden="true">
                        {deal.id === record.deal.id ? 'Открыт' : 'Открыть'}
                      </span>
                    </>
                  )

                  if (deal.id === record.deal.id) {
                    return (
                      <article key={deal.id} className="is-current">
                        {content}
                      </article>
                    )
                  }

                  return (
                    <button
                      key={deal.id}
                      type="button"
                      className="work-counterparty-project-row"
                      onClick={() => onOpenProject(deal.id)}
                    >
                      {content}
                    </button>
                  )
                })}
                {!relatedDeals.length ? <div className="work-empty">Связанные проекты не найдены.</div> : null}
              </div>
            </div>
            <div className="work-counterparty-history-block">
              <b>Последние действия</b>
              <div className="work-counterparty-activity-list">
                {counterpartyActivity.length ? (
                  counterpartyActivity.map((item) => (
                    <article key={item.id}>
                      <span>{safeFormatDateTime(item.createdAt)}</span>
                      <strong>{item.title}</strong>
                      <small>{item.details}</small>
                    </article>
                  ))
                ) : (
                  <div className="work-empty">История действий пока не заполнена.</div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="work-panel work-panel-wide">
          <div className="work-panel-title">
            <FileText size={18} />
            <h3>Коммерческое предложение</h3>
          </div>

          {activeQuote ? (
            <>
              <div className="work-quote-summary">
                <article>
                  <span>КП</span>
                  <strong>{activeQuote.number}</strong>
                  <small>{quoteStatusLabels[activeQuote.status]}</small>
                </article>
                <article>
                  <span>Закупка</span>
                  <strong>{formatMoney(getQuotePurchaseTotal(activeQuote))}</strong>
                  <small>сумма закупки по позициям</small>
                </article>
                <article>
                  <span>Продажа</span>
                  <strong>{formatMoney(getQuoteSaleTotal(activeQuote))}</strong>
                  <small>с учетом заданных цен продажи</small>
                </article>
                <article>
                  <span>Маржа</span>
                  <strong>{formatMoney(getQuoteMargin(activeQuote))}</strong>
                  <small>{getQuoteMarginPercent(activeQuote)}%</small>
                </article>
              </div>

              <div className="work-catalog-inline">
                <label>
                  <span>Добавить товар из каталога</span>
                  <select value={selectedVariantId} onChange={(event) => onVariantChange(event.target.value)}>
                    {catalogOptions.map(({ variant, product, supplier }) => (
                      <option key={variant.id} value={variant.id}>
                        {product!.name} · {variant.variantName} · {supplier!.name} · {formatMoney(variant.purchasePrice)}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="work-secondary-button"
                  disabled={!selectedBundle.variant}
                  onClick={() =>
                    commit((current) =>
                      addQuoteItemFromVariant(current, activeQuote.id, selectedVariantId, currentUserId),
                    )
                  }
                >
                  <PackageSearch size={16} />
                  Добавить в КП
                </button>
              </div>

              <div className="work-quote-table" role="table" aria-label="Позиции КП">
                <div className="work-quote-row is-head" role="row">
                  <span>Товар</span>
                  <span>Поставщик</span>
                  <span>Закупка</span>
                  <span>Кол-во</span>
                  <span>Продажа</span>
                  <span>Итого</span>
                </div>
                {activeQuote.items.map((item) => (
                  <div className="work-quote-row" role="row" key={item.id}>
                    <span>
                      <strong>{item.name}</strong>
                      <small>{item.sku} · {item.size} · {item.color}</small>
                    </span>
                    <span>{supplierNameById.get(item.supplierId) ?? 'не указан'}</span>
                    <span>{formatMoney(item.purchasePrice)}</span>
                    <span>
                      <input
                        aria-label={`Количество ${item.name}`}
                        type="number"
                        min={1}
                        value={item.qty}
                        onChange={(event) =>
                          commit((current) =>
                            updateQuoteItemQty(current, activeQuote.id, item.id, Number(event.target.value)),
                          )
                        }
                      />
                    </span>
                    <span>
                      <input
                        aria-label={`Цена продажи ${item.name}`}
                        type="number"
                        min={0}
                        value={item.salePrice}
                        onChange={(event) =>
                          commit((current) =>
                            updateQuoteItemSalePrice(current, activeQuote.id, item.id, Number(event.target.value)),
                          )
                        }
                      />
                    </span>
                    <span>{formatMoney(item.salePrice * item.qty)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="work-empty work-empty-action">
              <span>КП еще не создано для этого проекта. Откройте пустой конструктор, выберите товары и сохраните документ в эту карточку.</span>
              <button type="button" className="work-primary-button" onClick={() => onOpenKpEditor(record.deal.id)}>
                <FileText size={16} />
                Создать КП
              </button>
            </div>
          )}
        </section>

        <section className="work-panel">
          <div className="work-panel-title">
            <ReceiptText size={18} />
            <h3>Оплаты и задолженность</h3>
          </div>
          <div className="work-payment-list">
            {record.payments.map((payment) => (
              <article key={payment.id} className={classNames(isPaymentOverdue(payment) && 'is-danger')}>
                <div>
                  <StatusBadge tone={isPaymentOverdue(payment) ? 'red' : payment.status === 'paid' ? 'green' : 'amber'}>
                    {isPaymentOverdue(payment) ? 'Просрочка' : paymentStatusLabels[payment.status]}
                  </StatusBadge>
                  <strong>{payment.invoiceNumber}</strong>
                </div>
                <span>{formatMoney(payment.amountPaid)} оплачено из {formatMoney(payment.amountTotal)}</span>
                <small>Ожидали: {formatDate(payment.expectedPaymentDate)} · остаток {formatMoney(getPaymentDue(payment))}</small>
                {payment.status !== 'paid' ? (
                  <button
                    type="button"
                    className="work-table-button"
                    onClick={() => commit((current) => markPaymentPaid(current, payment.id, currentUserId))}
                  >
                    <CheckCircle2 size={15} />
                    Закрыть оплату
                  </button>
                ) : null}
              </article>
            ))}
            {!record.payments.length ? <div className="work-empty">Счетов по проекту пока нет.</div> : null}
          </div>
        </section>

        <section className="work-panel">
          <div className="work-panel-title">
            <CalendarDays size={18} />
            <h3>Документы и рабочие действия</h3>
          </div>
          <div className="work-linked-stack">
            <div>
              <b>Документы</b>
              {record.documents.length ? (
                record.documents.map((document) => (
                  <p key={document.id}>
                    <FileText size={14} />
                    <span>{document.title}</span>
                    <small>{formatBytes(document.sizeBytes)}</small>
                  </p>
                ))
              ) : (
                <small>Документы не приложены.</small>
              )}
            </div>

            <div>
              <b>Напоминания</b>
              {record.reminders.length ? (
                record.reminders.map((reminder) => (
                  <p key={reminder.id} className={reminder.status === 'done' ? 'is-muted' : ''}>
                    <ChevronDown size={14} />
                    <span>{reminder.title}</span>
                    <small>{formatDateTime(reminder.dueAt)}</small>
                  </p>
                ))
              ) : (
                <small>Активных напоминаний нет.</small>
              )}
            </div>

            <div>
              <b>Заметки с объекта</b>
              {record.notes.length ? (
                record.notes.map((note) => (
                  <p key={note.id}>
                    <Wrench size={14} />
                    <span>{note.text}</span>
                    <small>{note.measurements.map((item) => `${item.label}: ${item.value}`).join(', ')}</small>
                  </p>
                ))
              ) : (
                <small>Заметок пока нет.</small>
              )}
            </div>

            <div>
              <b>Последние действия</b>
              {activity.length ? (
                activity.map((item) => (
                  <p key={item.id}>
                    <ShieldCheck size={14} />
                    <span>{item.title}</span>
                    <small>{getUserName(state, item.actorUserId)} · {formatDateTime(item.createdAt)}</small>
                  </p>
                ))
              ) : (
                <small>История по проекту пока пустая.</small>
              )}
            </div>
          </div>
        </section>
      </div>
    </section>
  )
}

function CounterpartyWindow({
  state,
  counterpartyId,
  onClose,
}: {
  state: CrmState
  counterpartyId: string
  onClose: () => void
}) {
  const counterparty = state.counterparties.find((item) => item.id === counterpartyId)

  if (!counterparty) {
    return null
  }

  const contacts = state.contacts.filter((contact) => contact.counterpartyId === counterparty.id)
  const objects = state.objects.filter((object) => object.counterpartyId === counterparty.id)
  const deals = state.deals.filter((deal) => deal.counterpartyId === counterparty.id)
  const payments = state.payments.filter((payment) => payment.counterpartyId === counterparty.id)
  const documents = state.documents.filter((document) => document.counterpartyId === counterparty.id)
  const contracts = documents.filter(
    (document) =>
      document.type === 'contract' ||
      /договор/i.test(`${document.title} ${document.originalFilename} ${document.comment}`),
  )
  const quotes = state.quotes.filter((quote) => quote.counterpartyId === counterparty.id)
  const tasks = state.tasks.filter(
    (task) =>
      task.counterpartyId === counterparty.id ||
      deals.some((deal) => deal.id === task.dealId) ||
      objects.some((object) => object.id === task.objectId),
  )
  const activity = state.activity
    .filter((item) => item.entityId === counterparty.id || deals.some((deal) => deal.id === item.entityId))
    .slice(0, 6)

  return (
    <div className="work-window-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="work-counterparty-window"
        role="dialog"
        aria-modal="true"
        aria-label={`Окно контрагента ${counterparty.shortName}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span>Окно контрагента</span>
            <h2>{counterparty.name}</h2>
          </div>
          <button type="button" className="work-icon-button" aria-label="Закрыть окно" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="work-window-grid">
          <section>
            <h3>Реквизиты</h3>
            <dl>
              <div><dt>Полное наименование</dt><dd>{counterparty.name}</dd></div>
              <div><dt>Краткое наименование</dt><dd>{counterparty.shortName}</dd></div>
              <div><dt>ИНН / КПП</dt><dd>{counterparty.inn || 'не указан'} / {counterparty.kpp || 'не указан'}</dd></div>
              <div><dt>ОГРН</dt><dd>{counterparty.ogrn || 'не указан'}</dd></div>
              <div><dt>Телефон</dt><dd>{counterparty.phone || 'не указан'}</dd></div>
              <div><dt>Email</dt><dd>{counterparty.email || 'не указан'}</dd></div>
              <div><dt>Сайт</dt><dd>{counterparty.website || 'не указан'}</dd></div>
            </dl>
          </section>

          <section>
            <h3>Учетная информация</h3>
            <div className="work-window-stats">
              <article><span>Проекты</span><strong>{deals.length}</strong></article>
              <article><span>Объекты</span><strong>{objects.length}</strong></article>
              <article><span>Договоры</span><strong>{contracts.length}</strong></article>
              <article><span>Документы</span><strong>{documents.length}</strong></article>
            </div>
            <dl>
              <div><dt>Статус</dt><dd>{counterpartyStatusLabels[counterparty.status]}</dd></div>
              <div><dt>Ответственный</dt><dd>{getUserName(state, counterparty.responsibleUserId)}</dd></div>
              <div><dt>Юр. адрес</dt><dd>{counterparty.legalAddress || 'не указан'}</dd></div>
              <div><dt>Факт. адрес</dt><dd>{counterparty.actualAddress || 'не указан'}</dd></div>
              <div><dt>Комментарий</dt><dd>{counterparty.comment || 'без комментария'}</dd></div>
              <div><dt>Обновлено</dt><dd>{formatDateTime(counterparty.updatedAt)}</dd></div>
            </dl>
          </section>

          <section>
            <h3>Контактные лица</h3>
            <div className="work-window-list">
              {contacts.map((contact) => (
                <article key={contact.id}>
                  <strong>{contact.fullName}</strong>
                  <span>{contact.position}</span>
                  <small>{contact.phone} · {contact.email}</small>
                </article>
              ))}
            </div>
          </section>

          <section>
            <h3>Договоры</h3>
            <div className="work-window-list">
              {contracts.map((document) => (
                <article key={document.id}>
                  <strong>{document.title}</strong>
                  <span>{document.originalFilename}</span>
                  <small>{document.status} · {formatBytes(document.sizeBytes)} · {formatDate(document.createdAt)}</small>
                </article>
              ))}
              {!contracts.length ? <p>Договоры пока не прикреплены.</p> : null}
            </div>
          </section>

          <section>
            <h3>Проекты и объекты</h3>
            <div className="work-window-list">
              {deals.map((deal) => (
                <article key={deal.id}>
                  <strong>{deal.number}</strong>
                  <span>{deal.title}</span>
                  <small>{dealStatusLabels[deal.status]} · {formatMoney(deal.expectedAmount)}</small>
                </article>
              ))}
              {objects.map((object) => (
                <article key={object.id}>
                  <strong>{object.name}</strong>
                  <span>{object.address}</span>
                  <small>{objectStatusLabels[object.status]} · {getUserName(state, object.responsibleManagerId)}</small>
                </article>
              ))}
            </div>
          </section>

          <section>
            <h3>Документы, КП и счета</h3>
            <div className="work-window-list">
              {documents.slice(0, 4).map((document) => (
                <article key={document.id}>
                  <strong>{document.title}</strong>
                  <span>{document.originalFilename}</span>
                  <small>{formatBytes(document.sizeBytes)}</small>
                </article>
              ))}
              {quotes.slice(0, 4).map((quote) => (
                <article key={quote.id}>
                  <strong>{quote.number}</strong>
                  <span>{quote.title}</span>
                  <small>{quoteStatusLabels[quote.status]} · {formatMoney(getQuoteSaleTotal(quote))}</small>
                </article>
              ))}
              {payments.slice(0, 4).map((payment) => (
                <article key={payment.id}>
                  <strong>{payment.invoiceNumber}</strong>
                  <span>{paymentStatusLabels[payment.status]}</span>
                  <small>{formatMoney(payment.amountTotal)} · остаток {formatMoney(getPaymentDue(payment))}</small>
                </article>
              ))}
            </div>
          </section>

          <section>
            <h3>Задачи</h3>
            <div className="work-window-list">
              {tasks.map((task) => (
                <article key={task.id}>
                  <strong>{task.title}</strong>
                  <span>{task.description}</span>
                  <small>{getUserName(state, task.assignedToUserId)} · {formatDateTime(task.dueAt)}</small>
                </article>
              ))}
              {!tasks.length ? <p>Активных задач по контрагенту нет.</p> : null}
            </div>
          </section>

          <section className="work-window-wide">
            <h3>Последние действия</h3>
            <div className="work-window-timeline">
              {activity.map((item) => (
                <article key={item.id}>
                  <span>{formatDateTime(item.createdAt)}</span>
                  <strong>{item.title}</strong>
                  <small>{item.details}</small>
                </article>
              ))}
              {!activity.length ? <p>История пока пустая.</p> : null}
            </div>
          </section>
        </div>
      </section>
    </div>
  )
}

function ProjectDetailsWindow({
  state,
  record,
  currentUserId,
  selectedVariantId,
  onVariantChange,
  commit,
  onOpenKpEditor,
  onOpenCounterparty,
  onOpenProject,
  onPreviewDocument,
  onClose,
}: {
  state: CrmState
  record: WorkRecord
  currentUserId: string
  selectedVariantId: string
  onVariantChange: (variantId: string) => void
  commit: (updater: (state: CrmState) => CrmState) => void
  onOpenKpEditor: (dealId?: string) => void
  onOpenCounterparty: (counterpartyId: string) => void
  onOpenProject: (dealId: string) => void
  onPreviewDocument: (document: ProjectPreviewDocument) => void
  onClose: () => void
}) {
  return (
    <div className="work-window-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="work-project-window"
        role="dialog"
        aria-modal="true"
        aria-label={`Подробная карточка проекта ${record.deal.number}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span>{record.deal.number}</span>
            <h2>{record.deal.title || record.deal.number || 'Новый проект'}</h2>
          </div>
          <button type="button" className="work-icon-button" aria-label="Закрыть окно" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <WorkDetails
          state={state}
          record={record}
          currentUserId={currentUserId}
          selectedVariantId={selectedVariantId}
          onVariantChange={onVariantChange}
          commit={commit}
          onOpenKpEditor={onOpenKpEditor}
          onOpenCounterparty={onOpenCounterparty}
          onOpenProject={onOpenProject}
          onPreviewDocument={onPreviewDocument}
        />
      </section>
    </div>
  )
}

export function CrmSystemPage({
  authRole,
  darkTheme,
  routeFilter = 'all',
  routeModule = 'overview',
  showKpEditor = false,
  kpEditor,
  onThemeToggle,
  onRouteChange,
  onOpenKpEditor,
  onLogout,
}: CrmSystemPageProps) {
  const currentUserId = demoRoleConfig[authRole].userId
  const isManagerScope = authRole === 'manager'
  const sidebarNotificationReadKey = getSidebarNotificationStorageKey(currentUserId, 'read')
  const sidebarNotificationClearedKey = getSidebarNotificationStorageKey(currentUserId, 'cleared')
  const [crmState, setCrmState] = useState<CrmState>(loadCrmState)
  const [localRoute, setLocalRoute] = useState({ filter: routeFilter, module: routeModule })
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null)
  const [collapsingWorkId, setCollapsingWorkId] = useState<string | null>(null)
  const [collapsingWorkHeight, setCollapsingWorkHeight] = useState<number | null>(null)
  const [selectedCounterpartyId, setSelectedCounterpartyId] = useState<string | null>(null)
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(null)
  const [projectWindowId, setProjectWindowId] = useState<string | null>(null)
  const [projectDeleteCandidateId, setProjectDeleteCandidateId] = useState<string | null>(null)
  const [counterpartyWindowId, setCounterpartyWindowId] = useState<string | null>(null)
  const [projectPreviewDocument, setProjectPreviewDocument] = useState<ProjectPreviewDocument | null>(null)
  const [selectedVariantId, setSelectedVariantId] = useState(crmState.variants[0]?.id ?? '')
  const [projectSearch, setProjectSearch] = useState('')
  const [isProjectFilterOpen, setIsProjectFilterOpen] = useState(false)
  const [isProjectCreateOpen, setIsProjectCreateOpen] = useState(false)
  const [projectAdvancedFilters, setProjectAdvancedFilters] = useState<ProjectAdvancedFilters>(defaultProjectAdvancedFilters)
  const [catalogSearch, setCatalogSearch] = useState('')
  const [catalogSupplierFilter, setCatalogSupplierFilter] = useState('all')
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState('all')
  const [catalogAvailabilityFilter, setCatalogAvailabilityFilter] = useState<CatalogAvailabilityFilter>('all')
  const [settingsBackupAt, setSettingsBackupAt] = useState(() => formatDateTime(new Date().toISOString()))
  const [settingsBackupVersion, setSettingsBackupVersion] = useState(1)
  const [isNotificationLogOpen, setIsNotificationLogOpen] = useState(false)
  const [readNotificationIds, setReadNotificationIds] = useState(() => loadStoredIdList(sidebarNotificationReadKey))
  const [clearedNotificationIds, setClearedNotificationIds] = useState(() =>
    loadStoredIdList(sidebarNotificationClearedKey),
  )
  const isNetworkOnline = useNetworkPresence()
  const networkStatusLabel = isNetworkOnline ? 'в сети' : 'не в сети'

  const commit = useCallback((updater: (state: CrmState) => CrmState) => {
    setCrmState((current) => {
      const next = updater(current)
      saveCrmState(next)
      return next
    })
  }, [])

  const records = useMemo(() => buildWorkRecords(crmState), [crmState])
  const counterpartyRecords = useMemo(() => buildCounterpartyRecords(crmState), [crmState])
  const catalogRecords = useMemo(() => buildCatalogRecords(crmState), [crmState])
  const catalogSuppliers = useMemo(
    () =>
      [...crmState.suppliers].sort((left, right) =>
        left.name.localeCompare(right.name, 'ru-RU'),
      ),
    [crmState.suppliers],
  )
  const catalogCategories = useMemo(
    () => [...new Set(catalogRecords.map((record) => record.product.category))].sort((left, right) => left.localeCompare(right, 'ru-RU')),
    [catalogRecords],
  )
  const filteredCatalogRecords = useMemo(() => {
    const search = normalizeCatalogText(catalogSearch)

    return catalogRecords.filter((record) => {
      if (catalogSupplierFilter !== 'all' && record.product.supplierId !== catalogSupplierFilter) {
        return false
      }

      if (catalogCategoryFilter !== 'all' && record.product.category !== catalogCategoryFilter) {
        return false
      }

      if (!matchesCatalogAvailability(record, catalogAvailabilityFilter)) {
        return false
      }

      return !search || getCatalogSearchText(record).includes(search)
    })
  }, [catalogAvailabilityFilter, catalogCategoryFilter, catalogRecords, catalogSearch, catalogSupplierFilter])

  const roleRecords = useMemo(
    () => (isManagerScope ? records.filter((record) => record.deal.responsibleUserId === currentUserId) : records),
    [currentUserId, isManagerScope, records],
  )
  const activeSidebarModule = onRouteChange ? routeModule : localRoute.module
  const activeWorkFilter = onRouteChange ? routeFilter : localRoute.filter

  const filteredBySidebar = useMemo(
    () => roleRecords.filter((record) => matchesWorkFilter(record, activeWorkFilter)),
    [activeWorkFilter, roleRecords],
  )

  const filteredByAdvancedFilters = useMemo(
    () => filteredBySidebar.filter((record) => matchesProjectAdvancedFilters(record, projectAdvancedFilters)),
    [filteredBySidebar, projectAdvancedFilters],
  )

  const filteredRecords = useMemo(() => {
    const search = normalizeCatalogText(projectSearch)

    if (!search) {
      return filteredByAdvancedFilters
    }

    return filteredByAdvancedFilters.filter((record) => getWorkSearchText(record).includes(search))
  }, [filteredByAdvancedFilters, projectSearch])

  const selectedRecord = selectedWorkId
    ? records.find((record) => record.deal.id === selectedWorkId)
    : undefined
  const projectWindowRecord = projectWindowId
    ? records.find((record) => record.deal.id === projectWindowId)
    : undefined
  const projectDeleteCandidateRecord = projectDeleteCandidateId
    ? records.find((record) => record.deal.id === projectDeleteCandidateId)
    : undefined

  const summary = useMemo(() => summarizeRecords(roleRecords), [roleRecords])
  const readNotificationIdSet = useMemo(() => new Set(readNotificationIds), [readNotificationIds])
  const clearedNotificationIdSet = useMemo(() => new Set(clearedNotificationIds), [clearedNotificationIds])
  const sidebarNotificationItems = useMemo(
    () =>
      buildSidebarSystemNotifications(crmState, records, currentUserId, 80).filter(
        (item) => !clearedNotificationIdSet.has(item.id),
      ),
    [clearedNotificationIdSet, crmState, currentUserId, records],
  )
  const unreadSidebarNotificationCount = sidebarNotificationItems.filter(
    (item) => !readNotificationIdSet.has(item.id),
  ).length
  const activeProjectAdvancedFilterCount = countProjectAdvancedFilters(projectAdvancedFilters)
  const activeProjectFilterCount = (activeWorkFilter === 'all' ? 0 : 1) + activeProjectAdvancedFilterCount
  const projectFilterUsers = useMemo(
    () =>
      crmState.users
        .filter((user) => user.isActive && (!isManagerScope || user.id === currentUserId))
        .sort((left, right) => left.fullName.localeCompare(right.fullName, 'ru-RU')),
    [crmState.users, currentUserId, isManagerScope],
  )

  useEffect(() => {
    if (!collapsingWorkId) {
      return undefined
    }

    const timeout = window.setTimeout(() => {
      setCollapsingWorkId((current) => (current === collapsingWorkId ? null : current))
      setSelectedWorkId((current) => (current === collapsingWorkId ? null : current))
      setCollapsingWorkHeight(null)
    }, 430)

    return () => window.clearTimeout(timeout)
  }, [collapsingWorkId])

  const updateProjectAdvancedFilter = <Key extends keyof ProjectAdvancedFilters>(
    key: Key,
    value: ProjectAdvancedFilters[Key],
  ) => {
    setProjectAdvancedFilters((current) => ({ ...current, [key]: value }))
    setSelectedWorkId(null)
    setCollapsingWorkId(null)
    setCollapsingWorkHeight(null)
  }

  const resetProjectFilters = () => {
    setProjectAdvancedFilters(defaultProjectAdvancedFilters)
    applyWorkFilter('all', 'projects')
    setSelectedWorkId(null)
    setCollapsingWorkId(null)
    setCollapsingWorkHeight(null)
  }

  const handleCreateProject = (draft: ProjectCreateDraft) => {
    const dealId = makeProjectEntityId('deal')

    commit((current) => appendCreatedProject(current, draft, currentUserId, dealId))
    setIsProjectCreateOpen(false)
    setIsProjectFilterOpen(false)
    setProjectSearch('')
    setProjectAdvancedFilters(defaultProjectAdvancedFilters)
    applyWorkFilter('all', 'projects')
    setSelectedWorkId(null)
    setCollapsingWorkId(null)
    setCollapsingWorkHeight(null)
  }

  const handleConfirmProjectDelete = () => {
    const dealId = projectDeleteCandidateRecord?.deal.id

    if (!dealId) {
      setProjectDeleteCandidateId(null)
      return
    }

    commit((current) => removeProjectFromState(current, dealId))
    setSelectedWorkId((current) => (current === dealId ? null : current))
    setCollapsingWorkId((current) => (current === dealId ? null : current))
    setCollapsingWorkHeight(null)
    setProjectWindowId((current) => (current === dealId ? null : current))
    setProjectDeleteCandidateId(null)
    setProjectPreviewDocument(null)
  }

  const applyWorkFilter = (filter: WorkFilterId, module: SidebarModuleId = 'projects') => {
    setLocalRoute({ filter, module })
    setSelectedWorkId(null)
    setCollapsingWorkId(null)
    setCollapsingWorkHeight(null)
    setSelectedCounterpartyId(null)
    setSelectedCatalogId(null)
    setProjectWindowId(null)
    setCounterpartyWindowId(null)
    setProjectPreviewDocument(null)
    onRouteChange?.(module, filter)
  }

  const toggleWorkRow = (dealId: string) => {
    if (selectedWorkId === dealId) {
      const shell = document.querySelector<HTMLElement>(`[data-project-expand-shell="${dealId}"]`)
      setCollapsingWorkHeight(shell ? Math.ceil(shell.getBoundingClientRect().height) : null)
      setCollapsingWorkId((current) => (current === dealId ? null : dealId))
      return
    }

    setCollapsingWorkId((current) => {
      if (current === dealId) {
        return null
      }

      return selectedWorkId ?? current
    })
    setCollapsingWorkHeight(null)
    setSelectedWorkId(dealId)
  }

  const showOverview = activeSidebarModule === 'overview'
  const showCounterparties = activeSidebarModule === 'counterparties'
  const showCatalog = activeSidebarModule === 'catalog'
  const showAnalytics = activeSidebarModule === 'analytics'
  const showSettings = activeSidebarModule === 'settings'

  const toggleCounterpartyRow = (counterpartyId: string) => {
    setSelectedCounterpartyId((current) => (current === counterpartyId ? null : counterpartyId))
  }

  const toggleCatalogRow = (variantId: string) => {
    setSelectedCatalogId((current) => (current === variantId ? null : variantId))
  }

  const createSettingsBackup = () => {
    setSettingsBackupAt(formatDateTime(new Date().toISOString()))
    setSettingsBackupVersion((current) => current + 1)
  }

  const markSidebarNotificationsRead = (ids: string[]) => {
    if (!ids.length) return

    setReadNotificationIds((current) => {
      const next = mergeIdLists(current, ids)
      saveStoredIdList(sidebarNotificationReadKey, next)
      return next
    })
  }

  const clearSidebarNotifications = () => {
    const ids = sidebarNotificationItems.map((item) => item.id)

    if (!ids.length) return

    setClearedNotificationIds((current) => {
      const next = mergeIdLists(current, ids)
      saveStoredIdList(sidebarNotificationClearedKey, next)
      return next
    })
    setReadNotificationIds((current) => {
      const next = mergeIdLists(current, ids)
      saveStoredIdList(sidebarNotificationReadKey, next)
      return next
    })
  }

  return (
    <div className={classNames('work-app', darkTheme && 'is-dark', showKpEditor && 'is-kp-editor')}>
      <div className="work-shell">
        <aside className="work-sidebar" aria-label="Рабочая панель">
          <div className="work-sidebar-top">
            <div className="work-sidebar-profile">
              <div className="work-sidebar-avatar" aria-hidden="true">
                {getUserName(crmState, currentUserId).slice(0, 1)}
              </div>
              <strong>{getUserName(crmState, currentUserId)}</strong>
              <div
                className={classNames('work-sidebar-presence', isNetworkOnline ? 'is-online' : 'is-offline')}
                role="status"
                aria-live="polite"
                aria-label={`Статус сети: ${networkStatusLabel}`}
                title={`Статус сети: ${networkStatusLabel}`}
              >
                <span className="work-sidebar-presence-dot" aria-hidden="true" />
                <span>{networkStatusLabel}</span>
              </div>
              <button
                type="button"
                className="work-sidebar-theme-toggle"
                aria-label={darkTheme ? 'Включить светлую тему' : 'Включить темную тему'}
                title={darkTheme ? 'Включить светлую тему' : 'Включить темную тему'}
                onClick={onThemeToggle}
              >
                {darkTheme ? <Sun size={16} /> : <Moon size={16} />}
              </button>
            </div>
          </div>

          <section className="work-sidebar-section">
            <div className="work-sidebar-module-grid">
              <SidebarModuleButton
                icon={<LayoutDashboard size={15} />}
                label="Главная"
                meta="старт"
                active={!showKpEditor && activeSidebarModule === 'overview'}
                onClick={() => applyWorkFilter('all', 'overview')}
              />
              <SidebarModuleButton
                icon={<BriefcaseBusiness size={15} />}
                label="Проекты"
                meta={`${summary.total} записей`}
                active={!showKpEditor && activeSidebarModule === 'projects'}
                onClick={() => applyWorkFilter('all', 'projects')}
              />
              <SidebarModuleButton
                icon={<FileText size={15} />}
                label="КП"
                meta="коммерческие предложения"
                active={showKpEditor}
                onClick={() => onOpenKpEditor()}
              />
              <SidebarModuleButton
                icon={<Building2 size={15} />}
                label="Контрагенты"
                meta={`${crmState.counterparties.length} карточек`}
                active={!showKpEditor && activeSidebarModule === 'counterparties'}
                onClick={() => applyWorkFilter('all', 'counterparties')}
              />
              <SidebarModuleButton
                icon={<PackageSearch size={15} />}
                label="Каталог"
                meta={`${catalogRecords.length} товаров`}
                active={!showKpEditor && activeSidebarModule === 'catalog'}
                onClick={() => applyWorkFilter('all', 'catalog')}
              />
              <SidebarModuleButton
                icon={<BarChart3 size={15} />}
                label="Аналитика"
                meta={formatMoneyCompact(summary.pipeline)}
                active={!showKpEditor && activeSidebarModule === 'analytics'}
                onClick={() => applyWorkFilter('all', 'analytics')}
              />
              <SidebarModuleButton
                icon={<Wrench size={15} />}
                label="Настройки"
                meta="параметры"
                active={!showKpEditor && activeSidebarModule === 'settings'}
                onClick={() => applyWorkFilter('all', 'settings')}
              />
            </div>
          </section>

          <SidebarNotificationLog
            items={sidebarNotificationItems}
            readIds={readNotificationIdSet}
            unreadCount={unreadSidebarNotificationCount}
            onOpen={() => setIsNotificationLogOpen(true)}
          />

          <button type="button" className="work-sidebar-logout" onClick={onLogout}>
            Выход
          </button>
        </aside>

        {isNotificationLogOpen ? (
          <SidebarNotificationModal
            items={sidebarNotificationItems}
            readIds={readNotificationIdSet}
            unreadCount={unreadSidebarNotificationCount}
            onClose={() => setIsNotificationLogOpen(false)}
            onMarkRead={markSidebarNotificationsRead}
            onClear={clearSidebarNotifications}
          />
        ) : null}

        <main className="work-layout">
          <section className="work-main">
          {!showOverview && !showKpEditor ? (
            <div className="work-page-head">
              <div>
                <h1>{sidebarModuleTitles[activeSidebarModule]}</h1>
                <p>
                  {showCounterparties
                    ? 'Единый список клиентов с реквизитами, контактами, договорами, объектами и историей.'
                    : showCatalog
                      ? 'Подробный список товаров, поставщиков, закупочных цен и обновлений парсера.'
                      : showAnalytics
                        ? isManagerScope
                          ? 'Личные показатели по своим проектам, КП, оплатам и задачам без сравнения с другими менеджерами.'
                          : 'Управленческая сводка по портфелю, марже КП, оплатам, монтажу, задачам и поставщикам.'
                        : showSettings
                          ? 'Пользователи, роли, резервные копии, офлайн-режим и параметры источников данных.'
                          : demoRoleConfig[authRole].description}
                </p>
              </div>
            </div>
          ) : null}

          {showKpEditor && kpEditor ? (
            <section className="work-kp-embedded">
              {kpEditor}
            </section>
          ) : showOverview ? (
            <WorkOverview
              isPersonalScope={isManagerScope}
              onNavigate={applyWorkFilter}
              onOpenKpEditor={onOpenKpEditor}
            />
          ) : showCounterparties ? (
            <CounterpartyRegistry
              state={crmState}
              records={counterpartyRecords}
              selectedId={selectedCounterpartyId}
              onToggle={toggleCounterpartyRow}
              onOpenDetails={setCounterpartyWindowId}
            />
          ) : showCatalog ? (
            <CatalogRegistry
              records={filteredCatalogRecords}
              allRecordsCount={catalogRecords.length}
              suppliers={catalogSuppliers}
              categories={catalogCategories}
              selectedId={selectedCatalogId}
              search={catalogSearch}
              supplierFilter={catalogSupplierFilter}
              categoryFilter={catalogCategoryFilter}
              availabilityFilter={catalogAvailabilityFilter}
              onSearchChange={(value) => {
                setCatalogSearch(value)
                setSelectedCatalogId(null)
              }}
              onSupplierFilterChange={(value) => {
                setCatalogSupplierFilter(value)
                setSelectedCatalogId(null)
              }}
              onCategoryFilterChange={(value) => {
                setCatalogCategoryFilter(value)
                setSelectedCatalogId(null)
              }}
              onAvailabilityFilterChange={(value) => {
                setCatalogAvailabilityFilter(value)
                setSelectedCatalogId(null)
              }}
              onResetFilters={() => {
                setCatalogSearch('')
                setCatalogSupplierFilter('all')
                setCatalogCategoryFilter('all')
                setCatalogAvailabilityFilter('all')
                setSelectedCatalogId(null)
              }}
              onToggle={toggleCatalogRow}
            />
          ) : showAnalytics ? (
            <AnalyticsScreen
              state={crmState}
              records={roleRecords}
              summary={summary}
              currentUserId={currentUserId}
              isPersonalScope={isManagerScope}
            />
          ) : showSettings ? (
            <SettingsScreen
              state={crmState}
              currentUserId={currentUserId}
              backupAt={settingsBackupAt}
              backupVersion={settingsBackupVersion}
              onCreateBackup={createSettingsBackup}
            />
          ) : (
          <section className={classNames('work-registry', isProjectFilterOpen && 'has-filter-popover')} id="work-registry">
            <div className="work-project-control-tile">
              <label className="work-project-search">
                <Search size={16} />
                <input
                  value={projectSearch}
                  onChange={(event) => {
                    setProjectSearch(event.target.value)
                    setSelectedWorkId(null)
                    setCollapsingWorkId(null)
                    setCollapsingWorkHeight(null)
                  }}
                  placeholder="Поиск по клиенту, проекту, счету или объекту"
                />
              </label>

              <div className="work-project-filter-tools">
                <button
                  type="button"
                  className={classNames('work-project-filter-trigger', activeProjectFilterCount > 0 && 'is-active')}
                  aria-haspopup="dialog"
                  aria-expanded={isProjectFilterOpen}
                  onClick={() => setIsProjectFilterOpen((current) => !current)}
                >
                  <Settings2 size={16} />
                  <span>Фильтр</span>
                  {activeProjectFilterCount > 0 ? <b>{activeProjectFilterCount}</b> : null}
                </button>
                <button
                  type="button"
                  className="work-project-create-button"
                  data-testid="project-create-open"
                  onClick={() => setIsProjectCreateOpen(true)}
                >
                  <Plus size={16} />
                  <span>Создать</span>
                </button>
                <span className="work-project-result-count">{filteredRecords.length} из {roleRecords.length}</span>
              </div>

              {isProjectFilterOpen ? (
                <div className="work-project-filter-popover" role="dialog" aria-label="Подробные фильтры проектов">
                  <div className="work-project-filter-popover-head">
                    <div>
                      <strong>Фильтр проектов</strong>
                      <span>
                        {activeProjectFilterCount > 0
                          ? `Активно условий: ${activeProjectFilterCount}`
                          : 'Подберите проекты по статусам, срокам и документам'}
                      </span>
                    </div>
                    <button type="button" aria-label="Закрыть фильтр" onClick={() => setIsProjectFilterOpen(false)}>
                      <X size={16} />
                    </button>
                  </div>

                  <section className="work-project-filter-section work-project-filter-presets">
                    <h3>Быстрые пресеты</h3>
                    <div className="work-project-filter-strip" aria-label="Быстрые фильтры проектов">
                      {(['all', 'withoutQuote', 'overdue', 'due', 'installation', 'documents', 'tasks', 'closed'] as WorkFilterId[]).map((filter) => (
                        <button
                          key={filter}
                          type="button"
                          className={activeWorkFilter === filter ? 'is-active' : undefined}
                          onClick={() => applyWorkFilter(filter, 'projects')}
                        >
                          {workFilterLabels[filter]}
                        </button>
                      ))}
                    </div>
                  </section>

                  <div className="work-project-filter-grid">
                    <label className="work-project-filter-field">
                      <span>Статус проекта</span>
                      <select
                        value={projectAdvancedFilters.status}
                        onChange={(event) =>
                          updateProjectAdvancedFilter('status', event.target.value as ProjectAdvancedFilters['status'])
                        }
                      >
                        <option value="all">Любой статус</option>
                        {(Object.entries(dealStatusLabels) as Array<[Deal['status'], string]>).map(([status, label]) => (
                          <option key={status} value={status}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="work-project-filter-field">
                      <span>Оплата</span>
                      <select
                        value={projectAdvancedFilters.payment}
                        onChange={(event) =>
                          updateProjectAdvancedFilter('payment', event.target.value as ProjectAdvancedFilters['payment'])
                        }
                      >
                        <option value="all">Любое состояние</option>
                        {(Object.entries(paymentStatusLabels) as Array<[Payment['status'], string]>).map(([status, label]) => (
                          <option key={status} value={status}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="work-project-filter-field">
                      <span>КП</span>
                      <select
                        value={projectAdvancedFilters.quote}
                        onChange={(event) =>
                          updateProjectAdvancedFilter('quote', event.target.value as ProjectAdvancedFilters['quote'])
                        }
                      >
                        {(Object.entries(projectQuoteFilterLabels) as Array<[ProjectQuoteFilter, string]>).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="work-project-filter-field">
                      <span>Ответственный</span>
                      <select
                        value={projectAdvancedFilters.responsibleUserId}
                        onChange={(event) => updateProjectAdvancedFilter('responsibleUserId', event.target.value)}
                      >
                        <option value="all">Любой сотрудник</option>
                        {projectFilterUsers.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.fullName}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="work-project-filter-field">
                      <span>Сумма проекта</span>
                      <select
                        value={projectAdvancedFilters.amount}
                        onChange={(event) =>
                          updateProjectAdvancedFilter('amount', event.target.value as ProjectAdvancedFilters['amount'])
                        }
                      >
                        {(Object.entries(projectAmountFilterLabels) as Array<[ProjectAmountFilter, string]>).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="work-project-filter-field">
                      <span>Следующее действие</span>
                      <select
                        value={projectAdvancedFilters.nextAction}
                        onChange={(event) =>
                          updateProjectAdvancedFilter('nextAction', event.target.value as ProjectAdvancedFilters['nextAction'])
                        }
                      >
                        {(Object.entries(projectNextActionFilterLabels) as Array<[ProjectNextActionFilter, string]>).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="work-project-filter-field">
                      <span>Документы</span>
                      <select
                        value={projectAdvancedFilters.documents}
                        onChange={(event) =>
                          updateProjectAdvancedFilter('documents', event.target.value as ProjectAdvancedFilters['documents'])
                        }
                      >
                        {(Object.entries(projectDocumentFilterLabels) as Array<[ProjectDocumentFilter, string]>).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="work-project-filter-field">
                      <span>Задачи</span>
                      <select
                        value={projectAdvancedFilters.tasks}
                        onChange={(event) =>
                          updateProjectAdvancedFilter('tasks', event.target.value as ProjectAdvancedFilters['tasks'])
                        }
                      >
                        {(Object.entries(projectTaskFilterLabels) as Array<[ProjectTaskFilter, string]>).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="work-project-filter-footer">
                    <span>Показано {filteredRecords.length} из {roleRecords.length}</span>
                    <div>
                      <button type="button" className="work-project-filter-reset" onClick={resetProjectFilters}>
                        Сбросить
                      </button>
                      <button type="button" className="work-project-filter-apply" onClick={() => setIsProjectFilterOpen(false)}>
                        Применить
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="work-table-wrap">
              <table className="work-table work-project-table">
                <thead>
                  <tr>
                    <th>№</th>
                    <th>Контрагент</th>
                    <th>Проект</th>
                    <th>Срок</th>
                    <th>№ договора</th>
                    <th>Откуда товар (номер счета)</th>
                    <th>Сумма, руб.</th>
                    <th>Оплата</th>
                    <th>Комментарий</th>
                    <th>Статус</th>
                    <th>Ответственный</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record, index) => {
                    const isSelected = selectedRecord?.deal.id === record.deal.id
                    const isCollapsing = collapsingWorkId === record.deal.id
                    const isInlineDetailsVisible = isSelected || isCollapsing
                    const inlineCollapseStyle =
                      isCollapsing && collapsingWorkHeight
                        ? ({
                            '--project-collapse-height': `${collapsingWorkHeight}px`,
                            '--project-collapse-mid-height': `${Math.max(96, Math.round(collapsingWorkHeight * 0.42))}px`,
                            '--project-collapse-tail-height': `${Math.max(16, Math.min(48, Math.round(collapsingWorkHeight * 0.08)))}px`,
                          } as CSSProperties)
                        : undefined
                    const projectStatus = getProjectTableStatus(record)
                    const paymentInfo = getProjectPaymentInfo(record)
                    const projectPeriod = getProjectPeriod(record, index)
                    const contractNumber = record.deal.number || String(index + 1).padStart(3, '0')
                    const supplyDocument = getProjectSupplyDocument(record, index)

                    return (
                      <Fragment key={record.deal.id}>
                        <tr
                          className={classNames(
                            'work-project-row',
                            `work-project-row-status-${projectStatus.tone}`,
                            isSelected && !isCollapsing && 'is-selected',
                            isCollapsing && 'is-collapsing',
                          )}
                          tabIndex={0}
                          aria-expanded={isSelected && !isCollapsing}
                          onClick={() => toggleWorkRow(record.deal.id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              toggleWorkRow(record.deal.id)
                            }
                          }}
                        >
                          <td className="work-number-cell">
                            <strong>{index + 1}</strong>
                          </td>
                          <td>
                            <strong>{record.counterparty?.shortName ?? 'Контрагент не указан'}</strong>
                          </td>
                          <td className="work-project-cell">
                            <strong>{record.deal.title}</strong>
                          </td>
                          <td>
                            <strong>{projectPeriod}</strong>
                          </td>
                          <td>
                            <strong>{contractNumber}</strong>
                          </td>
                          <td className="work-supply-document-cell">
                            <span className="work-supply-document">
                              <span>{supplyDocument.title}</span>
                              <small>{supplyDocument.detail}</small>
                            </span>
                          </td>
                          <td>
                            <strong>{isBlankProjectRecord(record) ? '' : formatProjectAmount(record.deal.expectedAmount)}</strong>
                          </td>
                          <td>
                            <strong>{paymentInfo.value}</strong>
                          </td>
                          <td className="work-project-comment-cell">
                            <strong className="work-project-comment-preview">{getProjectComment(record)}</strong>
                          </td>
                          <td className="work-project-status-cell" data-project-status={projectStatus.tone}>
                            <span className="work-project-status-label">{projectStatus.label}</span>
                          </td>
                          <td>
                            <strong>{getUserName(crmState, record.deal.responsibleUserId)}</strong>
                          </td>
                        </tr>
                        {isInlineDetailsVisible ? (
                          <tr
                            className={classNames(
                              'work-expanded-row',
                              'work-project-expanded-row',
                              `work-project-row-status-${projectStatus.tone}`,
                              isCollapsing ? 'is-collapsing' : 'is-expanding',
                            )}
                          >
                            <td colSpan={11}>
                              <div
                                className={classNames('work-project-expand-shell', isCollapsing && 'is-collapsing')}
                                data-project-expand-shell={record.deal.id}
                                style={inlineCollapseStyle}
                                aria-hidden={isCollapsing ? true : undefined}
                                onAnimationEnd={(event) => {
                                  if (
                                    event.currentTarget !== event.target ||
                                    event.animationName !== 'work-project-collapse-shell' ||
                                    !isCollapsing
                                  ) {
                                    return
                                  }

                                  setCollapsingWorkId((current) => (current === record.deal.id ? null : current))
                                  setSelectedWorkId((current) => (current === record.deal.id ? null : current))
                                  setCollapsingWorkHeight(null)
                                }}
                              >
                                <ProjectInlineDetails
                                  state={crmState}
                                  record={record}
                                  onOpenDetails={() => setProjectWindowId(record.deal.id)}
                                  onOpenKpEditor={onOpenKpEditor}
                                  onPreviewDocument={setProjectPreviewDocument}
                                  onSaveInlineDetails={(draft) => commit((current) => applyProjectInlineDraft(current, record, draft))}
                                  onRequestDelete={() => setProjectDeleteCandidateId(record.deal.id)}
                                />
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {!filteredRecords.length ? (
              <div className="work-empty">
                По текущему разделу нет записей. Выберите другой фильтр или вернитесь в обзор.
              </div>
            ) : null}
          </section>
          )}

          </section>
        </main>
      </div>

      {projectWindowRecord ? (
        <ProjectDetailsWindow
          state={crmState}
          record={projectWindowRecord}
          currentUserId={currentUserId}
          selectedVariantId={selectedVariantId}
          onVariantChange={setSelectedVariantId}
          commit={commit}
          onOpenKpEditor={onOpenKpEditor}
          onOpenCounterparty={setCounterpartyWindowId}
          onOpenProject={setProjectWindowId}
          onPreviewDocument={setProjectPreviewDocument}
          onClose={() => setProjectWindowId(null)}
        />
      ) : null}

      {projectDeleteCandidateRecord ? (
        <ProjectDeleteConfirmModal
          record={projectDeleteCandidateRecord}
          onClose={() => setProjectDeleteCandidateId(null)}
          onConfirm={handleConfirmProjectDelete}
        />
      ) : null}

      {projectPreviewDocument ? (
        <ProjectDocumentPreviewModal
          document={projectPreviewDocument}
          onClose={() => setProjectPreviewDocument(null)}
        />
      ) : null}

      {counterpartyWindowId ? (
        <CounterpartyWindow
          state={crmState}
          counterpartyId={counterpartyWindowId}
          onClose={() => setCounterpartyWindowId(null)}
        />
      ) : null}

      {isProjectCreateOpen ? (
        <ProjectCreateModal
          state={crmState}
          currentUserId={currentUserId}
          isResponsibleLocked={isManagerScope}
          onClose={() => setIsProjectCreateOpen(false)}
          onCreate={handleCreateProject}
        />
      ) : null}
    </div>
  )
}
