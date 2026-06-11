import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PracticeRegistry } from '../src/practice/practiceRegistry.js'
import { LocalReviewService } from '../src/app/reviewService.js'
import type { AnonyMcpConfig } from '../src/types.js'
import { sensitivityPath } from '../src/practice/sensitivityStore.js'

let dirs: string[] = []

function tmp(content: string, fileName = 'atto.md'): string {
  const d = mkdtempSync(join(tmpdir(), 'anonymcp-sensitivity-'))
  writeFileSync(join(d, fileName), content, 'utf8')
  dirs.push(d)
  return d
}

afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true })
  dirs = []
})

const SENSITIVE_DOC =
  "L'imputato Mario Rossi e' indagato per reato informatico nel procedimento civile collegato."
const ORDINARY_DOC =
  'Il Sig. Mario Rossi (CF: RSSMRA80A01H501U) chiede la risoluzione del contratto per inadempimento.'

describe('override sensibilita documenti', () => {
  it("l'avvocato puo' sbloccare come non sensibile un documento suggerito sensibile", async () => {
    const dir = tmp(SENSITIVE_DOC, 'penale.md')
    const reg = new PracticeRegistry([{ id: '400f', label: '400F', path: dir }], true)
    await reg.scan('400f')
    const docId = reg.getPractice('400f')!.docs.keys().next().value as string

    expect(reg.reviewList('400f')[0]!.sensitive).toBe(true)
    expect(reg.reviewList('400f')[0]!.sensitiveSuggested).toBe(true)
    expect(reg.approve('400f', docId).ok).toBe(true)
    expect(reg.exposableDocs()).toHaveLength(0)

    expect(reg.setSensitivityOverride('400f', docId, 'not_sensitive')).toBe(true)
    const [doc] = reg.reviewList('400f')
    expect(doc!.sensitive).toBe(false)
    expect(doc!.sensitiveSuggested).toBe(true)
    expect(doc!.sensitivityOverride).toBe('not_sensitive')
    expect(doc!.exposable).toBe(true)
    expect(reg.exposableDocs()).toHaveLength(1)
    expect(reg.search('400f', 'reato')).toHaveLength(1)
    reg.closeIndexes()
  })

  it('la decisione di sensibilita persiste tra processi tramite hash del documento', async () => {
    const dir = tmp(SENSITIVE_DOC, 'penale.md')
    const reg1 = new PracticeRegistry([{ id: '400f', label: '400F', path: dir }], true)
    await reg1.scan('400f')
    const docId1 = reg1.getPractice('400f')!.docs.keys().next().value as string
    reg1.approve('400f', docId1)
    reg1.setSensitivityOverride('400f', docId1, 'not_sensitive')
    reg1.closeIndexes()

    const reg2 = new PracticeRegistry([{ id: '400f', label: '400F', path: dir }], true)
    await reg2.scan('400f')
    const [doc] = reg2.reviewList('400f')
    expect(doc!.sensitivityOverride).toBe('not_sensitive')
    expect(doc!.sensitiveSuggested).toBe(true)
    expect(doc!.sensitive).toBe(false)
    expect(doc!.status).toBe('approved')
    expect(reg2.exposableDocs()).toHaveLength(1)
    reg2.closeIndexes()
  })

  it('decisioni sensibilita corrotte: fail-closed su documento suggerito sensibile', async () => {
    const dir = tmp(SENSITIVE_DOC, 'penale.md')
    writeFileSync(sensitivityPath(dir), '{ json non valido', 'utf8')

    const reg = new PracticeRegistry([{ id: '400f', label: '400F', path: dir }], true)
    await reg.scan('400f')
    const docId = reg.getPractice('400f')!.docs.keys().next().value as string
    reg.approve('400f', docId)

    expect(reg.reviewList('400f')[0]!.sensitiveSuggested).toBe(true)
    expect(reg.reviewList('400f')[0]!.sensitive).toBe(true)
    expect(reg.exposableDocs()).toHaveLength(0)
    expect(reg.search('400f', 'reato')).toHaveLength(0)
    reg.closeIndexes()
  })

  it("l'avvocato puo' marcare sensibile un documento non suggerito e rimuoverlo dall'indice", async () => {
    const dir = tmp(ORDINARY_DOC)
    const reg = new PracticeRegistry([{ id: '400f', label: '400F', path: dir }], true)
    await reg.scan('400f')
    const docId = reg.getPractice('400f')!.docs.keys().next().value as string
    reg.approve('400f', docId)

    expect(reg.exposableDocs()).toHaveLength(1)
    expect(reg.search('400f', 'risoluzione')).toHaveLength(1)

    expect(reg.setSensitivityOverride('400f', docId, 'sensitive')).toBe(true)
    expect(reg.exposableDocs()).toHaveLength(0)
    expect(reg.search('400f', 'risoluzione')).toHaveLength(0)
    expect(reg.listCloudBlockedSensitiveDocs()).toEqual([
      expect.objectContaining({
        folderId: '400f',
        fileName: 'atto.md',
        sensitiveSuggested: false,
        sensitivityOverride: 'sensitive'
      })
    ])

    expect(reg.setSensitivityOverride('400f', docId, null)).toBe(true)
    expect(reg.exposableDocs()).toHaveLength(1)
    expect(reg.reviewList('400f')[0]!.sensitivityOverride).toBeUndefined()
    reg.closeIndexes()
  })
})

describe('LocalReviewService', () => {
  it('aggrega dashboard e dettagli review per la UI locale', async () => {
    const dir = tmp(ORDINARY_DOC)
    const config: AnonyMcpConfig = {
      version: 1,
      folders: [{ id: '400f', label: '400F', path: dir, matter: 'civile' }],
      requireManualApproval: true,
      allowCloudForSensitive: false,
      logLevel: 'info'
    }
    const service = LocalReviewService.fromConfig(config)
    await service.scanPractice('400f')

    const dashboard = service.dashboard()
    expect(dashboard.totals.practices).toBe(1)
    expect(dashboard.totals.reviewRequired).toBe(1)
    expect(dashboard.totals.pendingWrites).toBe(0)

    const [item] = service.listReviewDocuments()
    expect(item!.label).toBe('400F')
    const detail = service.getReviewDocument('400f', item!.docId)
    expect(detail!.originalText).toContain('Mario Rossi')
    expect(detail!.anonymizedText).not.toContain('RSSMRA80A01H501U')
    expect(detail!.entities.length).toBeGreaterThan(0)
    service.close()
  })
})
