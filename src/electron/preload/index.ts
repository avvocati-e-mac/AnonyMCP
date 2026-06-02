import { contextBridge, ipcRenderer } from 'electron'
import {
  AppStatusSchema,
  CloudBlockedSensitiveDocumentListSchema,
  DashboardSummarySchema,
  IPC_CHANNELS,
  ReviewDocumentListSchema,
  ReviewListRequestSchema,
  ScanPracticeRequestSchema,
  ScanPracticeResultSchema,
  type AnonymcpElectronApi,
  type AppStatus,
  type CloudBlockedSensitiveDocument,
  type DashboardSummary,
  type ReviewDocumentListItem,
  type ScanPracticeResult
} from '../shared/ipc.js'

const api: AnonymcpElectronApi = Object.freeze({
  async getAppStatus(): Promise<AppStatus> {
    const result: unknown = await ipcRenderer.invoke(IPC_CHANNELS.APP_STATUS)
    return AppStatusSchema.parse(result)
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
  async listCloudBlockedSensitiveDocuments(): Promise<CloudBlockedSensitiveDocument[]> {
    const result: unknown = await ipcRenderer.invoke(IPC_CHANNELS.SENSITIVE_BLOCKED_LIST)
    return CloudBlockedSensitiveDocumentListSchema.parse(result)
  }
})

contextBridge.exposeInMainWorld('anonymcp', api)
