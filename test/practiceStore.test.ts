import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  buildCache,
  saveCache,
  loadCache,
  hashOriginal,
  cachePath
} from '../src/practice/practiceStore.js'
import type { DetectedEntity } from '../src/types.js'
import { encrypt } from '../src/util/crypto.js'

const PASS = 'test-passphrase'
const entities: DetectedEntity[] = [
  { type: 'PERSONA', originalText: 'Mario Rossi', pseudonym: 'M. R.', occurrences: 2, source: 'regex' },
  { type: 'CODICE_FISCALE', originalText: 'RSSMRA80A01H501U', pseudonym: 'CF_001', occurrences: 1, source: 'regex' }
]

let dirs: string[] = []
function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), 'anonymcp-'))
  dirs.push(d)
  return d
}
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true })
  dirs = []
})

describe('practiceStore', () => {
  it('hashOriginal è deterministico e non reversibile (è un hash)', () => {
    const h = hashOriginal('Mario Rossi')
    expect(h).toBe(hashOriginal('mario rossi')) // normalizzato
    expect(h).not.toContain('Mario')
  })

  it('buildCache NON contiene testo reale', () => {
    const cache = buildCache('p1', 'src-hash', entities, true)
    const json = JSON.stringify(cache)
    expect(json).not.toContain('Mario Rossi')
    expect(json).not.toContain('RSSMRA80A01H501U')
    expect(cache.entries).toHaveLength(2)
  })

  it('round-trip: salva cifrato e ricarica', () => {
    const dir = tmp()
    const cache = buildCache('p1', 'src-hash', entities, true)
    saveCache(dir, cache, PASS)
    const loaded = loadCache(dir, PASS, 'src-hash')
    expect(loaded?.practiceId).toBe('p1')
    expect(loaded?.entries).toHaveLength(2)
  })

  it('il file su disco è cifrato (no plaintext)', () => {
    const dir = tmp()
    saveCache(dir, buildCache('p1', 'h', entities, true), PASS)
    const raw = readFileSync(cachePath(dir)).toString('utf8')
    expect(raw).not.toContain('CF_001')
    expect(raw).not.toContain('p1')
  })

  it('invalida la cache se sourceHash cambia', () => {
    const dir = tmp()
    saveCache(dir, buildCache('p1', 'old-hash', entities, true), PASS)
    expect(loadCache(dir, PASS, 'new-hash')).toBeNull()
  })

  it('invalida la cache se engineVersion cambia', () => {
    const dir = tmp()
    const cache = { ...buildCache('p1', 'h', entities, true), engineVersion: 'old-engine@0.0.1' }
    writeFileSync(cachePath(dir), encrypt(JSON.stringify(cache), PASS))
    expect(loadCache(dir, PASS, 'h')).toBeNull()
  })

  it('ritorna null con passphrase errata', () => {
    const dir = tmp()
    saveCache(dir, buildCache('p1', 'h', entities, true), PASS)
    expect(loadCache(dir, 'wrong', 'h')).toBeNull()
  })

  it('ritorna null se la cache non esiste', () => {
    expect(loadCache(tmp(), PASS)).toBeNull()
  })
})
