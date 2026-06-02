import { describe, it, expect } from 'vitest'
import { colorForType, ENTITY_COLORS } from '../src/tui/entityColors.js'
import { highlightEntities } from '../src/tui/highlight.js'
import type { DetectedEntity } from '../src/types.js'

function ent(partial: Partial<DetectedEntity>): DetectedEntity {
  return {
    type: 'PERSONA',
    originalText: 'Mario Rossi',
    pseudonym: 'M. R.',
    occurrences: 1,
    source: 'regex',
    ...partial
  }
}

describe('entityColors', () => {
  it('assegna un colore distinto a persona e codice fiscale', () => {
    expect(colorForType('PERSONA')).not.toBe(colorForType('CODICE_FISCALE'))
  })

  it('copre tutti i tipi entità noti', () => {
    // Ogni chiave di ENTITY_COLORS ha un colore non vuoto.
    for (const color of Object.values(ENTITY_COLORS)) {
      expect(color.length).toBeGreaterThan(0)
    }
  })
})

describe('highlightEntities (modalità original)', () => {
  it('evidenzia il testo originale dell entità', () => {
    const segs = highlightEntities('Il sig. Mario Rossi paga.', [ent({})], 'original')
    expect(segs).toEqual([
      { text: 'Il sig. ', type: null },
      { text: 'Mario Rossi', type: 'PERSONA' },
      { text: ' paga.', type: null }
    ])
  })

  it('è case-insensitive', () => {
    const segs = highlightEntities('MARIO ROSSI', [ent({})], 'original')
    expect(segs).toEqual([{ text: 'MARIO ROSSI', type: 'PERSONA' }])
  })

  it('dà priorità alle entità più lunghe', () => {
    const entities = [
      ent({ originalText: 'Rossi', type: 'PERSONA', pseudonym: 'R.' }),
      ent({ originalText: 'Mario Rossi', type: 'PERSONA', pseudonym: 'M. R.' })
    ]
    const segs = highlightEntities('Mario Rossi', entities, 'original')
    // Deve evidenziare "Mario Rossi" intero, non spezzare su "Rossi".
    expect(segs).toEqual([{ text: 'Mario Rossi', type: 'PERSONA' }])
  })
})

describe('highlightEntities (modalità pseudonym)', () => {
  it('evidenzia lo pseudonimo nel testo anonimizzato', () => {
    const segs = highlightEntities('Il sig. M. R. paga.', [ent({})], 'pseudonym')
    expect(segs).toEqual([
      { text: 'Il sig. ', type: null },
      { text: 'M. R.', type: 'PERSONA' },
      { text: ' paga.', type: null }
    ])
  })
})

describe('highlightEntities (casi limite)', () => {
  it('senza entità ritorna il testo intero come segmento normale', () => {
    expect(highlightEntities('testo', [], 'original')).toEqual([{ text: 'testo', type: null }])
  })

  it('ignora entità con termine vuoto', () => {
    const segs = highlightEntities('ciao', [ent({ originalText: '' })], 'original')
    expect(segs).toEqual([{ text: 'ciao', type: null }])
  })
})
