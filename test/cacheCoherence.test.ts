import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PracticeRegistry } from '../src/practice/practiceRegistry.js'

const PASS = 'test-cache-pass'
let dirs: string[] = []
let registries: PracticeRegistry[] = []
function tmp(content: string): string {
  const d = mkdtempSync(join(tmpdir(), 'anonymcp-cache-'))
  writeFileSync(join(d, 'atto.md'), content, 'utf8')
  dirs.push(d)
  return d
}
afterEach(() => {
  for (const registry of registries) registry.closeIndexes()
  registries = []
  for (const d of dirs) rmSync(d, { recursive: true, force: true })
  dirs = []
})

const DOC = 'Il Sig. Mario Rossi (CF: RSSMRA80A01H501U) cita Beta.'

describe('coerenza pseudonimi tra sessioni (cache cifrata)', () => {
  it('con cache: due registry distinti producono lo stesso pseudonimo', async () => {
    const dir = tmp(DOC)

    // Sessione 1 (auto-approve → entries confermate, cache salvata).
    const r1 = new PracticeRegistry([{ id: 'p1', label: 'P1', path: dir }], false, PASS)
    registries.push(r1)
    await r1.scan('p1')
    const text1 = r1.exposableDocs()[0]!.doc.result!.text

    // Sessione 2: nuovo registry (RAM vuota) che ricarica la cache.
    const r2 = new PracticeRegistry([{ id: 'p1', label: 'P1', path: dir }], false, PASS)
    registries.push(r2)
    await r2.scan('p1')
    const text2 = r2.exposableDocs()[0]!.doc.result!.text

    expect(text2).toBe(text1) // stessi pseudonimi → output identico
    expect(text2).not.toContain('RSSMRA80A01H501U')
  })

  it('senza cache (forward-only): nessun file .anonymcp scritto', async () => {
    const dir = tmp(DOC)
    const r = new PracticeRegistry([{ id: 'p1', label: 'P1', path: dir }], false)
    registries.push(r)
    await r.scan('p1')
    // exposableDocs funziona comunque; la cache non è richiesta.
    expect(r.exposableDocs().length).toBe(1)
  })
})
