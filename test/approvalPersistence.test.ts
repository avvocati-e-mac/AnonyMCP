import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PracticeRegistry } from '../src/practice/practiceRegistry.js'
import { APPROVAL_FILENAME } from '../src/practice/approvalStore.js'

let dirs: string[] = []
function tmp(content: string): string {
  const d = mkdtempSync(join(tmpdir(), 'anonymcp-approval-'))
  writeFileSync(join(d, 'atto.md'), content, 'utf8')
  dirs.push(d)
  return d
}
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true })
  dirs = []
})

const DOC = 'Il Sig. Mario Rossi (CF: RSSMRA80A01H501U) chiede la risoluzione del contratto.'

describe('persistenza dello stato di approvazione (TUI ↔ server)', () => {
  it("l'approvazione fatta da un registry è vista da un altro registry (processi separati)", async () => {
    const dir = tmp(DOC)

    // "TUI": scansiona, approva. L'approvazione viene persistita su disco.
    const tui = new PracticeRegistry([{ id: '400f', label: '400F', path: dir }], true)
    await tui.scan('400f')
    const docId = tui.getPractice('400f')!.docs.keys().next().value as string
    tui.approve('400f', docId)
    tui.closeIndexes()
    expect(existsSync(join(dir, APPROVAL_FILENAME))).toBe(true)

    // "Server di Claude Desktop": registry separato (RAM vuota). Dopo lo scan il
    // documento risulta già approvato perché lo legge dal disco.
    const server = new PracticeRegistry([{ id: '400f', label: '400F', path: dir }], true)
    await server.scan('400f')
    expect(server.status('400f').approved).toBe(1)
    expect(server.exposableDocs()).toHaveLength(1)
    server.closeIndexes()
  })

  it('refreshApprovals vede una approvazione fatta DOPO lo scan, senza riavvio', async () => {
    const dir = tmp(DOC)

    // Server già avviato: scan → documento in review.
    const server = new PracticeRegistry([{ id: '400f', label: '400F', path: dir }], true)
    await server.scan('400f')
    expect(server.exposableDocs()).toHaveLength(0)

    // Nel frattempo la TUI (altro processo) approva e persiste.
    const tui = new PracticeRegistry([{ id: '400f', label: '400F', path: dir }], true)
    await tui.scan('400f')
    const docId = tui.getPractice('400f')!.docs.keys().next().value as string
    tui.approve('400f', docId)
    tui.closeIndexes()

    // Il server, senza riavvio, rilegge lo stato e ora espone il documento.
    expect(server.exposableDocs()).toHaveLength(0) // prima del refresh
    const changed = server.refreshApprovals('400f')
    expect(changed).toBe(true)
    expect(server.exposableDocs()).toHaveLength(1)
    server.closeIndexes()
  })

  it("l'approvazione decade se il file sorgente cambia (sourceHash diverso)", async () => {
    const dir = tmp(DOC)

    const tui = new PracticeRegistry([{ id: '400f', label: '400F', path: dir }], true)
    await tui.scan('400f')
    const docId = tui.getPractice('400f')!.docs.keys().next().value as string
    tui.approve('400f', docId)
    tui.closeIndexes()

    // Il file viene modificato dopo l'approvazione.
    writeFileSync(join(dir, 'atto.md'), DOC + '\nNuovo paragrafo con Anna Verdi.', 'utf8')

    // Un nuovo registry: il documento NON è più approvato (hash non combacia).
    const server = new PracticeRegistry([{ id: '400f', label: '400F', path: dir }], true)
    await server.scan('400f')
    expect(server.status('400f').approved).toBe(0)
    expect(server.status('400f').reviewRequired).toBe(1)
    server.closeIndexes()
  })
})
