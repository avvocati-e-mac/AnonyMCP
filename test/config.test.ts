import { describe, it, expect, afterEach } from 'vitest'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { folderIdLooksIdentifying, labelLooksLikePersonName, loadConfig } from '../src/config.js'

describe('labelLooksLikePersonName (ADR-0004)', () => {
  it('riconosce "X c. Y" come probabile nome di causa', () => {
    expect(labelLooksLikePersonName('Rossi c. Bianchi')).toBe(true)
    expect(labelLooksLikePersonName('Verdi contro Comune')).toBe(true)
  })

  it('riconosce due o più parole capitalizzate consecutive', () => {
    expect(labelLooksLikePersonName('Mario Rossi')).toBe(true)
    expect(labelLooksLikePersonName('Studio Legale Verdi')).toBe(true)
  })

  it('accetta i numeri di pratica opachi (nessun warning)', () => {
    expect(labelLooksLikePersonName('400F')).toBe(false)
    expect(labelLooksLikePersonName('2026-CV-001')).toBe(false)
    expect(labelLooksLikePersonName('Pratica 42')).toBe(false)
  })

  it('non si attiva su una singola parola capitalizzata', () => {
    expect(labelLooksLikePersonName('Civile')).toBe(false)
  })
})

describe('folderIdLooksIdentifying (ADR-0004)', () => {
  it('riconosce id pratica con nomi delle parti', () => {
    expect(folderIdLooksIdentifying('rossi-c-bianchi')).toBe(true)
    expect(folderIdLooksIdentifying('causa-mario-rossi')).toBe(true)
  })

  it('accetta id opachi o generici di test', () => {
    expect(folderIdLooksIdentifying('400F')).toBe(false)
    expect(folderIdLooksIdentifying('2026-CV-001')).toBe(false)
    expect(folderIdLooksIdentifying('causa-test')).toBe(false)
    expect(folderIdLooksIdentifying('p1')).toBe(false)
  })
})

describe('loadConfig allowlist canonica (RT-01)', () => {
  let dirs: string[] = []
  afterEach(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true })
    dirs = []
  })

  function tmp(): string {
    const d = mkdtempSync(join(tmpdir(), 'anonymcp-config-'))
    dirs.push(d)
    return d
  }

  function writeConfig(dir: string, folderPath: string): string {
    const configPath = join(dir, 'anonymcp.config.json')
    writeFileSync(
      configPath,
      JSON.stringify({ version: 1, folders: [{ id: '400F', label: '400F', path: folderPath }] }),
      'utf8'
    )
    return configPath
  }

  it('risolve un percorso pratica symlink al percorso reale', () => {
    const root = tmp()
    const real = join(root, 'reale')
    const link = join(root, 'alias')
    mkdirSync(real)
    symlinkSync(real, link)

    const config = loadConfig(writeConfig(root, link))
    expect(config.folders[0]!.path).toBe(realpathSync(real))
  })

  it('mantiene il percorso assoluto se la cartella non esiste ancora', () => {
    const root = tmp()
    const missing = join(root, 'non-esiste')
    const config = loadConfig(writeConfig(root, missing))
    expect(config.folders[0]!.path).toBe(missing)
  })
})
