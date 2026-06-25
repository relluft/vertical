import { demoTodayIso } from './mockData'
import type {
  Counterparty,
  CrmState,
  Deal,
  DealStatus,
  DocumentRecord,
  ObjectStatus,
  Payment,
  PaymentStatus,
  ProductVariant,
  Quote,
  QuoteStatus,
  SupplierProduct,
  TaskPriority,
  TaskRecord,
  User,
  UserRoleCode,
  WorkObject,
} from './types'

export const dealStatusLabels: Record<DealStatus, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  quote_preparation: 'КП готовится',
  quote_ready: 'КП готово',
  quote_sent: 'КП отправлено',
  negotiation: 'Переговоры',
  contract: 'Договор',
  awaiting_payment: 'Ожидаем оплату',
  paid: 'Оплачено',
  installation: 'Монтаж',
  closed_won: 'Закрыта успешно',
  closed_lost: 'Проиграна',
}

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  invoice_not_issued: 'Счет не выставлен',
  invoice_issued: 'Счет выставлен',
  awaiting_payment: 'Ожидаем оплату',
  partially_paid: 'Частично оплачено',
  paid: 'Оплачено',
  overdue: 'Просрочено',
  needs_clarification: 'Нужно уточнение',
}

export const quoteStatusLabels: Record<QuoteStatus, string> = {
  draft: 'Черновик',
  ready: 'Готово',
  exported: 'Экспортировано',
  sent: 'Отправлено',
  accepted: 'Принято',
  declined: 'Отклонено',
  archived: 'Архив',
}

export const objectStatusLabels: Record<ObjectStatus, string> = {
  survey: 'Осмотр',
  quote: 'КП',
  contract: 'Договор',
  installation: 'Монтаж',
  warranty: 'Гарантия',
  closed: 'Закрыт',
}

export const roleLabels: Record<UserRoleCode, string> = {
  admin: 'Администратор',
  director: 'Руководитель',
  deputy_director: 'Зам. директора',
  manager: 'Менеджер',
  accountant: 'Бухгалтер',
  installer: 'Монтажник',
  office_user: 'Офис',
}

export const taskPriorityLabels: Record<TaskPriority, string> = {
  low: 'Низкий',
  normal: 'Обычный',
  high: 'Высокий',
  urgent: 'Срочно',
}

const moneyFormatter = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 0,
})

const compactMoneyFormatter = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 1,
})

export function formatMoney(value: number) {
  return `${moneyFormatter.format(Math.round(value))} руб.`
}

export function formatMoneyCompact(value: number) {
  if (Math.abs(value) >= 1_000_000) {
    return `${compactMoneyFormatter.format(value / 1_000_000)} млн`
  }

  if (Math.abs(value) >= 1_000) {
    return `${compactMoneyFormatter.format(value / 1_000)} тыс.`
  }

  return moneyFormatter.format(value)
}

export function formatDate(value: string) {
  if (!value) {
    return 'не указано'
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function formatBytes(value: number) {
  if (value >= 1_000_000_000) {
    return `${compactMoneyFormatter.format(value / 1_000_000_000)} ГБ`
  }

  if (value >= 1_000_000) {
    return `${compactMoneyFormatter.format(value / 1_000_000)} МБ`
  }

  return `${compactMoneyFormatter.format(value / 1_000)} КБ`
}

export function getUser(state: CrmState, userId: string): User | undefined {
  return state.users.find((user) => user.id === userId)
}

export function getUserName(state: CrmState, userId: string) {
  return getUser(state, userId)?.fullName ?? 'Не назначен'
}

export function getCounterparty(state: CrmState, counterpartyId: string): Counterparty | undefined {
  return state.counterparties.find((counterparty) => counterparty.id === counterpartyId)
}

export function getObject(state: CrmState, objectId: string): WorkObject | undefined {
  return state.objects.find((object) => object.id === objectId)
}

export function getDeal(state: CrmState, dealId: string): Deal | undefined {
  return state.deals.find((deal) => deal.id === dealId)
}

export function getQuote(state: CrmState, quoteId: string): Quote | undefined {
  return state.quotes.find((quote) => quote.id === quoteId)
}

export function getPaymentDue(payment: Payment) {
  return Math.max(0, payment.amountTotal - payment.amountPaid)
}

export function isPaymentOverdue(payment: Payment) {
  return (
    payment.amountDue > 0 &&
    payment.status !== 'paid' &&
    (payment.status === 'overdue' || payment.expectedPaymentDate < demoTodayIso)
  )
}

export function isTaskLate(task: TaskRecord) {
  return task.status !== 'done' && task.dueAt.slice(0, 10) <= demoTodayIso
}

export function getQuotePurchaseTotal(quote: Quote) {
  return quote.items.reduce((sum, item) => sum + item.purchasePrice * item.qty, 0)
}

export function getQuoteSaleTotal(quote: Quote) {
  return quote.items.reduce((sum, item) => sum + item.salePrice * item.qty, 0) - quote.discountAmount
}

export function getQuoteMargin(quote: Quote) {
  return getQuoteSaleTotal(quote) - getQuotePurchaseTotal(quote)
}

export function getQuoteMarginPercent(quote: Quote) {
  const purchase = getQuotePurchaseTotal(quote)
  return purchase > 0 ? Math.round((getQuoteMargin(quote) / purchase) * 100) : 0
}

export function getCounterpartyPayments(state: CrmState, counterpartyId: string) {
  return state.payments.filter((payment) => payment.counterpartyId === counterpartyId)
}

export function getCounterpartyDeals(state: CrmState, counterpartyId: string) {
  return state.deals.filter((deal) => deal.counterpartyId === counterpartyId)
}

export function getCounterpartyObjects(state: CrmState, counterpartyId: string) {
  return state.objects.filter((object) => object.counterpartyId === counterpartyId)
}

export function getCounterpartyDocuments(state: CrmState, counterpartyId: string) {
  return state.documents.filter((document) => document.counterpartyId === counterpartyId)
}

export function getCounterpartyQuotes(state: CrmState, counterpartyId: string) {
  return state.quotes.filter((quote) => quote.counterpartyId === counterpartyId)
}

export function getCounterpartyActivity(state: CrmState, counterpartyId: string) {
  const relatedEntityIds = new Set<string>([
    counterpartyId,
    ...getCounterpartyDeals(state, counterpartyId).map((deal) => deal.id),
    ...getCounterpartyObjects(state, counterpartyId).map((object) => object.id),
    ...getCounterpartyDocuments(state, counterpartyId).map((document) => document.id),
    ...getCounterpartyQuotes(state, counterpartyId).map((quote) => quote.id),
    ...getCounterpartyPayments(state, counterpartyId).map((payment) => payment.id),
  ])

  return state.activity.filter((item) => relatedEntityIds.has(item.entityId)).slice(0, 8)
}

export function getCounterpartyFlags(state: CrmState, counterparty: Counterparty) {
  const payments = getCounterpartyPayments(state, counterparty.id)
  const deals = getCounterpartyDeals(state, counterparty.id)
  const flags: Array<{ tone: 'red' | 'amber' | 'slate'; label: string }> = []

  if (payments.some(isPaymentOverdue)) {
    flags.push({ tone: 'red', label: 'Есть просроченная оплата' })
  }

  if (payments.some((payment) => payment.amountDue > 0 && payment.status !== 'paid')) {
    flags.push({ tone: 'amber', label: 'Есть задолженность' })
  }

  if (!counterparty.phone) {
    flags.push({ tone: 'amber', label: 'Нет телефона' })
  }

  if (!counterparty.inn) {
    flags.push({ tone: 'amber', label: 'Нет ИНН' })
  }

  if (deals.some((deal) => deal.status !== 'closed_won' && deal.status !== 'closed_lost' && deal.nextActionAt < `${demoTodayIso}T23:59:59.000Z`)) {
    flags.push({ tone: 'slate', label: 'Есть ближайшие действия' })
  }

  return flags
}

export function getDashboardMetrics(state: CrmState) {
  const openDeals = state.deals.filter((deal) => deal.status !== 'closed_won' && deal.status !== 'closed_lost')
  const overduePayments = state.payments.filter(isPaymentOverdue)
  const receivables = state.payments.reduce((sum, payment) => sum + getPaymentDue(payment), 0)
  const overdue = overduePayments.reduce((sum, payment) => sum + getPaymentDue(payment), 0)
  const activeQuotes = state.quotes.filter((quote) => quote.status !== 'declined' && quote.status !== 'archived')
  const pendingNotes = state.installerNotes.filter((note) => note.status === 'local_draft').length
  const dueTasks = state.tasks.filter(isTaskLate).length

  return {
    openDeals: openDeals.length,
    pipeline: openDeals.reduce((sum, deal) => sum + deal.expectedAmount, 0),
    activeQuotes: activeQuotes.length,
    quoteTotal: activeQuotes.reduce((sum, quote) => sum + getQuoteSaleTotal(quote), 0),
    receivables,
    overdue,
    overduePayments: overduePayments.length,
    dueTasks,
    pendingNotes,
    documents: state.documents.length,
  }
}

export function getDealPayments(state: CrmState, dealId: string) {
  return state.payments.filter((payment) => payment.dealId === dealId)
}

export function getDealQuotes(state: CrmState, dealId: string) {
  return state.quotes.filter((quote) => quote.dealId === dealId)
}

export function getDealDocuments(state: CrmState, dealId: string) {
  return state.documents.filter((document) => document.dealId === dealId)
}

export function getDealTasks(state: CrmState, dealId: string) {
  return state.tasks.filter((task) => task.dealId === dealId)
}

export function getPaymentSummary(payments: Payment[]) {
  const total = payments.reduce((sum, payment) => sum + payment.amountTotal, 0)
  const paid = payments.reduce((sum, payment) => sum + payment.amountPaid, 0)
  const due = payments.reduce((sum, payment) => sum + getPaymentDue(payment), 0)
  const overdue = payments.filter(isPaymentOverdue).reduce((sum, payment) => sum + getPaymentDue(payment), 0)

  return { total, paid, due, overdue }
}

export function getVariantBundle(state: CrmState, variantId: string) {
  const variant = state.variants.find((item) => item.id === variantId)
  const product = variant
    ? state.products.find((item) => item.id === variant.supplierProductId)
    : undefined
  const supplier = product
    ? state.suppliers.find((item) => item.id === product.supplierId)
    : undefined

  return { variant, product, supplier }
}

export function getProductSupplier(state: CrmState, product: SupplierProduct) {
  return state.suppliers.find((supplier) => supplier.id === product.supplierId)
}

export function getProductVariants(state: CrmState, productId: string) {
  return state.variants.filter((variant) => variant.supplierProductId === productId)
}

export function getPriceComparison(state: CrmState, product: SupplierProduct | undefined) {
  if (!product) {
    return []
  }

  return state.products
    .filter((item) => item.category === product.category)
    .flatMap((item) =>
      getProductVariants(state, item.id).map((variant) => ({
        product: item,
        variant,
        supplier: getProductSupplier(state, item),
      })),
    )
    .sort((a, b) => a.variant.purchasePrice - b.variant.purchasePrice)
}

export function getVariantTitle(product: SupplierProduct, variant: ProductVariant) {
  return `${product.name} · ${variant.variantName}`
}

export function getManagerAnalytics(state: CrmState) {
  return state.users
    .filter((user) => user.roleCode === 'manager' || user.roleCode === 'deputy_director')
    .map((user) => {
      const deals = state.deals.filter((deal) => deal.responsibleUserId === user.id)
      const quotes = state.quotes.filter((quote) => quote.createdByUserId === user.id)
      const payments = state.payments.filter((payment) =>
        deals.some((deal) => deal.id === payment.dealId),
      )

      return {
        user,
        deals: deals.length,
        pipeline: deals.reduce((sum, deal) => sum + deal.expectedAmount, 0),
        quotes: quotes.length,
        quoteTotal: quotes.reduce((sum, quote) => sum + getQuoteSaleTotal(quote), 0),
        overdue: payments.filter(isPaymentOverdue).reduce((sum, payment) => sum + getPaymentDue(payment), 0),
      }
    })
}

export function getSupplierAnalytics(state: CrmState) {
  return state.suppliers.map((supplier) => {
    const products = state.products.filter((product) => product.supplierId === supplier.id)
    const quoteItems = state.quotes.flatMap((quote) =>
      quote.items.filter((item) => item.supplierId === supplier.id),
    )
    const purchaseTotal = quoteItems.reduce((sum, item) => sum + item.purchasePrice * item.qty, 0)
    const saleTotal = quoteItems.reduce((sum, item) => sum + item.salePrice * item.qty, 0)

    return {
      supplier,
      products: products.length,
      quoteItems: quoteItems.length,
      purchaseTotal,
      saleTotal,
      margin: saleTotal - purchaseTotal,
    }
  })
}

export function getDocumentEntityLabel(state: CrmState, document: DocumentRecord) {
  const counterparty = getCounterparty(state, document.counterpartyId)?.shortName ?? 'Контрагент'
  const deal = getDeal(state, document.dealId)?.number ?? 'без сделки'

  return `${counterparty} / ${deal}`
}

export function getDataQualityIssues(state: CrmState) {
  const noPhone = state.counterparties.filter((counterparty) => !counterparty.phone)
  const noInn = state.counterparties.filter((counterparty) => !counterparty.inn)
  const objectNoGeo = state.objects.filter((object) => object.geoLat === null || object.geoLng === null)
  const outdatedSuppliers = state.suppliers.filter((supplier) => supplier.updateStatus === 'outdated')
  const untypedDocuments = state.documents.filter((document) => document.type === 'other')

  return [
    { label: 'Контрагенты без телефона', value: noPhone.length },
    { label: 'Контрагенты без ИНН', value: noInn.length },
    { label: 'Объекты без координат', value: objectNoGeo.length },
    { label: 'Прайсы поставщиков устарели', value: outdatedSuppliers.length },
    { label: 'Документы требуют классификации', value: untypedDocuments.length },
  ]
}

export function getEntityTitle(state: CrmState, entityType: string, entityId: string) {
  if (entityType === 'payment') {
    return state.payments.find((payment) => payment.id === entityId)?.invoiceNumber ?? entityId
  }

  if (entityType === 'quote') {
    return state.quotes.find((quote) => quote.id === entityId)?.number ?? entityId
  }

  if (entityType === 'document') {
    return state.documents.find((document) => document.id === entityId)?.title ?? entityId
  }

  if (entityType === 'supplier') {
    return state.suppliers.find((supplier) => supplier.id === entityId)?.name ?? entityId
  }

  if (entityType === 'deal') {
    return state.deals.find((deal) => deal.id === entityId)?.number ?? entityId
  }

  if (entityType === 'counterparty') {
    return state.counterparties.find((counterparty) => counterparty.id === entityId)?.shortName ?? entityId
  }

  return entityId
}
