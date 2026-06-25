export type CrmSectionId =
  | 'dashboard'
  | 'counterparties'
  | 'objects'
  | 'deals'
  | 'quotes'
  | 'catalog'
  | 'payments'
  | 'documents'
  | 'tasks'
  | 'activity'
  | 'analytics'
  | 'roles'
  | 'settings'

export type UserRoleCode =
  | 'admin'
  | 'director'
  | 'deputy_director'
  | 'manager'
  | 'accountant'
  | 'installer'
  | 'office_user'

export type CounterpartyType = 'organization' | 'person' | 'ip'
export type CounterpartyStatus = 'active' | 'lead' | 'paused' | 'archive'
export type ObjectStatus = 'survey' | 'quote' | 'contract' | 'installation' | 'warranty' | 'closed'
export type DealStatus =
  | 'new'
  | 'in_progress'
  | 'quote_preparation'
  | 'quote_ready'
  | 'quote_sent'
  | 'negotiation'
  | 'contract'
  | 'awaiting_payment'
  | 'paid'
  | 'installation'
  | 'closed_won'
  | 'closed_lost'
export type QuoteStatus = 'draft' | 'ready' | 'exported' | 'sent' | 'accepted' | 'declined' | 'archived'
export type PaymentStatus =
  | 'invoice_not_issued'
  | 'invoice_issued'
  | 'awaiting_payment'
  | 'partially_paid'
  | 'paid'
  | 'overdue'
  | 'needs_clarification'
export type TaskStatus = 'open' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent'
export type TaskType =
  | 'payment_reminder'
  | 'quote_follow_up'
  | 'document_review'
  | 'fill_missing_data'
  | 'catalog_update_check'
  | 'manual'
export type DocumentType =
  | 'contract'
  | 'invoice'
  | 'act'
  | 'specification'
  | 'drawing'
  | 'photo'
  | 'quote'
  | 'agreement'
  | 'other'
export type SupplierSourceType = 'site_catalog' | 'excel' | 'manual'
export type CatalogUpdateStatus = 'fresh' | 'needs_check' | 'outdated'
export type InstallerNoteStatus = 'local_draft' | 'saved'
export type Currency = 'RUB'

export interface Role {
  id: string
  code: UserRoleCode
  name: string
  summary: string
  permissions: string[]
}

export interface User {
  id: string
  fullName: string
  email: string
  phone: string
  username: string
  roleCode: UserRoleCode
  isActive: boolean
  lastLoginAt: string
}

export interface ContactPerson {
  id: string
  counterpartyId: string
  fullName: string
  position: string
  phone: string
  email: string
  messenger: string
  comment: string
  isPrimary: boolean
}

export interface Counterparty {
  id: string
  type: CounterpartyType
  name: string
  shortName: string
  inn: string
  kpp: string
  ogrn: string
  phone: string
  email: string
  website: string
  legalAddress: string
  actualAddress: string
  comment: string
  responsibleUserId: string
  status: CounterpartyStatus
  createdAt: string
  updatedAt: string
}

export interface WorkObject {
  id: string
  counterpartyId: string
  name: string
  address: string
  geoLat: number | null
  geoLng: number | null
  responsibleManagerId: string
  assignedInstallerId: string
  status: ObjectStatus
  comment: string
  importantNotes: string
  createdAt: string
  updatedAt: string
}

export interface Deal {
  id: string
  number: string
  counterpartyId: string
  objectId: string
  responsibleUserId: string
  status: DealStatus
  paymentStatus: PaymentStatus
  title: string
  description: string
  source: string
  expectedAmount: number
  actualAmount: number
  nextActionText: string
  nextActionAt: string
  createdAt: string
  updatedAt: string
  closedAt: string | null
  inlineInvoiceSummary?: string
  inlineInvoiceDocuments?: Array<{ id: string; title: string }>
  inlineProjectDocuments?: Array<{ id: string; title: string }>
  inlineComment?: string
}

export interface QuoteItem {
  id: string
  quoteId: string
  supplierId: string
  supplierProductId: string
  productVariantId: string
  name: string
  sku: string
  size: string
  color: string
  unit: string
  qty: number
  purchasePrice: number
  salePrice: number
  comment: string
  sortOrder: number
}

export interface Quote {
  id: string
  number: string
  dealId: string
  counterpartyId: string
  objectId: string
  createdByUserId: string
  status: QuoteStatus
  title: string
  introText: string
  termsText: string
  subtotalPurchase: number
  subtotalSale: number
  discountAmount: number
  totalSale: number
  currency: Currency
  exportedDocPath: string
  createdAt: string
  updatedAt: string
  sentAt: string | null
  items: QuoteItem[]
}

export interface Supplier {
  id: string
  name: string
  code: string
  sourceType: SupplierSourceType
  isActive: boolean
  lastUpdatedAt: string
  updateStatus: CatalogUpdateStatus
  updateNote: string
}

export interface SupplierProduct {
  id: string
  supplierId: string
  externalId: string
  sku: string
  name: string
  category: string
  description: string
  unit: string
  basePurchasePrice: number
  currency: Currency
  availability: string
  lastSeenAt: string
  imageUrl?: string
}

export interface ProductVariant {
  id: string
  supplierProductId: string
  variantName: string
  size: string
  color: string
  material: string
  sku: string
  purchasePrice: number
  availability: string
  updatedAt: string
}

export interface PriceHistory {
  id: string
  supplierProductId: string
  productVariantId: string
  supplierId: string
  purchasePrice: number
  currency: Currency
  source: string
  capturedAt: string
}

export interface DocumentRecord {
  id: string
  counterpartyId: string
  objectId: string
  dealId: string
  paymentId: string | null
  quoteId: string | null
  uploadedByUserId: string
  type: DocumentType
  title: string
  originalFilename: string
  demoPath: string
  mimeType: string
  sizeBytes: number
  hash: string
  status: string
  comment: string
  createdAt: string
  updatedAt: string
}

export interface Payment {
  id: string
  counterpartyId: string
  dealId: string
  invoiceDocumentId: string | null
  responsibleUserId: string
  status: PaymentStatus
  invoiceNumber: string
  invoiceDate: string
  expectedPaymentDate: string
  paidAt: string | null
  amountTotal: number
  amountPaid: number
  amountDue: number
  currency: Currency
  comment: string
  createdAt: string
  updatedAt: string
}

export interface TaskRecord {
  id: string
  title: string
  description: string
  type: TaskType
  status: TaskStatus
  priority: TaskPriority
  dueAt: string
  assignedToUserId: string
  createdByUserId: string
  counterpartyId: string | null
  dealId: string | null
  objectId: string | null
  paymentId: string | null
  createdAt: string
  updatedAt: string
  closedAt: string | null
}

export interface InstallerNote {
  id: string
  objectId: string
  dealId: string
  installerUserId: string
  text: string
  measurements: Array<{ label: string; value: string }>
  localClientId: string
  status: InstallerNoteStatus
  createdOfflineAt: string
  createdAt: string
  updatedAt: string
}

export interface ActivityLog {
  id: string
  actorUserId: string
  entityType: string
  entityId: string
  action: string
  title: string
  details: string
  createdAt: string
}

export interface AnalyticsMonth {
  month: string
  deals: number
  quotes: number
  payments: number
  overdue: number
}

export interface CrmState {
  version: number
  roles: Role[]
  users: User[]
  currentUserId: string
  counterparties: Counterparty[]
  contacts: ContactPerson[]
  objects: WorkObject[]
  deals: Deal[]
  quotes: Quote[]
  suppliers: Supplier[]
  products: SupplierProduct[]
  variants: ProductVariant[]
  priceHistory: PriceHistory[]
  documents: DocumentRecord[]
  payments: Payment[]
  tasks: TaskRecord[]
  installerNotes: InstallerNote[]
  activity: ActivityLog[]
  analyticsMonths: AnalyticsMonth[]
}
