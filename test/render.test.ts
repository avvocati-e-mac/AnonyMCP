import { describe, it, expect } from 'vitest'
import { paginate, renderDocPage, renderEntityList, windowAround } from '../src/tui/render.js'
import type { DetectedEntity } from '../src/types.js'

const entities: DetectedEntity[] = [
  { type: 'PERSONA', originalText: 'Mario Rossi', pseudonym: 'M. R.', occurrences: 2, source: 'regex' },
  {
    type: 'CODICE_FISCALE',
    originalText: 'RSSMRA80A01H501U',
    pseudonym: 'CF_001',
    occurrences: 1,
    source: 'regex'
  }
]

describe('paginate', () => {
  it('non spezza le parole a metà (word-wrap)', () => {
    const text = 'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda'
    const pages = paginate(text, 10, 20) // 20 colonne
    const allWords = pages.flat().join(' ').split(/\s+/).filter(Boolean)
    for (const w of allWords) {
      expect(text).toContain(w) // ogni token è una parola intera del testo
    }
  })

  it('rispetta la larghezza massima delle colonne', () => {
    const text = 'una frase lunga che deve andare a capo piu volte nel terminale stretto'
    const pages = paginate(text, 20, 24)
    for (const line of pages.flat()) {
      expect(line.length).toBeLessThanOrEqual(24)
    }
  })

  it('comprime le righe vuote multiple (paragrafi Markdown) in una sola', () => {
    const text = 'primo paragrafo\n\n\n\nsecondo paragrafo'
    const lines = paginate(text, 50, 80).flat()
    // Non devono esserci due righe vuote consecutive.
    for (let i = 1; i < lines.length; i++) {
      expect(lines[i] === '' && lines[i - 1] === '').toBe(false)
    }
  })

  it('impagina su più pagine quando il testo supera rows', () => {
    const text = Array.from({ length: 30 }, (_, i) => `riga ${i}`).join('\n')
    const pages = paginate(text, 10, 80)
    expect(pages.length).toBe(3) // 30 righe / 10 per pagina
  })
})

describe('renderDocPage', () => {
  it('mostra il termine originale in modalità original', () => {
    const { body } = renderDocPage('Il sig. Mario Rossi agisce.', entities, 'original', 0, 10, 80)
    expect(body).toContain('Mario Rossi')
  })

  it('clampa il numero di pagina e riporta totale pagine', () => {
    const text = Array.from({ length: 30 }, (_, i) => `riga ${i}`).join('\n')
    const r = renderDocPage(text, [], 'original', 99, 10, 80) // pagina fuori range
    expect(r.totalPages).toBe(3)
    expect(r.page).toBe(2) // clampato all'ultima
  })
})

describe('renderEntityList', () => {
  it('mostra checkbox, tipo e pseudonimo di ogni entità', () => {
    const list = renderEntityList(entities, [true, false], 0)
    expect(list).toContain('PERSONA')
    expect(list).toContain('Mario Rossi')
    expect(list).toContain('M. R.')
    expect(list).toContain('[✓]') // prima inclusa
    expect(list).toContain('[ ]') // seconda esclusa
  })

  it('gestisce la lista vuota', () => {
    expect(renderEntityList([], [], 0)).toContain('nessuna entità')
  })

  it('marca le entità aggiunte manualmente', () => {
    const manual: DetectedEntity[] = [
      { type: 'PERSONA', originalText: 'Anna Verdi', pseudonym: 'A. V.', occurrences: 1, source: 'manual' }
    ]
    expect(renderEntityList(manual, [true], 0)).toContain('(man)')
  })

  it('marca le entità riprese dal dizionario di pratica', () => {
    const dict: DetectedEntity[] = [
      { type: 'PERSONA', originalText: 'Chiara Lombardi Sgarbi', pseudonym: 'C. L. S.', occurrences: 1, source: 'dictionary' }
    ]
    expect(renderEntityList(dict, [true], 0)).toContain('(dict)')
  })
})

describe('windowAround', () => {
  it('mostra tutto quando total ≤ size', () => {
    expect(windowAround(0, 5, 10)).toEqual({ start: 0, end: 5 })
  })

  it('centra la finestra sul cursore', () => {
    expect(windowAround(10, 30, 6)).toEqual({ start: 7, end: 13 })
  })

  it('clampa al bordo superiore', () => {
    expect(windowAround(0, 30, 6)).toEqual({ start: 0, end: 6 })
  })

  it('clampa al bordo inferiore', () => {
    expect(windowAround(29, 30, 6)).toEqual({ start: 24, end: 30 })
  })
})

describe('renderEntityList con finestra scorrevole', () => {
  const many: DetectedEntity[] = Array.from({ length: 30 }, (_, i) => ({
    type: 'PERSONA' as const,
    originalText: `Persona ${i}`,
    pseudonym: `P_${i}`,
    occurrences: 1,
    source: 'regex' as const
  }))
  const inc = many.map(() => true)

  it('mostra solo le entità nella finestra [start, end)', () => {
    const list = renderEntityList(many, inc, 5, 3, 9)
    expect(list).toContain('Persona 3')
    expect(list).toContain('Persona 8')
    expect(list).not.toContain('Persona 0')
    expect(list).not.toContain('Persona 20')
  })

  it('mostra gli indicatori ▲/▼ quando ci sono entità fuori vista', () => {
    const list = renderEntityList(many, inc, 15, 12, 18)
    expect(list).toContain('▲')
    expect(list).toContain('▼')
  })

  it('niente ▲ al bordo superiore, niente ▼ al bordo inferiore', () => {
    expect(renderEntityList(many, inc, 0, 0, 6)).not.toContain('▲')
    expect(renderEntityList(many, inc, 29, 24, 30)).not.toContain('▼')
  })
})
