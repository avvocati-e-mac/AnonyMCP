import { describe, it, expect } from 'vitest'
import { SessionManager, toInitials } from '../src/engine/sessionManager.js'

describe('toInitials', () => {
  it('genera iniziali da nome e cognome', () => {
    expect(toInitials('Mario Rossi')).toBe('M. R.')
  })
  it('gestisce nomi multipli', () => {
    expect(toInitials('Studio Legale Strozzi')).toBe('S. L. S.')
  })
  it('ritorna null se non generabili', () => {
    expect(toInitials('123')).toBeNull()
  })
})

describe('SessionManager', () => {
  it('assegna lo stesso pseudonimo allo stesso testo (coerenza)', () => {
    const s = new SessionManager()
    const a = s.getOrCreatePseudonym('Mario Rossi', 'PERSONA')
    const b = s.getOrCreatePseudonym('mario rossi', 'PERSONA')
    expect(a).toBe(b)
  })

  it('usa prefissi numerici per entità strutturate', () => {
    const s = new SessionManager()
    expect(s.getOrCreatePseudonym('RSSMRA80A01H501U', 'CODICE_FISCALE')).toBe('CF_001')
    expect(s.getOrCreatePseudonym('IT60X0542811101000000123456', 'IBAN')).toBe('IBAN_001')
  })

  it('disambigua iniziali in conflitto', () => {
    const s = new SessionManager()
    const a = s.getOrCreatePseudonym('Mario Rossi', 'PERSONA')
    const b = s.getOrCreatePseudonym('Marco Russo', 'PERSONA')
    expect(a).toBe('M. R.')
    expect(b).toBe('M. R. (2)')
  })

  it('preload mantiene coerenza tra sessioni', () => {
    const s = new SessionManager()
    s.preload('Mario Rossi', 'X. Y.', 'PERSONA')
    expect(s.getOrCreatePseudonym('Mario Rossi', 'PERSONA')).toBe('X. Y.')
  })

  it('getStats conta per tipo senza esporre valori reali', () => {
    const s = new SessionManager()
    s.getOrCreatePseudonym('Mario Rossi', 'PERSONA')
    s.getOrCreatePseudonym('RSSMRA80A01H501U', 'CODICE_FISCALE')
    const stats = s.getStats()
    expect(stats.totalEntries).toBe(2)
    expect(stats.byType['PERSONA']).toBe(1)
  })

  it('reset azzera la memoria', () => {
    const s = new SessionManager()
    s.getOrCreatePseudonym('Mario Rossi', 'PERSONA')
    s.reset()
    expect(s.getStats().totalEntries).toBe(0)
  })
})
