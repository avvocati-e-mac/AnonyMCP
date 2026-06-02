import { describe, it, expect } from 'vitest'
import {
  detectEntities,
  applyPseudonyms,
  extractRegexEntities,
  isVetoed,
  countOccurrences
} from '../src/engine/anonymizer.js'

// Nome in contesto legale ("Sig." titolo) così che il layer regex lo rilevi
// anche senza NER (in produzione il NER aumenta il recall sui nomi nudi).
const SAMPLE = `Il Sig. Mario Rossi (CF: RSSMRA80A01H501U), residente in Via Roma 10, 00100,
email mario@example.com, IBAN IT60X0542811101000000123456.
Rossi ha presentato ricorso al R.G. 1234/2026.`

describe('extractRegexEntities', () => {
  it('estrae CF, email, IBAN dal testo', () => {
    const found = extractRegexEntities(SAMPLE).map((e) => e.text)
    expect(found).toContain('RSSMRA80A01H501U')
    expect(found).toContain('mario@example.com')
    expect(found.some((f) => f.startsWith('IT60'))).toBe(true)
  })
})

describe('isVetoed', () => {
  it('veta i ruoli processuali', () => {
    expect(isVetoed('ricorrente')).toBe(true)
    expect(isVetoed('IN DIRITTO')).toBe(true)
  })
  it('non veta un nome reale', () => {
    expect(isVetoed('Mario Rossi')).toBe(false)
  })
})

describe('countOccurrences', () => {
  it('conta case-insensitive', () => {
    expect(countOccurrences('Rossi e ROSSI e rossi', 'rossi')).toBe(3)
  })
})

describe('detectEntities + applyPseudonyms', () => {
  it('pseudonimizza e non lascia trapelare le entità reali', async () => {
    const { entities } = await detectEntities(SAMPLE)
    const out = applyPseudonyms(SAMPLE, entities)

    // Nessuna entità reale deve comparire nell'output.
    expect(out).not.toContain('RSSMRA80A01H501U')
    expect(out).not.toContain('mario@example.com')
    expect(out).not.toContain('IT60X0542811101000000123456')
    expect(out).not.toContain('Mario Rossi')
    // Deve contenere placeholder.
    expect(out).toMatch(/CF_\d{3}/)
  })

  it('co-reference: il cognome isolato riceve lo stesso pseudonimo del nome completo', async () => {
    const { entities } = await detectEntities(SAMPLE)
    const out = applyPseudonyms(SAMPLE, entities)
    // "Rossi" da solo non deve restare in chiaro.
    expect(out).not.toMatch(/\bRossi\b/)
  })

  it('pseudonimizza un nome spezzato da a-capo (word-wrap dei documenti legali)', () => {
    // "Mario Rossi" rilevato come entità, ma nel testo è spezzato su due righe.
    const text = 'Si condanna la Sig.ra Mario\nRossi al pagamento.'
    const entities = [
      { type: 'PERSONA' as const, originalText: 'Mario Rossi', pseudonym: 'M. R.', occurrences: 1, source: 'regex' as const }
    ]
    const out = applyPseudonyms(text, entities)
    expect(out).toContain('M. R.')
    expect(out).not.toContain('Mario')
    expect(out).not.toMatch(/\bRossi\b/)
  })

  it('NER iniettabile: applica veto filter alle entità ner', async () => {
    const ner = () => [
      { type: 'PERSONA' as const, text: 'ricorrente', source: 'ner' as const },
      { type: 'PERSONA' as const, text: 'Anna Verdi', source: 'ner' as const }
    ]
    const { entities } = await detectEntities('Testo con Anna Verdi.', { ner })
    const texts = entities.map((e) => e.originalText)
    expect(texts).toContain('Anna Verdi')
    expect(texts).not.toContain('ricorrente')
  })
})

// Guard anti-falso-merge + co-reference end-to-end (ADR-0005).
describe('co-reference e re-idratazione', () => {
  const ner = (names: string[]) => () =>
    names.map((text) => ({ type: 'PERSONA' as const, text, source: 'ner' as const }))

  it('(a) co-reference: il cognome isolato si ri-idrata al nome completo', async () => {
    const text = 'Il Sig. Mario Rossi agisce. Rossi chiede i danni.'
    const { session } = await detectEntities(text, { ner: ner(['Mario Rossi']) })
    const out = session.rehydrate('La parte M. R. insiste.')
    expect(out.text).toBe('La parte Mario Rossi insiste.')
    expect(out.ambiguous).toEqual([])
  })

  it('(c) falso merge: cognome condiviso da 2 persone NON viene ri-idratato a caso', async () => {
    const text = 'Mario Rossi e Anna Rossi sono parti. Rossi ha eccepito.'
    const { session } = await detectEntities(text, {
      ner: ner(['Mario Rossi', 'Anna Rossi'])
    })
    const pseudoRossi = session.getOrCreatePseudonym('Rossi', 'PERSONA')
    const out = session.rehydrate(`Riferimento a ${pseudoRossi}.`)
    // "Rossi" è ambiguo (2 persone) → niente co-reference → mai un nome a caso.
    expect(out.text).not.toContain('Mario Rossi')
    expect(out.text).not.toContain('Anna Rossi')
  })

  it('(d) il cognome non matcha dentro un altra parola (Rossi ≠ Rossini)', async () => {
    const text = 'Il Sig. Mario Rossi. Il compositore Rossini è altro.'
    const { session } = await detectEntities(text, { ner: ner(['Mario Rossi']) })
    const out = session.rehydrate('Opera di Rossini, non di M. R.')
    expect(out.text).toContain('Rossini')
    expect(out.text).toContain('Mario Rossi')
  })
})
