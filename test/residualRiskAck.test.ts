// ============================================================
// RT-06 (ADR-0008) — conferma esplicita del rischio residuo contestuale.
// Oltre RISK_BLOCK_THRESHOLD l'approvazione richiede `acceptResidualRisk`;
// le approvazioni storiche senza conferma decadono in review (fail-closed).
// ============================================================

import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PracticeRegistry } from '../src/practice/practiceRegistry.js'
import {
  fileSourceHash,
  loadApprovals,
  recordApproval,
  isApproved
} from '../src/practice/approvalStore.js'
import { RISK_BLOCK_THRESHOLD } from '../src/pipeline/riskScorer.js'

let dirs: string[] = []
function tmp(content: string, name = 'atto.md'): string {
  const d = mkdtempSync(join(tmpdir(), 'anonymcp-riskack-'))
  writeFileSync(join(d, name), content, 'utf8')
  dirs.push(d)
  return d
}
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true })
  dirs = []
})

// Identificatori contestuali che restano dopo la pseudonimizzazione:
// R.G. + udienza + sezione + importo → residualRisk 0.6 >= soglia.
const HIGH_RISK_DOC =
  'Si rinvia alla prossima udienza dinanzi alla sezione seconda, R.G. come da fascicolo, ' +
  'con condanna al pagamento di 1.000,00 € oltre interessi.'

const LOW_RISK_DOC =
  'Il Sig. Mario Rossi (CF: RSSMRA80A01H501U) chiede la risoluzione del contratto per inadempimento.'

describe('RT-06: conferma esplicita oltre soglia di rischio residuo', () => {
  it('documento ad alto rischio: approve senza conferma è rifiutato (fail-safe)', async () => {
    const dir = tmp(HIGH_RISK_DOC)
    const reg = new PracticeRegistry([{ id: '400f', label: '400F', path: dir }], true)
    await reg.scan('400f')
    const docId = reg.getPractice('400f')!.docs.keys().next().value as string
    const doc = reg.getPractice('400f')!.docs.get(docId)!

    // Guardia sul fixture: deve davvero superare la soglia.
    expect(doc.result!.residualRisk).toBeGreaterThanOrEqual(RISK_BLOCK_THRESHOLD)
    expect(reg.reviewList('400f')[0]!.requiresRiskAck).toBe(true)

    const outcome = reg.approve('400f', docId)
    expect(outcome).toEqual({ ok: false, reason: 'risk_ack_required' })
    expect(reg.getPractice('400f')!.docs.get(docId)!.status).toBe('review_required')
    expect(reg.exposableDocs()).toHaveLength(0)
    reg.closeIndexes()
  })

  it('con conferma esplicita approva, persiste la conferma e sopravvive al rescan', async () => {
    const dir = tmp(HIGH_RISK_DOC)
    const reg = new PracticeRegistry([{ id: '400f', label: '400F', path: dir }], true)
    await reg.scan('400f')
    const docId = reg.getPractice('400f')!.docs.keys().next().value as string

    expect(reg.approve('400f', docId, { acceptResidualRisk: true })).toEqual({ ok: true })
    expect(reg.exposableDocs()).toHaveLength(1)

    // La conferma è persistita con l'entry di approvazione.
    const approvals = loadApprovals(dir)
    const hash = fileSourceHash(HIGH_RISK_DOC)
    expect(isApproved(approvals, hash, { requireRiskAck: true })).toBe(true)

    // Un nuovo processo (rescan) vede il documento ancora approvato.
    const reg2 = new PracticeRegistry([{ id: '400f', label: '400F', path: dir }], true)
    await reg2.scan('400f')
    expect(reg2.reviewList('400f')[0]!.status).toBe('approved')
    expect(reg2.exposableDocs()).toHaveLength(1)
    reg.closeIndexes()
    reg2.closeIndexes()
  })

  it('approvazione storica senza conferma decade in review al rescan (fail-closed)', async () => {
    const dir = tmp(HIGH_RISK_DOC)
    // Simula un'approvazione registrata prima dell'introduzione di RT-06.
    recordApproval(dir, '400f', fileSourceHash(HIGH_RISK_DOC))

    const reg = new PracticeRegistry([{ id: '400f', label: '400F', path: dir }], true)
    await reg.scan('400f')
    expect(reg.reviewList('400f')[0]!.status).toBe('review_required')
    expect(reg.exposableDocs()).toHaveLength(0)
    reg.closeIndexes()
  })

  it('refreshApprovals non promuove approvazioni senza conferma su documenti ad alto rischio', async () => {
    const dir = tmp(HIGH_RISK_DOC)
    const reg = new PracticeRegistry([{ id: '400f', label: '400F', path: dir }], true)
    await reg.scan('400f')

    // Un altro processo registra un'approvazione SENZA conferma del rischio.
    recordApproval(dir, '400f', fileSourceHash(HIGH_RISK_DOC))
    expect(reg.refreshApprovals('400f')).toBe(false)
    expect(reg.reviewList('400f')[0]!.status).toBe('review_required')

    // Con la conferma registrata, la promozione avviene.
    recordApproval(dir, '400f', fileSourceHash(HIGH_RISK_DOC), { residualRiskAccepted: true })
    expect(reg.refreshApprovals('400f')).toBe(true)
    expect(reg.reviewList('400f')[0]!.status).toBe('approved')
    reg.closeIndexes()
  })

  it('documento a basso rischio: nessuna conferma richiesta', async () => {
    const dir = tmp(LOW_RISK_DOC)
    const reg = new PracticeRegistry([{ id: '400f', label: '400F', path: dir }], true)
    await reg.scan('400f')
    const docId = reg.getPractice('400f')!.docs.keys().next().value as string

    expect(reg.reviewList('400f')[0]!.requiresRiskAck).toBe(false)
    expect(reg.approve('400f', docId)).toEqual({ ok: true })

    // L'entry persistita non porta la conferma (non era richiesta).
    const approvals = loadApprovals(dir)
    expect(isApproved(approvals, fileSourceHash(LOW_RISK_DOC))).toBe(true)
    expect(isApproved(approvals, fileSourceHash(LOW_RISK_DOC), { requireRiskAck: true })).toBe(false)
    reg.closeIndexes()
  })
})
