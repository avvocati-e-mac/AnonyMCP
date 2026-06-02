import { describe, expect, it } from 'vitest'
import { AppStatusSchema, IPC_CHANNELS } from '../src/electron/shared/ipc.js'

describe('Electron IPC contract', () => {
  it('uses nominal channels instead of exposing raw ipcRenderer methods', () => {
    expect(IPC_CHANNELS.APP_STATUS).toBe('app:status')
    expect(Object.values(IPC_CHANNELS)).not.toContain('send')
    expect(Object.values(IPC_CHANNELS)).not.toContain('invoke')
    expect(Object.values(IPC_CHANNELS)).not.toContain('on')
  })

  it('rejects unexpected fields in app status payloads', () => {
    expect(() =>
      AppStatusSchema.parse({
        configPresent: true,
        configuredFolders: 1,
        mcpReady: true,
        realPath: '/Studio/Pratiche/Mario Rossi'
      })
    ).toThrow()
  })
})
