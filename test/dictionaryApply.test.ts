import { describe, it, expect } from 'vitest'
import { processText } from '../src/pipeline/documentService.js'
import { SessionManager } from '../src/engine/sessionManager.js'
import {
  enrichFromKnownTerms,
  buildKnownTermRegex,
  applyPseudonyms
} from '../src/engine/anonymizer.js'
import type { DetectedEntity } from '../src/types.js'

// Bug risolto: una parte NOTA al dizionario di pratica deve essere pseudonimizzata
// in OGNI documento, anche dove il NER/regex non la rileva (altrimenti = leak verso
// l'LLM). Cfr. la schermata utente con "Chiara Lombardi Sgarbi" in chiaro.

describe('applicazione dei termini noti del dizionario (anti-leak cross-documento)', () => {
  it("sostituisce una persona nota anche se il NER non la rileva nel documento", async () => {
    const session = new SessionManager()
    // La parte è nota alla pratica (es. rilevata/aggiunta in un altro documento).
    session.preload('Chiara Lombardi Sgarbi', 'C. L. S.', 'PERSONA')

    // Documento dove compare senza contesto che il regex cattura.
    const text = 'Intestataria: Chiara Lombardi Sgarbi. Totale euro 7.500,00.'
    const result = await processText(text, { session })

    expect(result.text).not.toContain('Chiara Lombardi Sgarbi') // niente PII reale
    expect(result.text).toContain('C. L. S.')
    const e = result.entities.find((x) => x.originalText.toLowerCase() === 'chiara lombardi sgarbi')
    expect(e?.source).toBe('dictionary')
  })

  it('sostituisce un CF noto ovunque compaia (match esatto)', async () => {
    const session = new SessionManager()
    session.preload('LMNKRM85B04Z330U', 'CF_001', 'CODICE_FISCALE')
    const text = 'Riferimento codice LMNKRM85B04Z330U per la pratica.'
    const result = await processText(text, { session })
    expect(result.text).not.toContain('LMNKRM85B04Z330U')
    expect(result.text).toContain('CF_001')
  })

  it('NON sostituisce dentro un’altra parola (confini di parola per le persone)', () => {
    const session = new SessionManager()
    session.preload('Anna', 'A. X.', 'PERSONA')
    session.preload('Rossi', 'R. Y.', 'PERSONA')
    const text = 'Annabella incontra Rossini al teatro.'
    const enriched = enrichFromKnownTerms(text, [], session)
    // Nessun match: "Anna" in "Annabella", "Rossi" in "Rossini" non contano.
    expect(enriched).toHaveLength(0)
  })

  it('NON aggiunge entità per termini noti assenti dal testo', () => {
    const session = new SessionManager()
    session.preload('Mario Bianchi', 'M. B.', 'PERSONA')
    const enriched = enrichFromKnownTerms('Testo senza la parte.', [], session)
    expect(enriched).toHaveLength(0)
  })

  it('non duplica un termine già fra le entità rilevate', () => {
    const session = new SessionManager()
    session.preload('Mario Bianchi', 'M. B.', 'PERSONA')
    const detected: DetectedEntity[] = [
      { type: 'PERSONA', originalText: 'Mario Bianchi', pseudonym: 'M. B.', occurrences: 1, source: 'regex' }
    ]
    const enriched = enrichFromKnownTerms('Mario Bianchi agisce.', detected, session)
    expect(enriched).toHaveLength(1) // nessun duplicato
  })

  it('matcha una persona nota spezzata su due righe (a-capo)', () => {
    const session = new SessionManager()
    session.preload('Sofia Lombardi Sgarbi', 'S. L. S.', 'PERSONA')
    const text = 'Paziente minore: Sofia Lombardi\nSgarbi, nata il 2 giugno 2017.'
    const enriched = enrichFromKnownTerms(text, [], session)
    expect(enriched).toHaveLength(1)
    expect(applyPseudonyms(text, enriched)).not.toContain('Sofia Lombardi')
  })
})

describe('scan ri-applica le entità note a TUTTI i documenti (bug ordine alfabetico)', () => {
  it('una parte rilevata in un doc tardivo viene sostituita anche nei doc già processati', async () => {
    const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const { PracticeRegistry } = await import('../src/practice/practiceRegistry.js')

    const dir = mkdtempSync(join(tmpdir(), 'anonymcp-order-'))
    try {
      // "a_preventivo.md" (alfabeticamente prima) cita la parte senza contesto NER;
      // "b_relazione.md" la introduce con contesto forte ("Sig.ra ... nata a ...").
      writeFileSync(join(dir, 'a_preventivo.md'), 'Intestataria: Chiara Lombardi Sgarbi. Totale 100.', 'utf8')
      writeFileSync(
        join(dir, 'b_relazione.md'),
        'La Sig.ra Chiara Lombardi Sgarbi, nata a Bologna il 9 novembre 1990, chiede il risarcimento.',
        'utf8'
      )
      const reg = new PracticeRegistry([{ id: 'x', label: 'X', path: dir }], false)
      await reg.scan('x')
      for (const doc of reg.getPractice('x')!.docs.values()) {
        expect(doc.result!.text).not.toContain('Chiara Lombardi Sgarbi')
      }
      reg.closeIndexes()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('buildKnownTermRegex', () => {
  it('con word-boundary non matcha sottostringhe', () => {
    expect(buildKnownTermRegex('Rossi', true).test('Rossini')).toBe(false)
    expect(buildKnownTermRegex('Rossi', true).test('Mario Rossi qui')).toBe(true)
  })

  it('senza word-boundary fa match diretto (CF/IBAN)', () => {
    expect(buildKnownTermRegex('IT60X0542', false).test('IBAN IT60X0542...')).toBe(true)
  })
})
