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
