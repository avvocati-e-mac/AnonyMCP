import { describe, it, expect } from 'vitest'
import { classifySensitivity, residualRisk, RISK_BLOCK_THRESHOLD } from '../src/pipeline/riskScorer.js'
import type { DetectedEntity } from '../src/types.js'

describe('classifySensitivity', () => {
  it('marca come sensibile un testo penale', () => {
    const r = classifySensitivity("L'imputato è accusato del reato di cui all'art. 624 c.p.")
    expect(r.sensitive).toBe(true)
    expect(r.categories).toContain('penale')
  })

  it('marca come sensibile un testo sanitario', () => {
    expect(classifySensitivity('diagnosi di patologia cronica').sensitive).toBe(true)
  })

  it('marca come sensibile un procedimento minorile', () => {
    expect(classifySensitivity('affidamento del minore').sensitive).toBe(true)
  })

  it('non marca un contratto commerciale neutro', () => {
    expect(classifySensitivity('contratto di fornitura di cancelleria').sensitive).toBe(false)
  })
})

describe('residualRisk', () => {
  const noEntities: DetectedEntity[] = []

  it('aumenta il rischio se restano identificatori contestuali', () => {
    const risk = residualRisk('iscritto al R.G. 12/2026, udienza del...', noEntities)
    expect(risk).toBeGreaterThan(0)
  })

  it('testo neutro ha rischio basso', () => {
    expect(residualRisk('lorem ipsum dolor sit amet', noEntities)).toBe(0)
  })

  it("rileva gli importi sia con simbolo '€' sia con 'euro'", () => {
    expect(residualRisk('condanna al pagamento di 1.000,00 € oltre interessi', noEntities)).toBeGreaterThan(0)
    expect(residualRisk('condanna al pagamento di 1.000,00 euro oltre interessi', noEntities)).toBeGreaterThan(0)
  })

  it('la soglia di blocco è ragionevole', () => {
    expect(RISK_BLOCK_THRESHOLD).toBeGreaterThan(0)
    expect(RISK_BLOCK_THRESHOLD).toBeLessThanOrEqual(1)
  })
})
