import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, symlinkSync } from 'node:fs'
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
const itIfSymlink = process.platform === 'win32' ? it.skip : it
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

  it('blocca gli store interni AnonyMCP anche se hanno estensione testuale', () => {
    const dir = tmp()
    for (const relPath of [
      'pratica.entitydict.json',
      'pratica.approvals.json',
      'pratica.writes.json',
      'pratica.sensitivity.json',
      'pratica.searchindex.db'
    ]) {
      expect(() => resolveWriteTarget(dir, relPath)).toThrow(/artefatto|non ammesso/i)
    }
  })

  itIfSymlink('blocca la scrittura attraverso una directory symlink fuori pratica', () => {
    const dir = tmp()
    const outside = tmp()
    symlinkSync(outside, join(dir, 'link-fuori'), 'dir')

    expect(() => resolveWriteTarget(dir, 'link-fuori/bozza.md')).toThrow(/link simbolico/i)
    expect(existsSync(join(outside, 'bozza.md'))).toBe(false)
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

  it('pending write resta visibile a una nuova istanza dopo riavvio logico', () => {
    const dir = tmp()
    const reg1 = new PracticeRegistry([{ id: '400f', label: '400F', path: dir }], true)
    reg1.stageWrite('400f', 'Ricerche/bozza.md', 'Contenuto.')

    const reg2 = new PracticeRegistry([{ id: '400f', label: '400F', path: dir }], true)
    expect(reg2.listPendingWrites('400f')).toHaveLength(1)
    const preview = reg2.pendingWritePreview('400f', 'Ricerche/bozza.md')
    expect(preview?.content).toBe('Contenuto.')
    expect(preview?.hashMatches).toBe(true)
    expect(reg2.promoteWrite('400f', 'Ricerche/bozza.md')).toBe(true)
    expect(existsSync(join(dir, 'Ricerche/bozza.md'))).toBe(true)
  })

  it('rifiuta una seconda scrittura sullo stesso relPath se esiste un pending', () => {
    const dir = tmp()
    const reg = new PracticeRegistry([{ id: '400f', label: '400F', path: dir }], true)
    reg.stageWrite('400f', 'Ricerche/bozza.md', 'Prima versione.')
    expect(() => reg.stageWrite('400f', 'Ricerche/bozza.md', 'Seconda versione.')).toThrow(
      /attesa di conferma/i
    )
    const staged = join(dir, STAGING_DIRNAME, 'Ricerche/bozza.md')
    expect(readFileSync(staged, 'utf8')).toBe('Prima versione.')
  })

  it('con overwrite sostituisce lo staging e aggiorna il pending', () => {
    const dir = tmp()
    const reg = new PracticeRegistry([{ id: '400f', label: '400F', path: dir }], true)
    reg.stageWrite('400f', 'Ricerche/bozza.md', 'Prima versione.')
    reg.stageWrite('400f', 'Ricerche/bozza.md', 'Seconda versione.', true)
    const staged = join(dir, STAGING_DIRNAME, 'Ricerche/bozza.md')
    expect(readFileSync(staged, 'utf8')).toBe('Seconda versione.')
    expect(reg.listPendingWrites('400f')).toHaveLength(1)
    expect(reg.listPendingWrites('400f')[0]!.overwrite).toBe(true)
  })

  it('promoteWrite blocca lo staging modificato dopo la registrazione', () => {
    const dir = tmp()
    const reg = new PracticeRegistry([{ id: '400f', label: '400F', path: dir }], true)
    reg.stageWrite('400f', 'Ricerche/bozza.md', 'Contenuto originale.')
    const staged = join(dir, STAGING_DIRNAME, 'Ricerche/bozza.md')
    writeFileSync(staged, 'Contenuto alterato.', 'utf8')
    expect(() => reg.promoteWrite('400f', 'Ricerche/bozza.md')).toThrow(/Staging modificato/i)
    expect(existsSync(join(dir, 'Ricerche/bozza.md'))).toBe(false)
    expect(reg.listPendingWrites('400f')).toHaveLength(1)
  })

  it('promoteWrite non sovrascrive un file finale creato dopo lo staging senza overwrite', () => {
    const dir = tmp()
    const reg = new PracticeRegistry([{ id: '400f', label: '400F', path: dir }], true)
    reg.stageWrite('400f', 'Ricerche/bozza.md', 'Contenuto.')
    reg.createFolder('400f', 'Ricerche')
    writeFileSync(join(dir, 'Ricerche/bozza.md'), 'Creato nel frattempo.', 'utf8')
    expect(() => reg.promoteWrite('400f', 'Ricerche/bozza.md')).toThrow(/File già esistente/i)
    expect(readFileSync(join(dir, 'Ricerche/bozza.md'), 'utf8')).toBe('Creato nel frattempo.')
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
