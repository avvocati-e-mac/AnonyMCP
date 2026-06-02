import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PracticeRegistry } from '../src/practice/practiceRegistry.js'
import { DICTIONARY_FILENAME } from '../src/practice/entityDictionary.js'

let dirs: string[] = []
function tmp(content: string, name = 'atto.md'): string {
  const d = mkdtempSync(join(tmpdir(), 'anonymcp-review-'))
  writeFileSync(join(d, name), content, 'utf8')
  dirs.push(d)
  return d
}
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true })
  dirs = []
})

const DOC = 'Il Sig. Mario Rossi (CF: RSSMRA80A01H501U) cita la societa Beta per risoluzione contratto.'

describe('flusso review_required (requireManualApproval)', () => {
  it('lo scan mette i documenti in review_required e non li espone', async () => {
    const dir = tmp(DOC)
    const r = new PracticeRegistry([{ id: 'p1', label: '400F', path: dir }], true)
    const summary = await r.scan('p1')
    expect(summary.reviewRequired).toBe(1)
    expect(summary.approved).toBe(0)
    expect(r.exposableDocs()).toHaveLength(0) // hard gate: nulla esposto
  })

  it('la ricerca non restituisce nulla finché non si approva (hard gate)', async () => {
    const dir = tmp(DOC)
    const r = new PracticeRegistry([{ id: 'p1', label: '400F', path: dir }], true)
    await r.scan('p1')
    expect(r.search('p1', 'risoluzione')).toHaveLength(0)
  })

  it('dopo approve il documento è esposto e ricercabile via BM25', async () => {
    const dir = tmp(DOC)
    const r = new PracticeRegistry([{ id: 'p1', label: '400F', path: dir }], true)
    await r.scan('p1')
    const docId = r.getPractice('p1')!.docs.keys().next().value as string
    expect(r.approve('p1', docId)).toBe(true)
    expect(r.exposableDocs()).toHaveLength(1)
    const hits = r.search('p1', 'risoluzione contratto')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0]!.docId).toBe(docId)
    // L'estratto è pseudonimizzato: niente CF reale.
    expect(hits[0]!.excerpt).not.toContain('RSSMRA80A01H501U')
    r.closeIndexes()
  })

  it('applyReviewSelection rispetta le entità escluse dalla review umana', async () => {
    const dir = tmp(DOC)
    const r = new PracticeRegistry([{ id: 'p1', label: '400F', path: dir }], true)
    await r.scan('p1')
    const docId = r.getPractice('p1')!.docs.keys().next().value as string
    const doc = r.getPractice('p1')!.docs.get(docId)!
    const confirmed = doc.result!.entities.filter((e) => e.type !== 'CODICE_FISCALE')
    expect(r.applyReviewSelection('p1', docId, confirmed)).toBe(true)
    const text = doc.result!.text
    expect(text).toContain('RSSMRA80A01H501U')
    expect(text).not.toContain('CF_001')
    r.closeIndexes()
  })
})

describe('getReviewQueue (uso locale)', () => {
  it('restituisce le entità rilevate con testo originale per la TUI', async () => {
    const dir = tmp(DOC)
    const r = new PracticeRegistry([{ id: 'p1', label: '400F', path: dir }], true)
    await r.scan('p1')
    const docId = r.getPractice('p1')!.docs.keys().next().value as string
    const queue = r.getReviewQueue('p1', docId)
    expect(queue.length).toBeGreaterThan(0)
    const persona = queue.find((e) => e.type === 'PERSONA')
    expect(persona?.originalText).toContain('Mario Rossi')
    expect(persona?.pseudonym).toBeTruthy()
  })

  it('ritorna array vuoto per docId inesistente', async () => {
    const dir = tmp(DOC)
    const r = new PracticeRegistry([{ id: 'p1', label: '400F', path: dir }], true)
    await r.scan('p1')
    expect(r.getReviewQueue('p1', 'inesistente')).toEqual([])
  })
})

describe('dizionario di pratica', () => {
  it('lo scan salva il dizionario accanto ai documenti', async () => {
    const dir = tmp(DOC)
    const r = new PracticeRegistry([{ id: 'p1', label: '400F', path: dir }], true)
    await r.scan('p1')
    expect(existsSync(join(dir, DICTIONARY_FILENAME))).toBe(true)
  })

  it('precarica il dizionario: stessi pseudonimi tra due registry distinti', async () => {
    const dir = tmp(DOC)
    const r1 = new PracticeRegistry([{ id: 'p1', label: '400F', path: dir }], false)
    await r1.scan('p1')
    const text1 = r1.exposableDocs()[0]!.doc.result!.text
    r1.closeIndexes()

    // Secondo registry SENZA cache cifrata: la coerenza viene dal dizionario in chiaro.
    const r2 = new PracticeRegistry([{ id: 'p1', label: '400F', path: dir }], false)
    await r2.scan('p1')
    const text2 = r2.exposableDocs()[0]!.doc.result!.text
    r2.closeIndexes()

    expect(text2).toBe(text1)
  })

  it('exportDictionary scrive le entità della pratica', async () => {
    const dir = tmp(DOC)
    const r = new PracticeRegistry([{ id: 'p1', label: '400F', path: dir }], true)
    await r.scan('p1')
    const n = r.exportDictionary('p1')
    expect(n).toBeGreaterThan(0)
  })
})
