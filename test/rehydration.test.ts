import { describe, it, expect } from 'vitest'
import { SessionManager } from '../src/engine/sessionManager.js'

// Re-idratazione (pseudonimo→reale): passaggio LOCALE lato server, mai esposto via MCP.
// Vedi ADR-0005. Questi test verificano correttezza e fail-safe sull'ambiguità.

describe('SessionManager.rehydrate', () => {
  it('sostituisce pseudonimo strutturato (CF) con il valore reale', () => {
    const s = new SessionManager()
    const cf = s.getOrCreatePseudonym('RSSMRA80A01H501U', 'CODICE_FISCALE') // → CF_001
    const out = s.rehydrate(`Il codice fiscale è ${cf}.`)
    expect(out.text).toBe('Il codice fiscale è RSSMRA80A01H501U.')
    expect(out.substituted).toBe(1)
    expect(out.ambiguous).toEqual([])
  })

  it('ripristina il case originale per le iniziali (M. R. → Mario Rossi)', () => {
    const s = new SessionManager()
    const p = s.getOrCreatePseudonym('Mario Rossi', 'PERSONA') // → "M. R."
    expect(p).toBe('M. R.')
    const out = s.rehydrate(`Cita ${p} come teste.`)
    expect(out.text).toBe('Cita Mario Rossi come teste.')
    expect(out.substituted).toBe(1)
  })

  it('NON sostituisce uno pseudonimo dentro un altra parola (word-boundary)', () => {
    const s = new SessionManager()
    s.getOrCreatePseudonym('Acme S.r.l.', 'ORGANIZZAZIONE') // strutturato/iniziali
    // Forza un pseudonimo semplice per il test del boundary:
    const sm = new SessionManager()
    sm.preload('Mario Rossi', 'MR', 'PERSONA')
    const out = sm.rehydrate('EMRMR e MR sono diversi.') // solo "MR" isolato va sostituito
    expect(out.text).toBe('EMRMR e Mario Rossi sono diversi.')
    expect(out.substituted).toBe(1)
  })

  it('risolve "M. R. (2)" prima di "M. R." (ordine per lunghezza)', () => {
    const s = new SessionManager()
    const p1 = s.getOrCreatePseudonym('Mario Rossi', 'PERSONA') // "M. R."
    const p2 = s.getOrCreatePseudonym('Marco Russo', 'PERSONA') // "M. R. (2)"
    expect(p1).toBe('M. R.')
    expect(p2).toBe('M. R. (2)')
    const out = s.rehydrate(`${p2} contro ${p1}.`)
    expect(out.text).toBe('Marco Russo contro Mario Rossi.')
    expect(out.substituted).toBe(2)
  })

  it('NON sostituisce pseudonimi ambigui (>1 originale) e li segnala', () => {
    const s = new SessionManager()
    // Due originali distinti mappati ALLO STESSO pseudonimo (via preload incoerente).
    s.preload('Mario Rossi', 'X. Y.', 'PERSONA')
    s.preload('Marco Russo', 'X. Y.', 'PERSONA')
    const out = s.rehydrate('Il teste X. Y. era presente.')
    expect(out.text).toBe('Il teste X. Y. era presente.') // invariato: fail-safe
    expect(out.substituted).toBe(0)
    expect(out.ambiguous).toContain('X. Y.')
  })

  it('non riporta come ambiguo uno pseudonimo non presente nel testo', () => {
    const s = new SessionManager()
    s.preload('Mario Rossi', 'X. Y.', 'PERSONA')
    s.preload('Marco Russo', 'X. Y.', 'PERSONA')
    const out = s.rehydrate('Nessuno pseudonimo qui.')
    expect(out.ambiguous).toEqual([])
    expect(out.substituted).toBe(0)
  })

  it('testo senza pseudonimi resta invariato', () => {
    const s = new SessionManager()
    s.getOrCreatePseudonym('Mario Rossi', 'PERSONA')
    const out = s.rehydrate('Testo generico senza placeholder.')
    expect(out.text).toBe('Testo generico senza placeholder.')
    expect(out.substituted).toBe(0)
  })

  it('linkCoreference: il cognome eredita pseudonimo del nome completo', () => {
    const s = new SessionManager()
    const p = s.linkCoreference('Rossi', 'Mario Rossi', 'PERSONA')
    expect(p).toBe('M. R.')
    // Entrambe le occorrenze risolvono allo stesso pseudonimo.
    expect(s.getOrCreatePseudonym('Rossi', 'PERSONA')).toBe('M. R.')
    expect(s.getOrCreatePseudonym('Mario Rossi', 'PERSONA')).toBe('M. R.')
  })

  // (a) co-reference: stessa entità → collassa, ri-idrata alla forma canonica.
  it('(a) co-reference: "M. R." ri-idratato al nome completo anche se viene da "Rossi"', () => {
    const s = new SessionManager()
    s.getOrCreatePseudonym('Mario Rossi', 'PERSONA')
    s.linkCoreference('Rossi', 'Mario Rossi', 'PERSONA')
    const out = s.rehydrate('La parte M. R. eccepisce.')
    expect(out.text).toBe('La parte Mario Rossi eccepisce.')
    expect(out.substituted).toBe(1)
    expect(out.ambiguous).toEqual([])
  })

  // (b) omonimia vera: entità diverse, stesse iniziali → pseudonimi distinti, entrambi risolti.
  it('(b) omonimia: "M. R." e "M. R. (2)" ri-idratati ai nomi giusti', () => {
    const s = new SessionManager()
    expect(s.getOrCreatePseudonym('Mario Rossi', 'PERSONA')).toBe('M. R.')
    expect(s.getOrCreatePseudonym('Marco Russo', 'PERSONA')).toBe('M. R. (2)')
    const out = s.rehydrate('M. R. (2) contro M. R. oggi')
    expect(out.text).toBe('Marco Russo contro Mario Rossi oggi')
    expect(out.substituted).toBe(2)
    expect(out.ambiguous).toEqual([])
  })

  // (e) pseudonimo inventato dall'LLM (mai in sessione) → non sostituito, non ambiguo.
  it('(e) pseudonimo inventato dall\'LLM resta invariato', () => {
    const s = new SessionManager()
    s.getOrCreatePseudonym('Mario Rossi', 'PERSONA')
    const out = s.rehydrate('Riferimento a Z. Q. mai visto prima.')
    expect(out.text).toBe('Riferimento a Z. Q. mai visto prima.')
    expect(out.ambiguous).toEqual([])
  })

  // (f) ADR-004: lo pseudonimo non contiene PII oltre alle iniziali (nessun hash contenutistico).
  it('(f) lo pseudonimo PERSONA è solo iniziali, senza suffissi derivati dal nome', () => {
    const s = new SessionManager()
    expect(s.getOrCreatePseudonym('Mario Rossi', 'PERSONA')).toBe('M. R.')
    // niente hash/token derivato dal nome reale
    expect(s.getOrCreatePseudonym('Mario Rossi', 'PERSONA')).not.toMatch(/rossi|mario/i)
  })
})
