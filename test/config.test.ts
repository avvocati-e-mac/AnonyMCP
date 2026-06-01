import { describe, it, expect } from 'vitest'
import { labelLooksLikePersonName } from '../src/config.js'

describe('labelLooksLikePersonName (ADR-0004)', () => {
  it('riconosce "X c. Y" come probabile nome di causa', () => {
    expect(labelLooksLikePersonName('Rossi c. Bianchi')).toBe(true)
    expect(labelLooksLikePersonName('Verdi contro Comune')).toBe(true)
  })

  it('riconosce due o più parole capitalizzate consecutive', () => {
    expect(labelLooksLikePersonName('Mario Rossi')).toBe(true)
    expect(labelLooksLikePersonName('Studio Legale Verdi')).toBe(true)
  })

  it('accetta i numeri di pratica opachi (nessun warning)', () => {
    expect(labelLooksLikePersonName('400F')).toBe(false)
    expect(labelLooksLikePersonName('2026-CV-001')).toBe(false)
    expect(labelLooksLikePersonName('Pratica 42')).toBe(false)
  })

  it('non si attiva su una singola parola capitalizzata', () => {
    expect(labelLooksLikePersonName('Civile')).toBe(false)
  })
})
