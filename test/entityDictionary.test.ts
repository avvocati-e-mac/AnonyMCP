import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  buildDictionary,
  saveDictionary,
  loadDictionary,
  dictionaryPath
} from '../src/practice/entityDictionary.js'
import { SessionManager } from '../src/engine/sessionManager.js'
import type { DetectedEntity } from '../src/types.js'

function entity(partial: Partial<DetectedEntity>): DetectedEntity {
  return {
    type: 'PERSONA',
    originalText: 'Mario Rossi',
    pseudonym: 'M. R.',
    occurrences: 1,
    source: 'regex',
    ...partial
  }
}

describe('buildDictionary', () => {
  it('conserva il testo originale in chiaro (formato Anonimator)', () => {
    const dict = buildDictionary('400f', [entity({})])
    expect(dict.entries[0]).toEqual({
      original: 'Mario Rossi',
      pseudonym: 'M. R.',
      type: 'PERSONA'
    })
  })

  it('deduplica per testo normalizzato + tipo', () => {
    const dict = buildDictionary('400f', [
      entity({ originalText: 'Mario Rossi' }),
      entity({ originalText: 'mario rossi' }),
      entity({ originalText: 'MARIO ROSSI' })
    ])
    expect(dict.entries).toHaveLength(1)
  })

  it('tiene distinte entità con stesso testo ma tipo diverso', () => {
    const dict = buildDictionary('400f', [
      entity({ originalText: 'Verdi', type: 'PERSONA', pseudonym: 'V.' }),
      entity({ originalText: 'Verdi', type: 'LUOGO', pseudonym: 'LUOGO_001' })
    ])
    expect(dict.entries).toHaveLength(2)
  })
})

describe('saveDictionary / loadDictionary', () => {
  let dir: string
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'anonymcp-dict-'))
  })
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('round-trip: salva e ricarica identico', () => {
    const dict = buildDictionary('400f', [
      entity({}),
      entity({ originalText: 'BNCMRC75H15A944G', type: 'CODICE_FISCALE', pseudonym: 'CF_001' })
    ])
    saveDictionary(dir, dict)
    const loaded = loadDictionary(dir)
    expect(loaded).not.toBeNull()
    expect(loaded!.entries).toHaveLength(2)
    expect(loaded!.practiceId).toBe('400f')
  })

  it('ritorna null se il file non esiste', () => {
    expect(loadDictionary(dir)).toBeNull()
  })

  it('scarta le entry malformate ma conserva le valide', () => {
    const bad = {
      version: 1,
      practiceId: '400f',
      exportedAt: new Date().toISOString(),
      entries: [
        { original: 'Mario Rossi', pseudonym: 'M. R.', type: 'PERSONA' },
        { pseudonym: 'X', type: 'PERSONA' }, // manca original
        { original: '', pseudonym: 'Y', type: 'PERSONA' } // original vuoto
      ]
    }
    writeFileSync(dictionaryPath(dir), JSON.stringify(bad), 'utf8')
    const loaded = loadDictionary(dir)
    expect(loaded!.entries).toHaveLength(1)
    expect(loaded!.entries[0]!.original).toBe('Mario Rossi')
  })

  it('ritorna null su JSON corrotto', () => {
    writeFileSync(dictionaryPath(dir), '{ non valido', 'utf8')
    expect(loadDictionary(dir)).toBeNull()
  })
})

describe('SessionManager.importFromDictionary', () => {
  it('riusa gli pseudonimi del dizionario senza rigenerarli', () => {
    const s = new SessionManager()
    const dict = buildDictionary('400f', [
      entity({ originalText: 'Mario Rossi', pseudonym: 'M. R.' })
    ])
    const n = s.importFromDictionary(dict)
    expect(n).toBe(1)
    expect(s.getOrCreatePseudonym('Mario Rossi', 'PERSONA')).toBe('M. R.')
  })

  it('allinea il contatore per evitare collisioni di pseudonimi strutturati', () => {
    const s = new SessionManager()
    const dict = buildDictionary('400f', [
      entity({ originalText: 'CF1', type: 'CODICE_FISCALE', pseudonym: 'CF_003' })
    ])
    s.importFromDictionary(dict)
    // Una nuova entità CF deve ottenere CF_004, non CF_001 (già usato fino a 003).
    expect(s.getOrCreatePseudonym('CF2', 'CODICE_FISCALE')).toBe('CF_004')
  })
})
