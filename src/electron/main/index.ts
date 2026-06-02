import { app, BrowserWindow, ipcMain, session, type IpcMainInvokeEvent } from 'electron'
import { join } from 'node:path'
import { loadConfig } from '../../config.js'
import { log } from '../../util/logger.js'
import { AppStatusSchema, IPC_CHANNELS, type AppStatus } from '../shared/ipc.js'

const isDev = !!process.env.ELECTRON_RENDERER_URL

function csp(): string {
  if (isDev) {
    return [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval'",
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
    return !!devUrl && url.startsWith(devUrl)
  }
  return url.startsWith('file://')
}

function assertTrustedSender(event: IpcMainInvokeEvent): void {
  const senderUrl = event.senderFrame?.url ?? event.sender.getURL()
  if (!isTrustedRendererUrl(senderUrl)) {
    log.warn('IPC bloccato: renderer non autorizzato', { senderUrl })
    throw new Error('Renderer non autorizzato.')
  }
}

function readAppStatus(): AppStatus {
  const configPath = process.env.ANONYMCP_CONFIG ?? 'anonymcp.config.json'
  try {
    const config = loadConfig(configPath)
    return AppStatusSchema.parse({
      configPresent: true,
      configuredFolders: config.folders.length,
      mcpReady: config.folders.length > 0
    })
  } catch (err) {
    return AppStatusSchema.parse({
      configPresent: false,
      configuredFolders: 0,
      mcpReady: false,
      configError: err instanceof Error ? err.message : String(err)
    })
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.APP_STATUS, (event) => {
    assertTrustedSender(event)
    return readAppStatus()
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

app.on('web-contents-created', (_event, contents) => {
  contents.on('will-attach-webview', (event) => {
    event.preventDefault()
    log.warn('Tentativo di webview bloccato')
  })
})
