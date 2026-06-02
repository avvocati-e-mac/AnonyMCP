import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  resolveWriteTarget,
  isWritableExtension,
  prepareWrite,
  STAGING_DIRNAME
} from '../src/practice/writeService.js'
import { SessionManager } from '../src/engine/sessionManager.js'
import { PracticeRegistry } from '../src/practice/practiceRegistry.js'

let dirs: string[] = []
function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), 'anonymcp-write-'))
  dirs.push(d)
  return d
}
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true })
  dirs = []
})

describe('writeService — validazione path/estensione', () => {
  it('accetta un relPath testuale dentro la pratica', () => {
    const dir = tmp()
    const abs = resolveWriteTarget(dir, 'Ricerche/bozza.md')
    expect(abs.startsWith(dir)).toBe(true)
  })

  it('blocca il traversal con ".."', () => {
    const dir = tmp()
    expect(() => resolveWriteTarget(dir, '../fuori.md')).toThrow()
  })

  it('blocca un path assoluto', () => {
    const dir = tmp()
    expect(() => resolveWriteTarget(dir, '/etc/passwd')).toThrow()
  })

  it('blocca segmenti che iniziano con "." (artefatti/staging)', () => {
    const dir = tmp()
    expect(() => resolveWriteTarget(dir, '.anonymcp-staging/x.md')).toThrow()
    expect(() => resolveWriteTarget(dir, '.anonymcp')).toThrow()
  })

  it('riconosce le estensioni scrivibili', () => {
    expect(isWritableExtension('a.md')).toBe(true)
    expect(isWritableExtension('a.txt')).toBe(true)
    expect(isWritableExtension('a.docx')).toBe(false)
    expect(isWritableExtension('a.exe')).toBe(false)
  })

  it('prepareWrite rifiuta le estensioni non testuali', () => {
    const dir = tmp()
    const s = new SessionManager()
    expect(() => prepareWrite(dir, 'Atti/comparsa.docx', 'x', s)).toThrow(/testuali/i)
  })

  it('prepareWrite ri-idrata il contenuto', () => {
    const dir = tmp()
    const s = new SessionManager()
    const p = s.getOrCreatePseudonym('Mario Rossi', 'PERSONA')
    const { rehydrated } = prepareWrite(dir, 'b.md', `Atto per ${p}.`, s)
    expect(rehydrated.text).toBe('Atto per Mario Rossi.')
    expect(rehydrated.substituted).toBe(1)
  })
})

describe('PracticeRegistry — M-Write end-to-end (filesystem)', () => {
  it('staging quando requireManualApproval: file finale assente, pending presente', () => {
    const dir = tmp()
    const reg = new PracticeRegistry([{ id: '400f', label: '400F', path: dir }], true)
    const s = reg.getPractice('400f')!.session
    const p = s.getOrCreatePseudonym('Mario Rossi', 'PERSONA')

    const out = reg.stageWrite('400f', 'Ricerche/bozza.md', `Bozza per ${p}.`)
    expect(out.staged).toBe(true)
    expect(out.rehydratedCount).toBe(1)
    // Il file finale NON esiste ancora.
    expect(existsSync(join(dir, 'Ricerche/bozza.md'))).toBe(false)
    // Esiste in staging con il valore REALE.
    const staged = join(dir, STAGING_DIRNAME, 'Ricerche/bozza.md')
    expect(existsSync(staged)).toBe(true)
    expect(readFileSync(staged, 'utf8')).toContain('Mario Rossi')
    // Pending registrato.
    expect(reg.listPendingWrites('400f').map((w) => w.relPath)).toContain(
      join('Ricerche', 'bozza.md')
    )
  })

  it('promoteWrite sposta dallo staging alla destinazione e svuota il pending', () => {
    const dir = tmp()
    const reg = new PracticeRegistry([{ id: '400f', label: '400F', path: dir }], true)
    reg.stageWrite('400f', 'Ricerche/bozza.md', 'Contenuto.')
    const ok = reg.promoteWrite('400f', 'Ricerche/bozza.md')
    expect(ok).toBe(true)
    expect(existsSync(join(dir, 'Ricerche/bozza.md'))).toBe(true)
    expect(reg.listPendingWrites('400f')).toHaveLength(0)
  })

  it('auto-approve: scrittura diretta senza staging', () => {
    const dir = tmp()
    const reg = new PracticeRegistry([{ id: '400f', label: '400F', path: dir }], false)
    const out = reg.stageWrite('400f', 'note.txt', 'Testo libero.')
    expect(out.staged).toBe(false)
    expect(existsSync(join(dir, 'note.txt'))).toBe(true)
  })

  it('anti-overwrite: rifiuta se il file esiste e overwrite=false', () => {
    const dir = tmp()
    writeFileSync(join(dir, 'esiste.md'), 'vecchio', 'utf8')
    const reg = new PracticeRegistry([{ id: '400f', label: '400F', path: dir }], false)
    expect(() => reg.stageWrite('400f', 'esiste.md', 'nuovo')).toThrow(/esistente/i)
    // con overwrite va
    const out = reg.stageWrite('400f', 'esiste.md', 'nuovo', true)
    expect(out.staged).toBe(false)
    expect(readFileSync(join(dir, 'esiste.md'), 'utf8')).toBe('nuovo')
  })

  it('createFolder crea la sottocartella ed è idempotente', () => {
    const dir = tmp()
    const reg = new PracticeRegistry([{ id: '400f', label: '400F', path: dir }], true)
    reg.createFolder('400f', 'Ricerche')
    expect(existsSync(join(dir, 'Ricerche'))).toBe(true)
    // idempotente
    expect(() => reg.createFolder('400f', 'Ricerche')).not.toThrow()
  })

  it('createFolder blocca il traversal', () => {
    const dir = tmp()
    const reg = new PracticeRegistry([{ id: '400f', label: '400F', path: dir }], true)
    expect(() => reg.createFolder('400f', '../fuori')).toThrow()
  })
})
