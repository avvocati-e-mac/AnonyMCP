import { describe, expect, it } from 'vitest'
import {
  AppStatusSchema,
  DashboardSummarySchema,
  IPC_CHANNELS,
  ReviewDocumentListSchema,
  ScanPracticeRequestSchema
} from '../src/electron/shared/ipc.js'

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

  it('rejects unexpected original text in review list payloads', () => {
    expect(() =>
      ReviewDocumentListSchema.parse([
        {
          folderId: '400f',
          label: '400F',
          docId: 'opaque-doc',
          fileName: 'atto.md',
          status: 'review_required',
          sensitive: false,
          sensitiveSuggested: false,
          exposable: false,
          originalText: 'Mario Rossi'
        }
      ])
    ).toThrow()
  })

  it('validates dashboard and scan request shapes', () => {
    expect(
      DashboardSummarySchema.parse({
        practices: [],
        totals: {
          practices: 0,
          approved: 0,
          reviewRequired: 0,
          sensitiveDocs: 0,
          exposed: 0,
          cloudBlockedSensitiveDocs: 0,
          pendingWrites: 0
        }
      }).totals.practices
    ).toBe(0)
    expect(() => ScanPracticeRequestSchema.parse({ folderId: '' })).toThrow()
  })
})
