import { describe, it, expect } from 'vitest'
import {
  CODICE_FISCALE_PATTERN_LENIENT,
  CODICE_FISCALE_PATTERN_STRICT,
  PARTITA_IVA_PATTERN,
  IBAN_PATTERN,
  EMAIL_PATTERN,
  PEC_PATTERN,
  TELEFONO_PATTERN,
  TARGA_PATTERN,
  NUMERO_RUOLO_PATTERN,
  PROTOCOLLO_PATTERN
} from '../src/engine/regexPatterns.js'

function matches(re: RegExp, text: string): string[] {
  const r = new RegExp(re.source, re.flags)
  return text.match(r) ?? []
}

describe('regexPatterns', () => {
  it('CODICE_FISCALE lenient riconosce un CF valido', () => {
    expect(matches(CODICE_FISCALE_PATTERN_LENIENT, 'CF: RSSMRA80A01H501U.')).toContain(
      'RSSMRA80A01H501U'
    )
  })

  it('CODICE_FISCALE strict rifiuta una lettera-mese non valida', () => {
    // 'Z' non è una lettera-mese valida → strict non deve matchare
    expect(matches(CODICE_FISCALE_PATTERN_STRICT, 'RSSMRA80Z01H501U')).toHaveLength(0)
  })

  it('PARTITA_IVA riconosce 11 cifre', () => {
    const re = new RegExp(PARTITA_IVA_PATTERN.source, PARTITA_IVA_PATTERN.flags)
    const m = re.exec('P.IVA 12345678901')
    expect(m?.[1]).toBe('12345678901')
  })

  it('IBAN riconosce un IBAN italiano', () => {
    expect(matches(IBAN_PATTERN, 'IT60X0542811101000000123456')).toHaveLength(1)
  })

  it('EMAIL riconosce un indirizzo', () => {
    expect(matches(EMAIL_PATTERN, 'mario@example.com')).toContain('mario@example.com')
  })

  it('PEC riconosce un indirizzo su dominio PEC', () => {
    expect(matches(PEC_PATTERN, 'avv.rossi@pec.ordineavvocati.it')).toHaveLength(1)
  })

  it('TELEFONO riconosce un mobile italiano', () => {
    expect(matches(TELEFONO_PATTERN, 'chiamami al 3331234567').length).toBeGreaterThan(0)
  })

  it('TARGA riconosce una targa moderna', () => {
    expect(matches(TARGA_PATTERN, 'targa AB123CD').length).toBeGreaterThan(0)
  })

  it('NUMERO_RUOLO riconosce R.G.', () => {
    const r = new RegExp(NUMERO_RUOLO_PATTERN.source, NUMERO_RUOLO_PATTERN.flags)
    const m = r.exec('iscritto al R.G. 1234/2026')
    expect(m?.[1]?.replace(/\s/g, '')).toBe('1234/2026')
  })

  it('PROTOCOLLO riconosce prot. n.', () => {
    const r = new RegExp(PROTOCOLLO_PATTERN.source, PROTOCOLLO_PATTERN.flags)
    const m = r.exec('prot. n. 55512/2026')
    expect(m?.[1]).toContain('55512')
  })
})
