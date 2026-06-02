import { z } from 'zod'

export const IPC_CHANNELS = {
  APP_STATUS: 'app:status',
  DASHBOARD_GET: 'dashboard:get',
  PRACTICE_SCAN: 'practice:scan',
  REVIEW_LIST: 'review:list',
  SENSITIVE_BLOCKED_LIST: 'sensitive-blocked:list'
} as const

const MatterSchema = z.enum(['civile', 'penale', 'tributario', 'amministrativo', 'altro'])
const DocumentStatusSchema = z.enum(['quarantined', 'review_required', 'approved', 'superseded'])
const SensitivityOverrideSchema = z.enum(['sensitive', 'not_sensitive'])

export const AppStatusSchema = z.object({
  configPresent: z.boolean(),
  configuredFolders: z.number().int().nonnegative(),
  mcpReady: z.boolean(),
  configError: z.string().optional()
}).strict()

export type AppStatus = z.infer<typeof AppStatusSchema>

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
  getDashboard: () => Promise<DashboardSummary>
  scanPractice: (folderId: string) => Promise<ScanPracticeResult>
  listReviewDocuments: (folderId?: string) => Promise<ReviewDocumentListItem[]>
  listCloudBlockedSensitiveDocuments: () => Promise<CloudBlockedSensitiveDocument[]>
}
