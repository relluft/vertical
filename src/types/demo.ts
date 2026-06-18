export type StageStatus = 'pending' | 'in_progress' | 'completed'
export type DemoDocumentType = 'kp' | 'tz'
export type ExportFormat = 'DOCX' | 'PDF' | 'XLSX'
export type QASeverity = 'high' | 'medium' | 'low'
export type CaseBadgeTone = 'ready' | 'progress' | 'attention'
export type DemoWorkflowStageId =
  | 'source'
  | 'need'
  | 'materials'
  | 'comments'
  | 'run'
  | 'editor'
  | 'export'

export type DemoPageKey =
  | 'kp-need'
  | 'kp-materials'
  | 'kp-comments'
  | 'kp-run'
  | 'kp-draft'
  | 'kp-export'
  | 'tz-source'
  | 'tz-need'
  | 'tz-comments'
  | 'tz-run'
  | 'tz-draft'
  | 'tz-export'

export interface DemoAsset {
  id: string
  title: string
  subtitle: string
  kind: 'photo' | 'file' | 'chat'
  source: 'upload' | 'office' | 'system'
  note: string
  addedAt: string
  previewUrl?: string
  fileExtension?: string
}

export interface DemoMeasurement {
  id: string
  label: string
  value: string
  unit: string
  note: string
}

export interface DemoSourceOption {
  id: string
  title: string
  summary: string
  statusLabel: string
  badgeTone: CaseBadgeTone
}

export interface DemoCase {
  id: string
  kpRequestSummary: string
  kpContextNotes: string
  kpMaterials: DemoAsset[]
  tzRequestSummary: string
  tzTechnicalNotes: string
  tzMeasurements: DemoMeasurement[]
  runId: string
  draftId: string
  exportId: string
  isAnchor?: boolean
}

export interface DemoStage {
  id: string
  title: string
  summary: string
  durationLabel: string
  details: string
  durationMs: number
  status: StageStatus
  progress?: number
}

export interface DemoRun {
  id: string
  caseId: string
  status: 'idle' | 'running' | 'completed' | 'aborted'
  startedAt: number | null
  completedAt: number | null
  stages: DemoStage[]
}

export interface DraftField {
  id: 'dueDate' | 'specialTerms'
  label: string
  value: string
  hint: string
}

export interface DraftSection {
  id: string
  title: string
  summary: string
  documentType: DemoDocumentType
  content: string[]
  stats?: Array<{ label: string; value: string }>
  table?: {
    title: string
    columns: string[]
    rows: string[][]
  }
}

export interface DemoOfferTableItem {
  id: string
  description: string
  sourceNeed: string
  productCode: string
  productUrl?: string
  unit: string
  quantity: number
  unitPrice: number
  installationUnitPrice: number
  minSalePrice: number
  maxSalePrice: number
  marketBenchmark: number
  pricingRevision?: string
  reviewStatus: string
  managerComment: string
}

export type OfferItemEditableField =
  | 'description'
  | 'sourceNeed'
  | 'productCode'
  | 'unit'
  | 'quantity'
  | 'unitPrice'
  | 'installationUnitPrice'
  | 'minSalePrice'
  | 'maxSalePrice'
  | 'marketBenchmark'
  | 'reviewStatus'
  | 'managerComment'

export type OfferItemComputedField = 'productTotal' | 'installationTotal' | 'grandTotal'

export type OfferItemField = OfferItemEditableField | OfferItemComputedField

export interface DemoOfferTableTotal {
  id: string
  label: string
  productTotal?: number
  installationTotal?: number
  grandTotal: number
  tone?: 'subtotal' | 'service' | 'final'
}

export interface DemoOfferTable {
  items: DemoOfferTableItem[]
  totals: DemoOfferTableTotal[]
}

export interface SourceLink {
  id: string
  label: string
  sourceType: 'norm' | 'price' | 'photo' | 'note'
  excerpt: string
  relatedSectionId: string
  confidence: 'high' | 'medium'
}

export type DraftCellId =
  | `kp-item:${string}:${OfferItemField}`
  | `kp-total:${string}`
  | `kp-field:${DraftField['id']}`

export interface DraftCellSource {
  label: string
  sourceType: SourceLink['sourceType']
  excerpt: string
  confidence: SourceLink['confidence']
}

export interface DraftCellIssue {
  severity: QASeverity
  title: string
  summary: string
}

export interface DraftCellAnnotation {
  cellId: DraftCellId
  sources: DraftCellSource[]
  issue?: DraftCellIssue
}

export interface QAFlag {
  id: string
  title: string
  severity: QASeverity
  summary: string
  relatedSectionId: string
}

export interface ExportArtifact {
  id: string
  format: ExportFormat
  fileName: string
  createdAt: string
  status: 'generated'
}

export interface DemoDraft {
  id: string
  caseId: string
  documentType: DemoDocumentType
  sections: DraftSection[]
  offerTable: DemoOfferTable | null
  fields: DraftField[]
  cellAnnotations: Partial<Record<DraftCellId, DraftCellAnnotation>>
  issues: QAFlag[]
  sources: SourceLink[]
}

export interface DemoExportForm {
  documentTitle: string
  counterpartyName: string
  counterpartyAddress: string
  objectAddress: string
  documentDate: string
  documentNumber: string
  signatoryName: string
  manualNotes: string
}

export interface DemoExportGeneration {
  selectedFormat: ExportFormat | null
  status: 'idle' | 'generating' | 'ready'
  progressPercent: number
  generatedArtifact: ExportArtifact | null
  downloadMessage: string | null
}

export interface RecentOperation {
  id: string
  branch: DemoDocumentType
  title: string
  description: string
  createdAt: string
}

export interface BranchProgress {
  currentStageId: DemoWorkflowStageId
  completedStageIds: DemoWorkflowStageId[]
}

export interface PipelineLaunchState {
  started: boolean
  pipelineName: string
}

export interface DemoState {
  cases: DemoCase[]
  run: DemoRun
  draft: DemoDraft
  nextPipelineNumber: number
  selectedDocumentType: DemoDocumentType
  selectedSectionId: string
  focusedIssueId: string | null
  exportForm: DemoExportForm
  exportGeneration: DemoExportGeneration
  recentOperations: RecentOperation[]
  currentBranchStage: Record<DemoDocumentType, DemoWorkflowStageId>
  branchProgress: Record<DemoDocumentType, BranchProgress>
  selectedSourceKpId: string | null
  branchLaunch: Record<DemoDocumentType, PipelineLaunchState>
  demoAppliedByPage: Partial<Record<DemoPageKey, boolean>>
}
