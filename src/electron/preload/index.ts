import { contextBridge, ipcRenderer, webUtils } from 'electron'
import {
  AppStatusSchema,
  ApproveResultSchema,
  CloudBlockedSensitiveDocumentListSchema,
  DashboardSummarySchema,
  FolderImportPathsRequestSchema,
  FolderImportRequestSchema,
  FolderImportResultSchema,
  IPC_CHANNELS,
  ManualEntityRequestSchema,
  PendingWriteDetailSchema,
  PendingWriteListRequestSchema,
  PendingWriteListSchema,
  PendingWriteRequestSchema,
  ReviewApplySelectionRequestSchema,
  ReviewApproveRequestSchema,
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
  type ApproveResult,
  type CloudBlockedSensitiveDocument,
  type DashboardSummary,
  type FolderImportMode,
  type FolderImportResult,
  type PendingWriteDetail,
  type PendingWriteItem,
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
  async importDroppedFolders(mode: FolderImportMode, files: File[]): Promise<FolderImportResult> {
    const paths = files
      .map((file) => webUtils.getPathForFile(file))
      .filter((path) => path.length > 0)
    const request = FolderImportPathsRequestSchema.parse({ mode, paths })
    const result: unknown = await ipcRenderer.invoke(IPC_CHANNELS.FOLDERS_IMPORT_PATHS, request)
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
  async approveReviewDocument(
    folderId: string,
    docId: string,
    acceptResidualRisk?: boolean
  ): Promise<ApproveResult> {
    const request = ReviewApproveRequestSchema.parse(
      acceptResidualRisk === undefined ? { folderId, docId } : { folderId, docId, acceptResidualRisk }
    )
    const result: unknown = await ipcRenderer.invoke(IPC_CHANNELS.REVIEW_APPROVE, request)
    return ApproveResultSchema.parse(result)
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
  async listPendingWrites(folderId?: string): Promise<PendingWriteItem[]> {
    const request = PendingWriteListRequestSchema.parse(folderId ? { folderId } : {})
    const result: unknown = await ipcRenderer.invoke(IPC_CHANNELS.WRITES_LIST, request)
    return PendingWriteListSchema.parse(result)
  },
  async getPendingWrite(folderId: string, relPath: string): Promise<PendingWriteDetail | null> {
    const request = PendingWriteRequestSchema.parse({ folderId, relPath })
    const result: unknown = await ipcRenderer.invoke(IPC_CHANNELS.WRITE_DETAIL, request)
    return PendingWriteDetailSchema.nullable().parse(result)
  },
  async promotePendingWrite(folderId: string, relPath: string): Promise<boolean> {
    const request = PendingWriteRequestSchema.parse({ folderId, relPath })
    const result: unknown = await ipcRenderer.invoke(IPC_CHANNELS.WRITE_PROMOTE, request)
    return BooleanResultSchema.parse(result).ok
  },
  async listCloudBlockedSensitiveDocuments(): Promise<CloudBlockedSensitiveDocument[]> {
    const result: unknown = await ipcRenderer.invoke(IPC_CHANNELS.SENSITIVE_BLOCKED_LIST)
    return CloudBlockedSensitiveDocumentListSchema.parse(result)
  }
})

contextBridge.exposeInMainWorld('anonymcp', api)
