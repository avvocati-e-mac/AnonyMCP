import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  session,
  type IpcMainInvokeEvent,
  type OpenDialogOptions
} from 'electron'
import { existsSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { loadConfig, saveConfig } from '../../config.js'
import { LocalReviewService } from '../../app/reviewService.js'
import { buildExposedFolders, discoverPracticeFolders, type FolderImportMode } from '../../app/folderImport.js'
import { log } from '../../util/logger.js'
import {
  AppStatusSchema,
  BooleanResultSchema,
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
  ReviewDocumentDetailSchema,
  ReviewDocumentRequestSchema,
  ReviewEntitySchema,
  ReviewDocumentListSchema,
  ReviewListRequestSchema,
  ReviewSetSensitivityRequestSchema,
  ScanPracticeRequestSchema,
  ScanPracticeResultSchema,
  type AppStatus
} from '../shared/ipc.js'
import type { AnonyMcpConfig } from '../../types.js'

const isDev = !!process.env.ELECTRON_RENDERER_URL
let serviceCache: { configPath: string; configHash?: string; service: LocalReviewService } | null = null

function csp(): string {
  if (isDev) {
    return [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self' ws://localhost:* http://localhost:*",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'none'"
    ].join('; ')
  }
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'"
  ].join('; ')
}

function installSecurityHeaders(): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp()]
      }
    })
  })
}

function isTrustedRendererUrl(url: string): boolean {
  if (isDev) {
    const devUrl = process.env.ELECTRON_RENDERER_URL
    if (!devUrl) return false
    try {
      const expected = new URL(devUrl)
      const actual = new URL(url)
      return actual.origin === expected.origin
    } catch {
      return false
    }
  }
  const rendererUrl = pathToFileURL(join(__dirname, '../renderer/index.html')).href
  return url === rendererUrl || url.startsWith(`${rendererUrl}#`)
}

function assertTrustedSender(event: IpcMainInvokeEvent): void {
  const senderUrl = event.senderFrame?.url ?? event.sender.getURL()
  if (!isTrustedRendererUrl(senderUrl)) {
    log.warn('IPC bloccato: renderer non autorizzato', { senderUrl })
    throw new Error('Renderer non autorizzato.')
  }
}

function configPath(): string {
  return process.env.ANONYMCP_CONFIG ?? join(app.getPath('userData'), 'anonymcp.config.json')
}

function absoluteConfigPath(): string {
  return resolve(configPath())
}

function configHash(path: string): string | undefined {
  if (!existsSync(path)) return undefined
  return createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 12)
}

function localReviewService(): LocalReviewService {
  const path = absoluteConfigPath()
  const hash = configHash(path)
  if (serviceCache?.configPath === path && serviceCache.configHash === hash) return serviceCache.service
  serviceCache?.service.close()
  const config = loadConfig(path)
  const service = LocalReviewService.fromConfig(config)
  serviceCache = { configPath: path, configHash: hash, service }
  return service
}

function defaultConfig(): AnonyMcpConfig {
  return {
    version: 1,
    folders: [],
    requireManualApproval: true,
    allowCloudForSensitive: false,
    logLevel: 'info'
  }
}

function loadConfigOrDefault(): AnonyMcpConfig {
  try {
    return loadConfig(configPath())
  } catch {
    return defaultConfig()
  }
}

function importPracticePaths(paths: string[], mode: FolderImportMode): unknown {
  const config = loadConfigOrDefault()
  const candidates = discoverPracticeFolders(paths, mode)
  const folders = buildExposedFolders(candidates, { existingFolders: config.folders })
  const nextConfig: AnonyMcpConfig = { ...config, folders: [...config.folders, ...folders] }
  saveConfig(configPath(), nextConfig)
  clearServiceCache()
  return FolderImportResultSchema.parse({
    added: folders.length,
    skipped: candidates.length - folders.length,
    folders
  })
}

function clearServiceCache(): void {
  serviceCache?.service.close()
  serviceCache = null
}

function readAppStatus(): AppStatus {
  const path = absoluteConfigPath()
  try {
    const config = loadConfig(configPath())
    return AppStatusSchema.parse({
      configPresent: true,
      configuredFolders: config.folders.length,
      mcpReady: config.folders.length > 0,
      configPath: path,
      configHash: configHash(path),
      folderIds: config.folders.map((folder) => folder.id)
    })
  } catch (err) {
    return AppStatusSchema.parse({
      configPresent: false,
      configuredFolders: 0,
      mcpReady: false,
      configPath: path,
      folderIds: [],
      configError: err instanceof Error ? err.message : String(err)
    })
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.APP_STATUS, (event) => {
    assertTrustedSender(event)
    return readAppStatus()
  })

  ipcMain.handle(IPC_CHANNELS.FOLDERS_SELECT_IMPORT, async (event, payload: unknown) => {
    assertTrustedSender(event)
    const request = FolderImportRequestSchema.parse(payload)
    const parent = BrowserWindow.fromWebContents(event.sender)
    const options: OpenDialogOptions = {
      properties: ['openDirectory', 'multiSelections']
    }
    const selection = parent
      ? await dialog.showOpenDialog(parent, options)
      : await dialog.showOpenDialog(options)

    if (selection.canceled || selection.filePaths.length === 0) {
      return FolderImportResultSchema.parse({ added: 0, skipped: 0, folders: [] })
    }

    return importPracticePaths(selection.filePaths, request.mode)
  })

  ipcMain.handle(IPC_CHANNELS.FOLDERS_IMPORT_PATHS, (event, payload: unknown) => {
    assertTrustedSender(event)
    const request = FolderImportPathsRequestSchema.parse(payload)
    return importPracticePaths(request.paths, request.mode)
  })

  ipcMain.handle(IPC_CHANNELS.DASHBOARD_GET, (event) => {
    assertTrustedSender(event)
    return DashboardSummarySchema.parse(localReviewService().dashboard())
  })

  ipcMain.handle(IPC_CHANNELS.PRACTICE_SCAN, async (event, payload: unknown) => {
    assertTrustedSender(event)
    const request = ScanPracticeRequestSchema.parse(payload)
    const result = await localReviewService().scanPractice(request.folderId)
    return ScanPracticeResultSchema.parse(result)
  })

  ipcMain.handle(IPC_CHANNELS.REVIEW_LIST, (event, payload: unknown) => {
    assertTrustedSender(event)
    const request = ReviewListRequestSchema.parse(payload ?? {})
    return ReviewDocumentListSchema.parse(localReviewService().listReviewDocuments(request.folderId))
  })

  ipcMain.handle(IPC_CHANNELS.REVIEW_DETAIL, (event, payload: unknown) => {
    assertTrustedSender(event)
    const request = ReviewDocumentRequestSchema.parse(payload)
    return ReviewDocumentDetailSchema.nullable().parse(
      localReviewService().getReviewDocument(request.folderId, request.docId)
    )
  })

  ipcMain.handle(IPC_CHANNELS.REVIEW_ADD_MANUAL_ENTITY, (event, payload: unknown) => {
    assertTrustedSender(event)
    const request = ManualEntityRequestSchema.parse(payload)
    return ReviewEntitySchema.nullable().parse(
      localReviewService().addManualEntity(
        request.folderId,
        request.docId,
        request.originalText,
        request.type
      )
    )
  })

  ipcMain.handle(IPC_CHANNELS.REVIEW_APPLY_SELECTION, (event, payload: unknown) => {
    assertTrustedSender(event)
    const request = ReviewApplySelectionRequestSchema.parse(payload)
    return BooleanResultSchema.parse({
      ok: localReviewService().applyReviewSelection(request.folderId, request.docId, request.entities)
    })
  })

  ipcMain.handle(IPC_CHANNELS.REVIEW_APPROVE, (event, payload: unknown) => {
    assertTrustedSender(event)
    const request = ReviewDocumentRequestSchema.parse(payload)
    return BooleanResultSchema.parse({
      ok: localReviewService().approveDocument(request.folderId, request.docId)
    })
  })

  ipcMain.handle(IPC_CHANNELS.REVIEW_SET_SENSITIVITY, (event, payload: unknown) => {
    assertTrustedSender(event)
    const request = ReviewSetSensitivityRequestSchema.parse(payload)
    return BooleanResultSchema.parse({
      ok: localReviewService().setSensitivityOverride(
        request.folderId,
        request.docId,
        request.decision
      )
    })
  })

  ipcMain.handle(IPC_CHANNELS.WRITES_LIST, (event, payload: unknown) => {
    assertTrustedSender(event)
    const request = PendingWriteListRequestSchema.parse(payload ?? {})
    return PendingWriteListSchema.parse(localReviewService().listPendingWrites(request.folderId))
  })

  ipcMain.handle(IPC_CHANNELS.WRITE_DETAIL, (event, payload: unknown) => {
    assertTrustedSender(event)
    const request = PendingWriteRequestSchema.parse(payload)
    return PendingWriteDetailSchema.nullable().parse(
      localReviewService().getPendingWrite(request.folderId, request.relPath)
    )
  })

  ipcMain.handle(IPC_CHANNELS.WRITE_PROMOTE, (event, payload: unknown) => {
    assertTrustedSender(event)
    const request = PendingWriteRequestSchema.parse(payload)
    return BooleanResultSchema.parse({
      ok: localReviewService().promoteWrite(request.folderId, request.relPath)
    })
  })

  ipcMain.handle(IPC_CHANNELS.SENSITIVE_BLOCKED_LIST, (event) => {
    assertTrustedSender(event)
    return CloudBlockedSensitiveDocumentListSchema.parse(
      localReviewService().listCloudBlockedSensitiveDocuments()
    )
  })
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 900,
    minHeight: 620,
    title: 'AnonyMCP',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  })

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('did-finish-load', () => {
    log.info('Renderer caricato', { url: win.webContents.getURL() })
  })
  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    log.error('Caricamento renderer fallito', { errorCode, errorDescription, validatedURL })
  })
  win.webContents.on('console-message', (_event, ...args: unknown[]) => {
    log.warn('Console renderer', { argCount: args.length })
  })
  win.webContents.on('render-process-gone', (_event, details) => {
    log.error('Renderer process terminato', details)
  })
  win.webContents.on('preload-error', (_event, preloadPath, error) => {
    log.error('Preload Electron fallito', { preloadPath, error: error.message })
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedRendererUrl(url)) {
      event.preventDefault()
      log.warn('Navigazione esterna bloccata', { url })
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(() => {
  installSecurityHeaders()
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  clearServiceCache()
})

app.on('web-contents-created', (_event, contents) => {
  contents.on('will-attach-webview', (event) => {
    event.preventDefault()
    log.warn('Tentativo di webview bloccato')
  })
})
