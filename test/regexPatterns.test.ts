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
  PROTOCOLLO_PATTERN,
  BIOGRAPHIC_NAME_PATTERN,
  PKI_FIRMA_PATTERN
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

  it('CODICE_FISCALE lenient riconosce un CF separato da spazi', () => {
    const r = new RegExp(CODICE_FISCALE_PATTERN_LENIENT.source, CODICE_FISCALE_PATTERN_LENIENT.flags)
    expect(r.exec('CF: LMNK RM85 B04Z 330U')?.[0]).toBe('LMNK RM85 B04Z 330U')
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

  it('BIOGRAPHIC_NAME riconosce nomi seguiti da dati biografici o formali', () => {
    expect(
      new RegExp(BIOGRAPHIC_NAME_PATTERN.source, BIOGRAPHIC_NAME_PATTERN.flags).exec(
        'Giovanni Bianchi Esposito, nato a Salerno il 23 luglio 1968'
      )?.[1]
    ).toBe('Giovanni Bianchi Esposito')
    expect(
      new RegExp(BIOGRAPHIC_NAME_PATTERN.source, BIOGRAPHIC_NAME_PATTERN.flags).exec(
        "Pietro Coppola D'Avena, codice fiscale ABCDEF80A01H501U"
      )?.[1]
    ).toBe("Pietro Coppola D'Avena")
  })

  it('BIOGRAPHIC_NAME supporta caratteri Unicode non Latin-1', () => {
    const r = new RegExp(BIOGRAPHIC_NAME_PATTERN.source, BIOGRAPHIC_NAME_PATTERN.flags)
    expect(r.exec('Đorđe Petrović, residente in Via Zamboni 10')?.[1]).toBe('Đorđe Petrović')
  })

  it('PKI_FIRMA riconosce firme digitali con piu token', () => {
    const r = new RegExp(PKI_FIRMA_PATTERN.source, PKI_FIRMA_PATTERN.flags)
    expect(r.exec('Firmato Da: GIOVANNI BIANCHI ESPOSITO Emesso Da: ARUBAPEC')?.[1]).toBe(
      'GIOVANNI BIANCHI ESPOSITO'
    )
  })
})
