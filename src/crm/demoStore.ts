import { demoTodayIso, seedCrmState } from './mockData'
import type { ActivityLog, CrmState, Quote, QuoteItem } from './types'
import type { DemoOfferTable } from '../types/demo'

const storageKey = 'uchet-system-crm-demo-v2'

function cloneSeedState(): CrmState {
  return JSON.parse(JSON.stringify(seedCrmState)) as CrmState
}

function isCrmState(value: unknown): value is CrmState {
  if (!value || typeof value !== 'object') {
    return false
  }

  const state = value as Partial<CrmState>

  return (
    state.version === 1 &&
    Array.isArray(state.users) &&
    Array.isArray(state.counterparties) &&
    Array.isArray(state.deals) &&
    Array.isArray(state.quotes) &&
    Array.isArray(state.products) &&
    Array.isArray(state.suppliers) &&
    state.suppliers.every((supplier) => 'lastUpdatedAt' in supplier && 'updateStatus' in supplier)
  )
}

function recalculateQuote(quote: Quote): Quote {
  const subtotalPurchase = quote.items.reduce((sum, item) => sum + item.purchasePrice * item.qty, 0)
  const subtotalSale = quote.items.reduce((sum, item) => sum + item.salePrice * item.qty, 0)
  const totalSale = Math.max(0, subtotalSale - quote.discountAmount)

  return {
    ...quote,
    subtotalPurchase,
    subtotalSale,
    totalSale,
  }
}

function recalculateStateQuotes(state: CrmState): CrmState {
  return {
    ...state,
    quotes: state.quotes.map(recalculateQuote),
  }
}

function cloneSeedCatalog() {
  return {
    products: JSON.parse(JSON.stringify(seedCrmState.products)) as CrmState['products'],
    variants: JSON.parse(JSON.stringify(seedCrmState.variants)) as CrmState['variants'],
    priceHistory: JSON.parse(JSON.stringify(seedCrmState.priceHistory)) as CrmState['priceHistory'],
  }
}

function normalizeParserMockCatalog(state: CrmState): CrmState {
  const hasParserMockCatalog =
    state.products.filter(
      (product) => product.supplierId === 'sup-vertical' && product.imageUrl?.startsWith('/mock/vertical-products/'),
    ).length >= 50

  if (hasParserMockCatalog) {
    return state
  }

  const seedVerticalSupplier = seedCrmState.suppliers.find((supplier) => supplier.id === 'sup-vertical')
  const hasVerticalSupplier = state.suppliers.some((supplier) => supplier.id === 'sup-vertical')
  const suppliers = seedVerticalSupplier
    ? [
        ...state.suppliers.map((supplier) => (supplier.id === 'sup-vertical' ? seedVerticalSupplier : supplier)),
        ...(hasVerticalSupplier ? [] : [seedVerticalSupplier]),
      ]
    : state.suppliers
  const catalog = cloneSeedCatalog()

  return {
    ...state,
    suppliers,
    products: catalog.products,
    variants: catalog.variants,
    priceHistory: catalog.priceHistory,
  }
}

function normalizeDirectorProfile(state: CrmState): CrmState {
  return {
    ...state,
    users: state.users.map((user) =>
      user.id === 'user-director'
        ? {
            ...user,
            fullName: 'Илья Кайнов',
            username: 'ikaynov',
          }
        : user,
    ),
  }
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function nowIso() {
  return new Date().toISOString()
}

function appendActivity(
  state: CrmState,
  input: Omit<ActivityLog, 'id' | 'createdAt'> & { createdAt?: string },
) {
  const activity: ActivityLog = {
    id: makeId('act'),
    createdAt: input.createdAt ?? nowIso(),
    actorUserId: input.actorUserId,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    title: input.title,
    details: input.details,
  }

  return {
    ...state,
    activity: [activity, ...state.activity].slice(0, 80),
  }
}

export function loadCrmState(): CrmState {
  if (typeof window === 'undefined') {
    return normalizeDirectorProfile(cloneSeedState())
  }

  try {
    const raw = window.localStorage.getItem(storageKey)
    const parsed = raw ? JSON.parse(raw) : null

    if (isCrmState(parsed)) {
      return normalizeDirectorProfile(recalculateStateQuotes(normalizeParserMockCatalog(parsed)))
    }
  } catch {
    return normalizeDirectorProfile(cloneSeedState())
  }

  return normalizeDirectorProfile(cloneSeedState())
}

export function saveCrmState(state: CrmState) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(storageKey, JSON.stringify(state))
  }
}

export function resetCrmState() {
  const state = cloneSeedState()
  saveCrmState(state)
  return state
}

export function setCurrentUser(state: CrmState, userId: string): CrmState {
  if (!state.users.some((user) => user.id === userId)) {
    return state
  }

  return {
    ...state,
    currentUserId: userId,
  }
}

export function addQuoteItemFromVariant(
  state: CrmState,
  quoteId: string,
  variantId: string,
  actorUserId: string,
): CrmState {
  const quote = state.quotes.find((item) => item.id === quoteId)
  const variant = state.variants.find((item) => item.id === variantId)
  const product = variant ? state.products.find((item) => item.id === variant.supplierProductId) : undefined
  const supplier = product ? state.suppliers.find((item) => item.id === product.supplierId) : undefined

  if (!quote || !variant || !product || !supplier) {
    return state
  }

  const nextItem: QuoteItem = {
    id: makeId('qi'),
    quoteId,
    supplierId: supplier.id,
    supplierProductId: product.id,
    productVariantId: variant.id,
    name: product.name,
    sku: variant.sku,
    size: variant.size,
    color: variant.color,
    unit: product.unit,
    qty: 1,
    purchasePrice: variant.purchasePrice,
    salePrice: Math.round(variant.purchasePrice * 1.35),
    comment: 'Добавлено из каталога, закупочная цена сохранена snapshot-ом.',
    sortOrder: quote.items.length + 1,
  }

  const nextState = {
    ...state,
    quotes: state.quotes.map((item) =>
      item.id === quoteId
        ? recalculateQuote({
            ...item,
            status: item.status === 'draft' ? 'draft' : 'ready',
            updatedAt: nowIso(),
            items: [...item.items, nextItem],
          })
        : item,
    ),
  }

  return appendActivity(nextState, {
    actorUserId,
    entityType: 'quote',
    entityId: quoteId,
    action: 'quote.item_added',
    title: `В КП добавлен товар ${product.name}`,
    details: `${supplier.name}: закупка ${variant.purchasePrice} руб., цена продажи ${nextItem.salePrice} руб.`,
  })
}

export function updateQuoteItemSalePrice(
  state: CrmState,
  quoteId: string,
  itemId: string,
  salePrice: number,
): CrmState {
  if (!Number.isFinite(salePrice) || salePrice < 0) {
    return state
  }

  return {
    ...state,
    quotes: state.quotes.map((quote) =>
      quote.id === quoteId
        ? recalculateQuote({
            ...quote,
            updatedAt: nowIso(),
            items: quote.items.map((item) =>
              item.id === itemId ? { ...item, salePrice: Math.round(salePrice) } : item,
            ),
          })
        : quote,
    ),
  }
}

export function updateQuoteItemQty(
  state: CrmState,
  quoteId: string,
  itemId: string,
  qty: number,
): CrmState {
  if (!Number.isFinite(qty) || qty <= 0) {
    return state
  }

  return {
    ...state,
    quotes: state.quotes.map((quote) =>
      quote.id === quoteId
        ? recalculateQuote({
            ...quote,
            updatedAt: nowIso(),
            items: quote.items.map((item) =>
              item.id === itemId ? { ...item, qty: Math.max(1, Math.round(qty)) } : item,
            ),
          })
        : quote,
    ),
  }
}

export function removeQuoteItem(
  state: CrmState,
  quoteId: string,
  itemId: string,
  actorUserId: string,
): CrmState {
  const quote = state.quotes.find((item) => item.id === quoteId)
  const removedItem = quote?.items.find((item) => item.id === itemId)

  if (!quote || !removedItem) {
    return state
  }

  const nextState = {
    ...state,
    quotes: state.quotes.map((item) =>
      item.id === quoteId
        ? recalculateQuote({
            ...item,
            updatedAt: nowIso(),
            items: item.items.filter((quoteItem) => quoteItem.id !== itemId),
          })
        : item,
    ),
  }

  return appendActivity(nextState, {
    actorUserId,
    entityType: 'quote',
    entityId: quoteId,
    action: 'quote.item_removed',
    title: `Из КП удалена позиция ${removedItem.name}`,
    details: `Количество было ${removedItem.qty} ${removedItem.unit}.`,
  })
}

export function markPaymentPaid(state: CrmState, paymentId: string, actorUserId: string): CrmState {
  const payment = state.payments.find((item) => item.id === paymentId)

  if (!payment || payment.status === 'paid') {
    return state
  }

  const nextPayments = state.payments.map((item) =>
    item.id === paymentId
      ? {
          ...item,
          status: 'paid' as const,
          paidAt: demoTodayIso,
          amountPaid: item.amountTotal,
          amountDue: 0,
          updatedAt: nowIso(),
        }
      : item,
  )
  const nextDeals = state.deals.map((deal) =>
    deal.id === payment.dealId ? { ...deal, paymentStatus: 'paid' as const, updatedAt: nowIso() } : deal,
  )
  const nextState = { ...state, payments: nextPayments, deals: nextDeals }

  return appendActivity(nextState, {
    actorUserId,
    entityType: 'payment',
    entityId: paymentId,
    action: 'payment.marked_paid',
    title: `Оплата ${payment.invoiceNumber} отмечена как поступившая`,
    details: `Сумма ${payment.amountTotal} руб. закрыта полностью.`,
  })
}

export function upsertQuoteFromOfferTable(
  state: CrmState,
  input: {
    dealId: string
    actorUserId: string
    documentNumber: string
    title: string
    documentDate: string
    offerTable: DemoOfferTable
  },
): CrmState {
  const deal = state.deals.find((item) => item.id === input.dealId)

  if (!deal) {
    return state
  }

  const existingQuote = state.quotes.find((item) => item.dealId === deal.id)
  const timestamp = nowIso()
  const fallbackSupplier = state.suppliers[0]
  const fallbackProduct = state.products[0]
  const fallbackVariant = state.variants[0]

  const items: QuoteItem[] = input.offerTable.items.map((item, index) => {
    const variant =
      state.variants.find((entry) => entry.id === item.productCode || entry.sku === item.productCode) ??
      state.variants.find((entry) => entry.sku && item.description.includes(entry.sku)) ??
      fallbackVariant
    const product =
      (variant ? state.products.find((entry) => entry.id === variant.supplierProductId) : undefined) ??
      state.products.find((entry) => entry.sku === item.productCode) ??
      fallbackProduct
    const supplier =
      (product ? state.suppliers.find((entry) => entry.id === product.supplierId) : undefined) ??
      fallbackSupplier

    return {
      id: existingQuote?.items[index]?.id ?? makeId('qi'),
      quoteId: existingQuote?.id ?? 'pending-quote',
      supplierId: supplier?.id ?? 'manual-supplier',
      supplierProductId: product?.id ?? 'manual-product',
      productVariantId: variant?.id ?? 'manual-variant',
      name: item.description.trim() || `Позиция КП ${index + 1}`,
      sku: item.productCode.trim() || variant?.sku || product?.sku || `manual-${index + 1}`,
      size: variant?.size ?? '',
      color: variant?.color ?? '',
      unit: item.unit.trim() || product?.unit || 'шт',
      qty: Math.max(1, Math.round(item.quantity || 1)),
      purchasePrice: Math.max(0, Math.round(item.unitPrice || 0)),
      salePrice: Math.max(0, Math.round(item.installationUnitPrice || 0)),
      comment: item.managerComment || item.reviewStatus || 'Добавлено из конструктора КП.',
      sortOrder: index + 1,
    }
  })

  const quoteId = existingQuote?.id ?? makeId('quote')
  const quoteItems = items.map((item) => ({ ...item, quoteId }))
  const subtotalPurchase = quoteItems.reduce((sum, item) => sum + item.purchasePrice * item.qty, 0)
  const subtotalSale = quoteItems.reduce((sum, item) => sum + item.salePrice * item.qty, 0)
  const documentNumber = input.documentNumber.trim() || `КП-${deal.number}`
  const title = input.title.trim() || `КП по проекту ${deal.number}`

  const nextQuote: Quote = {
    id: quoteId,
    number: documentNumber,
    dealId: deal.id,
    counterpartyId: deal.counterpartyId,
    objectId: deal.objectId,
    createdByUserId: input.actorUserId,
    status: quoteItems.length ? 'ready' : 'draft',
    title,
    introText: 'Коммерческое предложение подготовлено менеджером через встроенный конструктор проекта.',
    termsText: `Срок действия КП и наличие товаров подтверждаются на дату ${input.documentDate}.`,
    subtotalPurchase,
    subtotalSale,
    discountAmount: existingQuote?.discountAmount ?? 0,
    totalSale: Math.max(0, subtotalSale - (existingQuote?.discountAmount ?? 0)),
    currency: 'RUB',
    exportedDocPath: `/documents/${documentNumber.replace(/[^\p{L}\p{N}-]+/gu, '_')}.docx`,
    createdAt: existingQuote?.createdAt ?? timestamp,
    updatedAt: timestamp,
    sentAt: existingQuote?.sentAt ?? null,
    items: quoteItems,
  }
  const recalculatedQuote = recalculateQuote(nextQuote)
  const documentId = state.documents.find((item) => item.quoteId === quoteId)?.id ?? makeId('doc')
  const nextDocument = {
    id: documentId,
    counterpartyId: deal.counterpartyId,
    objectId: deal.objectId,
    dealId: deal.id,
    paymentId: null,
    quoteId,
    uploadedByUserId: input.actorUserId,
    type: 'quote' as const,
    title,
    originalFilename: `${documentNumber}.docx`,
    demoPath: recalculatedQuote.exportedDocPath,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    sizeBytes: Math.max(48000, 42000 + quoteItems.length * 3100),
    hash: `demo-${quoteId}-${quoteItems.length}-${Math.round(recalculatedQuote.totalSale)}`,
    status: quoteItems.length ? 'собрано в конструкторе' : 'черновик без позиций',
    comment: 'КП прикреплено к проекту после ручной сборки в конструкторе.',
    createdAt: state.documents.find((item) => item.id === documentId)?.createdAt ?? timestamp,
    updatedAt: timestamp,
  }

  const nextState = {
    ...state,
    deals: state.deals.map((item) =>
      item.id === deal.id
        ? {
            ...item,
            status: quoteItems.length ? ('quote_ready' as const) : item.status,
            expectedAmount: recalculatedQuote.totalSale || item.expectedAmount,
            updatedAt: timestamp,
            nextActionText: quoteItems.length
              ? 'Проверить КП, отправить клиенту и зафиксировать решение'
              : 'Заполнить позиции КП в конструкторе',
            nextActionAt: quoteItems.length ? addDaysIso(input.documentDate, 2) : item.nextActionAt,
          }
        : item,
    ),
    quotes: existingQuote
      ? state.quotes.map((item) => (item.id === quoteId ? recalculatedQuote : item))
      : [recalculatedQuote, ...state.quotes],
    documents: state.documents.some((item) => item.id === documentId)
      ? state.documents.map((item) => (item.id === documentId ? nextDocument : item))
      : [nextDocument, ...state.documents],
  }

  return appendActivity(nextState, {
    actorUserId: input.actorUserId,
    entityType: 'quote',
    entityId: quoteId,
    action: existingQuote ? 'quote.updated_from_constructor' : 'quote.created_from_constructor',
    title: `${documentNumber} сохранено в проекте`,
    details: quoteItems.length
      ? `Сохранено ${quoteItems.length} позиций на сумму ${Math.round(recalculatedQuote.totalSale)} руб.`
      : 'Создан пустой черновик КП, привязанный к проекту.',
  })
}

function addDaysIso(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) {
    return nowIso()
  }

  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString()
}

export function closeTask(state: CrmState, taskId: string, actorUserId: string): CrmState {
  const task = state.tasks.find((item) => item.id === taskId)

  if (!task || task.status === 'done') {
    return state
  }

  const nextState = {
    ...state,
    tasks: state.tasks.map((item) =>
      item.id === taskId
        ? {
            ...item,
            status: 'done' as const,
            closedAt: nowIso(),
            updatedAt: nowIso(),
          }
        : item,
    ),
  }

  return appendActivity(nextState, {
    actorUserId,
    entityType: 'task',
    entityId: taskId,
    action: 'task.closed',
    title: `Задача закрыта: ${task.title}`,
    details: task.description,
  })
}
