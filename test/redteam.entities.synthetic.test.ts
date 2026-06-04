import { describe, expect, it } from 'vitest'
import { detectEntities, extractRegexEntities } from '../src/engine/anonymizer.js'
import { processText } from '../src/pipeline/documentService.js'

async function expectNoPlaintextLeak(raw: string, secrets: string[]): Promise<void> {
  const result = await processText(raw)
  for (const secret of secrets) {
    expect(result.text, `"${secret}" non deve comparire`).not.toContain(secret)
  }
}

describe('red-team entita su corpus sintetico esteso', () => {
  it('pseudonimizza atto civile con difensori, parti, indirizzi, contatti e IBAN', async () => {
    const raw = `ATTO DI CITAZIONE

Il sottoscritto Avv. Marco Bianchi, C.F. BNCMRC75H15A944G, con studio in Via Giuseppe Garibaldi 45, 40121 Bologna (BO), tel. 051-234567, email: m.bianchi@studiolegalebianchi.it, PEC: marco.bianchi@pec.it, difensore dell'attore Sig. Giuseppe Verdi, nato a Milano il 15/03/1980, C.F. VRDGPP80C15F205X, residente in Via Alessandro Manzoni 12, 20121 Milano (MI), tel. 339-1234567, email: giuseppe.verdi@email.it, IBAN: IT60X0542811101000000123456

CONTRO

Sig.ra Elena Rossi, nata a Roma il 22/07/1975, C.F. RSSLNE75L62H501Y, residente in Via Dante Alighieri 78, 00185 Roma (RM), tel. 348-7654321, email: elena.rossi@mail.it, IBAN: IT28W8000000292100645211000

PER QUESTI MOTIVI
Si chiede la condanna della Sig.ra Elena Rossi al pagamento.`

    await expectNoPlaintextLeak(raw, [
      'Marco Bianchi',
      'BNCMRC75H15A944G',
      'Via Giuseppe Garibaldi 45, 40121 Bologna',
      '051-234567',
      'm.bianchi@studiolegalebianchi.it',
      'marco.bianchi@pec.it',
      'Giuseppe Verdi',
      'VRDGPP80C15F205X',
      'Via Alessandro Manzoni 12, 20121 Milano',
      '339-1234567',
      'giuseppe.verdi@email.it',
      'IT60X0542811101000000123456',
      'Elena Rossi',
      'RSSLNE75L62H501Y',
      'Via Dante Alighieri 78, 00185 Roma',
      '348-7654321',
      'elena.rossi@mail.it',
      'IT28W8000000292100645211000'
    ])
  })

  it('pseudonimizza perizia OCR con RG, perito, parti, studi, targhe e societa', async () => {
    const raw = `RELAZlONE DI PERIZIA MED1CO-LEGALE
Perizia disposta dal Tribunale di Roma ne1l'arnbito del proced-irnento R.G. n. 4521/2023.
Perito norninato: Prof.ssa Carla Russo Martine|li, Codice fiscale: RSSCRL67P53H501V, P. 1VA: 12345678901, 5tudio: Via dei Tribunali, 88 - 00186 Roma, e-mai1: c.russo@perizi\u00adamelegale.it.
Oggetto della perizia: Sig. Vincenzo Esposito De Angelis, nato a Napoli il 18 marzo 1979, codice fiscale SPSVNZ79C18F839T, resideute in Via Napoli, 56 - 00185 Roma, assistito dall'avv. Federica Conti Lombardi.
Controparte: Compagnia Assicurazioni Generali Italia S.p.A., P. lVA 00409920584, rappreseutata daIl'avv. Marco Pellegrini, con studio in Largo Argentina, 11 - O0186 Roma.
Il veicolo Fiat 500, targa FX 523 KL, e' stato tamponato da un autoarticolato di proprieta della Societa Logistica del Sud S.r.l., P. lVA 09876543210.`

    await expectNoPlaintextLeak(raw, [
      '4521/2023',
      'Carla Russo Martinelli',
      'RSSCRL67P53H501V',
      '12345678901',
      'c.russo@periziamelegale.it',
      'Vincenzo Esposito De Angelis',
      'SPSVNZ79C18F839T',
      'Via Napoli, 56 - 00185 Roma',
      'Federica Conti Lombardi',
      'Compagnia Assicurazioni Generali Italia S.p.A.',
      '00409920584',
      'Marco Pellegrini',
      'Largo Argentina, 11 - O0186 Roma',
      'FX 523 KL',
      'Societa Logistica del Sud S.r.l.',
      '09876543210'
    ])
  })

  it('non trasforma intestazioni, ruoli e abbreviazioni tecniche in PERSONA', async () => {
    const raw = `ATTO DI CITAZIONE
PREMESSO CHE
PER QUESTI MOTIVI
DOCUMENTI ALLEGATI

Il Sig. Marco Bianchi deposita memoria.
IBAN: IT60X0542811101000000123456
Tel. 051-234567
Il consulente finanziario e l'impiegata bancaria sono qualifiche, non persone.`

    const { entities } = await detectEntities(raw)
    const personTexts = entities
      .filter((entity) => entity.type === 'PERSONA')
      .map((entity) => entity.originalText.toLowerCase())

    expect(personTexts).toContain('marco bianchi')
    for (const falsePositive of [
      'atto di citazione',
      'premesso che',
      'per questi motivi',
      'documenti allegati',
      'sig',
      'iban',
      'tel',
      'consulente finanziario',
      'impiegata bancaria'
    ]) {
      expect(personTexts, `${falsePositive} non deve diventare PERSONA`).not.toContain(falsePositive)
    }
  })

  it('il layer regex non produce heading legali come entita candidate', () => {
    const found = extractRegexEntities('ATTO DI CITAZIONE\nPER QUESTI MOTIVI\nDOCUMENTI ALLEGATI')
    expect(found.map((entity) => entity.text.toLowerCase())).toEqual([])
  })
})
