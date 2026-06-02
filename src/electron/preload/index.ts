import { contextBridge, ipcRenderer } from 'electron'
import {
  AppStatusSchema,
  IPC_CHANNELS,
  type AnonymcpElectronApi,
  type AppStatus
} from '../shared/ipc.js'

const api: AnonymcpElectronApi = Object.freeze({
  async getAppStatus(): Promise<AppStatus> {
    const result: unknown = await ipcRenderer.invoke(IPC_CHANNELS.APP_STATUS)
    return AppStatusSchema.parse(result)
  }
})

contextBridge.exposeInMainWorld('anonymcp', api)
