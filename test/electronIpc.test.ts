import { describe, expect, it } from 'vitest'
import {
  AppStatusSchema,
  DashboardSummarySchema,
  FolderImportPathsRequestSchema,
  FolderImportRequestSchema,
  FolderImportResultSchema,
  IPC_CHANNELS,
  ManualEntityRequestSchema,
  PendingWriteDetailSchema,
  PendingWriteListSchema,
  PendingWriteRequestSchema,
  ReviewApplySelectionRequestSchema,
  ReviewDocumentDetailSchema,
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
    const status = AppStatusSchema.parse({
      configPresent: true,
      configuredFolders: 2,
      mcpReady: true,
      configPath: '/Studio/anonymcp.config.json',
      configHash: '91ab42ff0011',
      configSource: 'ANONYMCP_CONFIG',
      serverEnvConfigPath: '/Studio/anonymcp.config.json',
      serverEnvConfigHash: '91ab42ff0011',
      configMatchesServerEnv: true,
      clientConfigStatus: 'uses_env_config',
      folderIds: ['1', '100F']
    })
    expect(status.folderIds).toEqual(['1', '100F'])
    expect(() =>
      AppStatusSchema.parse({
        configPresent: true,
        configuredFolders: 1,
        mcpReady: true,
        configSource: 'appUserData',
        clientConfigStatus: 'not_verifiable',
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

  it('validates folder import payloads', () => {
    expect(FolderImportRequestSchema.parse({ mode: 'clients_root' }).mode).toBe('clients_root')
    expect(() => FolderImportRequestSchema.parse({ mode: 'unknown' })).toThrow()
    expect(FolderImportPathsRequestSchema.parse({ mode: 'manual', paths: ['/Studio/400F'] }).paths).toHaveLength(1)
    expect(() => FolderImportPathsRequestSchema.parse({ mode: 'manual', paths: [] })).toThrow()
    expect(() => FolderImportPathsRequestSchema.parse({ mode: 'manual', paths: ['/Studio/400F'], realName: 'Mario Rossi' })).toThrow()
    expect(
      FolderImportResultSchema.parse({
        added: 1,
        skipped: 0,
        folders: [{ id: '400F', label: '400F', path: '/Studio/400F', matter: 'civile' }]
      }).folders[0]!.id
    ).toBe('400F')
  })

  it('allows review detail only through the explicit local detail schema', () => {
    const detail = ReviewDocumentDetailSchema.parse({
      folderId: '400f',
      label: '400F',
      docId: 'opaque-doc',
      fileName: 'atto.md',
      status: 'review_required',
      sensitive: false,
      sensitiveSuggested: false,
      exposable: false,
      originalText: 'Mario Rossi',
      anonymizedText: 'M. R.',
      residualRisk: 0.1,
      entities: [
        {
          type: 'PERSONA',
          originalText: 'Mario Rossi',
          pseudonym: 'M. R.',
          occurrences: 1,
          source: 'regex'
        }
      ]
    })
    expect(detail.originalText).toBe('Mario Rossi')
    expect(() =>
      ReviewDocumentListSchema.parse([{
        ...detail,
        originalText: 'Mario Rossi',
        anonymizedText: 'M. R.',
        residualRisk: 0.1,
        entities: []
      }])
    ).toThrow()
  })

  it('validates review mutation payloads', () => {
    expect(() =>
      ManualEntityRequestSchema.parse({
        folderId: '400f',
        docId: 'opaque-doc',
        originalText: 'Mario Rossi',
        type: 'SCONOSCIUTO'
      })
    ).toThrow()
    expect(() =>
      ReviewApplySelectionRequestSchema.parse({
        folderId: '400f',
        docId: 'opaque-doc',
        entities: [
          {
            type: 'PERSONA',
            originalText: 'Mario Rossi',
            pseudonym: 'M. R.',
            occurrences: 1,
            source: 'regex',
            mapping: 'leak'
          }
        ]
      })
    ).toThrow()
  })

  it('validates pending write schemas and keeps list payloads light', () => {
    expect(
      PendingWriteListSchema.parse([
        {
          folderId: '400f',
          label: '400F',
          fileName: 'bozza.md',
          relPath: 'Ricerche/bozza.md',
          contentHash: 'sha256:abc',
          stagedAt: '2026-06-02T18:00:00.000Z'
        }
      ])[0]!.fileName
    ).toBe('bozza.md')
    expect(() =>
      PendingWriteListSchema.parse([
        {
          folderId: '400f',
          label: '400F',
          fileName: 'bozza.md',
          relPath: 'Ricerche/bozza.md',
          contentHash: 'sha256:abc',
          stagedAt: '2026-06-02T18:00:00.000Z',
          content: 'Mario Rossi'
        }
      ])
    ).toThrow()
    expect(
      PendingWriteDetailSchema.parse({
        folderId: '400f',
        label: '400F',
        fileName: 'bozza.md',
        relPath: 'Ricerche/bozza.md',
        contentHash: 'sha256:abc',
        stagedAt: '2026-06-02T18:00:00.000Z',
        content: 'Mario Rossi',
        hashMatches: true
      }).hashMatches
    ).toBe(true)
    expect(() => PendingWriteRequestSchema.parse({ folderId: '400f', relPath: '' })).toThrow()
  })
})
