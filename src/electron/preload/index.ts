import { contextBridge, ipcRenderer } from 'electron'
import {
  AppStatusSchema,
  CloudBlockedSensitiveDocumentListSchema,
  DashboardSummarySchema,
  FolderImportRequestSchema,
  FolderImportResultSchema,
  IPC_CHANNELS,
  ManualEntityRequestSchema,
  ReviewApplySelectionRequestSchema,
  ReviewDocumentDetailSchema,
  ReviewDocumentRequestSchema,
  ReviewEntitySchema,
  ReviewDocumentListSchema,
  ReviewListRequestSchema,
  ReviewSetSensitivityRequestSchema,
  ScanPracticeRequestSchema,
  ScanPracticeResultSchema,
  BooleanResultSchema,
  type AnonymcpElectronApi,
  type AppStatus,
  type CloudBlockedSensitiveDocument,
  type DashboardSummary,
  type FolderImportMode,
  type FolderImportResult,
  type ReviewDocumentDetail,
  type ReviewDocumentListItem,
  type ReviewEntity,
  type ScanPracticeResult
} from '../shared/ipc.js'

const api: AnonymcpElectronApi = Object.freeze({
  async getAppStatus(): Promise<AppStatus> {
    const result: unknown = await ipcRenderer.invoke(IPC_CHANNELS.APP_STATUS)
    return AppStatusSchema.parse(result)
  },
  async selectAndImportFolders(mode: FolderImportMode): Promise<FolderImportResult> {
    const request = FolderImportRequestSchema.parse({ mode })
    const result: unknown = await ipcRenderer.invoke(IPC_CHANNELS.FOLDERS_SELECT_IMPORT, request)
    return FolderImportResultSchema.parse(result)
  },
  async getDashboard(): Promise<DashboardSummary> {
    const result: unknown = await ipcRenderer.invoke(IPC_CHANNELS.DASHBOARD_GET)
    return DashboardSummarySchema.parse(result)
  },
  async scanPractice(folderId: string): Promise<ScanPracticeResult> {
    const request = ScanPracticeRequestSchema.parse({ folderId })
    const result: unknown = await ipcRenderer.invoke(IPC_CHANNELS.PRACTICE_SCAN, request)
    return ScanPracticeResultSchema.parse(result)
  },
  async listReviewDocuments(folderId?: string): Promise<ReviewDocumentListItem[]> {
    const request = ReviewListRequestSchema.parse(folderId ? { folderId } : {})
    const result: unknown = await ipcRenderer.invoke(IPC_CHANNELS.REVIEW_LIST, request)
    return ReviewDocumentListSchema.parse(result)
  },
  async getReviewDocument(folderId: string, docId: string): Promise<ReviewDocumentDetail | null> {
    const request = ReviewDocumentRequestSchema.parse({ folderId, docId })
    const result: unknown = await ipcRenderer.invoke(IPC_CHANNELS.REVIEW_DETAIL, request)
    return ReviewDocumentDetailSchema.nullable().parse(result)
  },
  async addManualEntity(
    folderId: string,
    docId: string,
    originalText: string,
    type: ReviewEntity['type']
  ): Promise<ReviewEntity | null> {
    const request = ManualEntityRequestSchema.parse({ folderId, docId, originalText, type })
    const result: unknown = await ipcRenderer.invoke(IPC_CHANNELS.REVIEW_ADD_MANUAL_ENTITY, request)
    return ReviewEntitySchema.nullable().parse(result)
  },
  async applyReviewSelection(
    folderId: string,
    docId: string,
    entities: ReviewEntity[]
  ): Promise<boolean> {
    const request = ReviewApplySelectionRequestSchema.parse({ folderId, docId, entities })
    const result: unknown = await ipcRenderer.invoke(IPC_CHANNELS.REVIEW_APPLY_SELECTION, request)
    return BooleanResultSchema.parse(result).ok
  },
  async approveReviewDocument(folderId: string, docId: string): Promise<boolean> {
    const request = ReviewDocumentRequestSchema.parse({ folderId, docId })
    const result: unknown = await ipcRenderer.invoke(IPC_CHANNELS.REVIEW_APPROVE, request)
    return BooleanResultSchema.parse(result).ok
  },
  async setDocumentSensitivity(
    folderId: string,
    docId: string,
    decision: 'sensitive' | 'not_sensitive' | null
  ): Promise<boolean> {
    const request = ReviewSetSensitivityRequestSchema.parse({ folderId, docId, decision })
    const result: unknown = await ipcRenderer.invoke(IPC_CHANNELS.REVIEW_SET_SENSITIVITY, request)
    return BooleanResultSchema.parse(result).ok
  },
  async listCloudBlockedSensitiveDocuments(): Promise<CloudBlockedSensitiveDocument[]> {
    const result: unknown = await ipcRenderer.invoke(IPC_CHANNELS.SENSITIVE_BLOCKED_LIST)
    return CloudBlockedSensitiveDocumentListSchema.parse(result)
  }
})

contextBridge.exposeInMainWorld('anonymcp', api)
