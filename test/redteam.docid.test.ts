import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sha256, hmac, randomKey } from '../src/util/crypto.js'
import { PracticeRegistry } from '../src/practice/practiceRegistry.js'

describe('docId opacity (HMAC)', () => {
  it('hmac NON è ricavabile senza la chiave (≠ sha256 nudo)', () => {
    const path = '/Users/avvocato/Documenti/causa1/atto.txt'
    const key = randomKey()
    // Un attaccante che conosce il path ma non la chiave non può riprodurre l'id.
    expect(hmac(path, key)).not.toBe(sha256(path))
    // Chiavi diverse → id diversi (no correlazione cross-sessione).
    expect(hmac(path, key)).not.toBe(hmac(path, randomKey()))
  })

  it('stessa chiave + stesso path → stesso id (stabile nella sessione)', () => {
    const key = randomKey()
    expect(hmac('/a/b.txt', key)).toBe(hmac('/a/b.txt', key))
  })

  it("il docId esposto non contiene l'estensione né il nome file", () => {
    const dir = mkdtempSync(join(tmpdir(), 'anonymcp-docid-'))
    try {
      writeFileSync(join(dir, 'cartella_clinica_mario_rossi.txt'), 'Testo.', 'utf8')
      const reg = new PracticeRegistry(
        [{ id: 'p1', label: 'P1', path: dir, matter: 'civile' }],
        false
      )
      return reg.scan('p1').then(() => {
        const docs = reg.exposableDocs()
        expect(docs.length).toBe(1)
        const docId = docs[0]!.doc.docId
        expect(docId).not.toContain('.txt')
        expect(docId.toLowerCase()).not.toContain('mario')
        expect(docId.toLowerCase()).not.toContain('clinica')
      })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
