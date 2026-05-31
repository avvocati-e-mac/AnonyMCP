import { describe, it, expect } from 'vitest'
import { resolveOverlaps, type RawEntity } from '../src/engine/anonymizer.js'

describe('resolveOverlaps', () => {
  it('scarta lo span contenuto (longest-match)', () => {
    // "12345678901" (PIVA, 11 cifre) è contenuto in un IBAN più lungo allo stesso offset.
    const ents: RawEntity[] = [
      { type: 'IBAN', text: 'IT60X054281110100012345678901', source: 'regex', start: 10 },
      { type: 'PARTITA_IVA', text: '12345678901', source: 'regex', start: 28 }
    ]
    const out = resolveOverlaps(ents)
    expect(out.map((e) => e.type)).toEqual(['IBAN'])
  })

  it('a parità di span vince la priorità di tipo (CF batte PARTITA_IVA)', () => {
    const ents: RawEntity[] = [
      { type: 'PARTITA_IVA', text: 'RSSMRA80A01H501U', source: 'regex', start: 5 },
      { type: 'CODICE_FISCALE', text: 'RSSMRA80A01H501U', source: 'regex', start: 5 }
    ]
    const out = resolveOverlaps(ents)
    expect(out.map((e) => e.type)).toEqual(['CODICE_FISCALE'])
  })

  it('non tocca entità senza offset (NER/coref)', () => {
    const ents: RawEntity[] = [
      { type: 'PERSONA', text: 'Mario Rossi', source: 'ner' },
      { type: 'PERSONA', text: 'Rossi', source: 'coref' }
    ]
    expect(resolveOverlaps(ents)).toHaveLength(2)
  })

  it('mantiene entità non sovrapposte', () => {
    const ents: RawEntity[] = [
      { type: 'EMAIL', text: 'a@b.it', source: 'regex', start: 0 },
      { type: 'IBAN', text: 'IT60X0542811101000000123456', source: 'regex', start: 20 }
    ]
    expect(resolveOverlaps(ents)).toHaveLength(2)
  })
})
