import { z } from 'zod'

export const IPC_CHANNELS = {
  APP_STATUS: 'app:status',
  FOLDERS_SELECT_IMPORT: 'folders:select-import',
  FOLDERS_IMPORT_PATHS: 'folders:import-paths',
  DASHBOARD_GET: 'dashboard:get',
  PRACTICE_SCAN: 'practice:scan',
  REVIEW_LIST: 'review:list',
  REVIEW_DETAIL: 'review:detail',
  REVIEW_ADD_MANUAL_ENTITY: 'review:add-manual-entity',
  REVIEW_APPLY_SELECTION: 'review:apply-selection',
  REVIEW_APPROVE: 'review:approve',
  REVIEW_SET_SENSITIVITY: 'review:set-sensitivity',
  WRITES_LIST: 'writes:list',
  WRITE_DETAIL: 'write:detail',
  WRITE_PROMOTE: 'write:promote',
  SENSITIVE_BLOCKED_LIST: 'sensitive-blocked:list'
} as const

const MatterSchema = z.enum(['civile', 'penale', 'tributario', 'amministrativo', 'altro'])
export const FolderImportModeSchema = z.enum(['manual', 'practices_root', 'clients_root'])
const DocumentStatusSchema = z.enum(['quarantined', 'review_required', 'approved', 'superseded'])
const SensitivityOverrideSchema = z.enum(['sensitive', 'not_sensitive'])
export const EntityTypeSchema = z.enum([
  'PERSONA',
  'ORGANIZZAZIONE',
  'LUOGO',
  'CODICE_FISCALE',
  'PARTITA_IVA',
  'IBAN',
  'EMAIL',
  'TELEFONO',
  'DATA_NASCITA',
  'LUOGO_NASCITA',
  'INDIRIZZO',
  'NUMERO_DOCUMENTO',
  'TARGA',
  'NUMERO_RUOLO',
  'PEC',
  'PROTOCOLLO'
])
const EntitySourceSchema = z.enum(['regex', 'ner', 'coref', 'manual', 'dictionary'])

export const AppStatusSchema = z.object({
  configPresent: z.boolean(),
  configuredFolders: z.number().int().nonnegative(),
  mcpReady: z.boolean(),
  configError: z.string().optional()
}).strict()

export type AppStatus = z.infer<typeof AppStatusSchema>

export type FolderImportMode = z.infer<typeof FolderImportModeSchema>

export const FolderImportRequestSchema = z.object({
  mode: FolderImportModeSchema
}).strict()

export const FolderImportPathsRequestSchema = FolderImportRequestSchema.extend({
  paths: z.array(z.string().min(1)).min(1).max(200)
}).strict()

export const ImportedFolderSchema = z.object({
  id: z.string(),
  label: z.string(),
  path: z.string(),
  matter: MatterSchema.optional()
}).strict()

export const FolderImportResultSchema = z.object({
  added: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  folders: z.array(ImportedFolderSchema)
}).strict()

export type FolderImportResult = z.infer<typeof FolderImportResultSchema>

export const PracticeSummarySchema = z.object({
  folderId: z.string(),
  label: z.string(),
  path: z.string(),
  matter: MatterSchema,
  approved: z.number().int().nonnegative(),
  reviewRequired: z.number().int().nonnegative(),
  sensitiveDocs: z.number().int().nonnegative(),
  exposed: z.number().int().nonnegative(),
  cloudBlockedSensitiveDocs: z.number().int().nonnegative(),
  pendingWrites: z.number().int().nonnegative()
}).strict()

export const DashboardSummarySchema = z.object({
  practices: z.array(PracticeSummarySchema),
  totals: z.object({
    practices: z.number().int().nonnegative(),
    approved: z.number().int().nonnegative(),
    reviewRequired: z.number().int().nonnegative(),
    sensitiveDocs: z.number().int().nonnegative(),
    exposed: z.number().int().nonnegative(),
    cloudBlockedSensitiveDocs: z.number().int().nonnegative(),
    pendingWrites: z.number().int().nonnegative()
  }).strict()
}).strict()

export type DashboardSummary = z.infer<typeof DashboardSummarySchema>

export const ScanPracticeRequestSchema = z.object({
  folderId: z.string().min(1)
}).strict()

export const ScanPracticeResultSchema = z.object({
  scanned: z.number().int().nonnegative(),
  reviewRequired: z.number().int().nonnegative(),
  approved: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative()
}).strict()

export type ScanPracticeResult = z.infer<typeof ScanPracticeResultSchema>

export const ReviewListRequestSchema = z.object({
  folderId: z.string().min(1).optional()
}).strict()

export const ReviewDocumentListItemSchema = z.object({
  folderId: z.string(),
  label: z.string(),
  docId: z.string(),
  fileName: z.string(),
  status: DocumentStatusSchema,
  sensitive: z.boolean(),
  sensitiveSuggested: z.boolean(),
  sensitivityOverride: SensitivityOverrideSchema.optional(),
  exposable: z.boolean()
}).strict()

export const ReviewDocumentListSchema = z.array(ReviewDocumentListItemSchema)
export type ReviewDocumentListItem = z.infer<typeof ReviewDocumentListItemSchema>

export const ReviewDocumentRequestSchema = z.object({
  folderId: z.string().min(1),
  docId: z.string().min(1)
}).strict()

export const ReviewEntitySchema = z.object({
  type: EntityTypeSchema,
  originalText: z.string(),
  pseudonym: z.string(),
  occurrences: z.number().int().nonnegative(),
  source: EntitySourceSchema
}).strict()

export type ReviewEntity = z.infer<typeof ReviewEntitySchema>

export const ReviewDocumentDetailSchema = ReviewDocumentListItemSchema.extend({
  originalText: z.string(),
  anonymizedText: z.string(),
  residualRisk: z.number().min(0).max(1),
  entities: z.array(ReviewEntitySchema)
}).strict()

export type ReviewDocumentDetail = z.infer<typeof ReviewDocumentDetailSchema>

export const ManualEntityRequestSchema = ReviewDocumentRequestSchema.extend({
  originalText: z.string().min(1),
  type: EntityTypeSchema
}).strict()

export const ReviewApplySelectionRequestSchema = ReviewDocumentRequestSchema.extend({
  entities: z.array(ReviewEntitySchema)
}).strict()

export const ReviewSetSensitivityRequestSchema = ReviewDocumentRequestSchema.extend({
  decision: SensitivityOverrideSchema.nullable()
}).strict()

export const BooleanResultSchema = z.object({
  ok: z.boolean()
}).strict()

export const PendingWriteListRequestSchema = z.object({
  folderId: z.string().min(1).optional()
}).strict()

export const PendingWriteSchema = z.object({
  folderId: z.string(),
  label: z.string(),
  fileName: z.string(),
  relPath: z.string(),
  contentHash: z.string(),
  stagedAt: z.string(),
  overwrite: z.boolean().optional()
}).strict()

export const PendingWriteListSchema = z.array(PendingWriteSchema)
export type PendingWriteItem = z.infer<typeof PendingWriteSchema>

export const PendingWriteRequestSchema = z.object({
  folderId: z.string().min(1),
  relPath: z.string().min(1)
}).strict()

export const PendingWriteDetailSchema = PendingWriteSchema.extend({
  content: z.string(),
  hashMatches: z.boolean()
}).strict()

export type PendingWriteDetail = z.infer<typeof PendingWriteDetailSchema>

export const CloudBlockedSensitiveDocumentSchema = z.object({
  folderId: z.string(),
  label: z.string(),
  practicePath: z.string(),
  docId: z.string(),
  fileName: z.string(),
  status: DocumentStatusSchema,
  sensitive: z.boolean(),
  sensitiveSuggested: z.boolean(),
  sensitivityOverride: SensitivityOverrideSchema.optional()
}).strict()

export const CloudBlockedSensitiveDocumentListSchema = z.array(CloudBlockedSensitiveDocumentSchema)
export type CloudBlockedSensitiveDocument = z.infer<typeof CloudBlockedSensitiveDocumentSchema>

export interface AnonymcpElectronApi {
  getAppStatus: () => Promise<AppStatus>
  selectAndImportFolders: (mode: FolderImportMode) => Promise<FolderImportResult>
  importDroppedFolders: (mode: FolderImportMode, files: File[]) => Promise<FolderImportResult>
  getDashboard: () => Promise<DashboardSummary>
  scanPractice: (folderId: string) => Promise<ScanPracticeResult>
  listReviewDocuments: (folderId?: string) => Promise<ReviewDocumentListItem[]>
  getReviewDocument: (folderId: string, docId: string) => Promise<ReviewDocumentDetail | null>
  addManualEntity: (
    folderId: string,
    docId: string,
    originalText: string,
    type: z.infer<typeof EntityTypeSchema>
  ) => Promise<ReviewEntity | null>
  applyReviewSelection: (folderId: string, docId: string, entities: ReviewEntity[]) => Promise<boolean>
  approveReviewDocument: (folderId: string, docId: string) => Promise<boolean>
  setDocumentSensitivity: (
    folderId: string,
    docId: string,
    decision: z.infer<typeof SensitivityOverrideSchema> | null
  ) => Promise<boolean>
  listPendingWrites: (folderId?: string) => Promise<PendingWriteItem[]>
  getPendingWrite: (folderId: string, relPath: string) => Promise<PendingWriteDetail | null>
  promotePendingWrite: (folderId: string, relPath: string) => Promise<boolean>
  listCloudBlockedSensitiveDocuments: () => Promise<CloudBlockedSensitiveDocument[]>
}
