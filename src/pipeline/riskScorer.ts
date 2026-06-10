// ============================================================
// Classificazione di sensibilità e scoring del rischio residuo.
// Requisito del consiglio LLM #3: i dati art. 9/10 GDPR (penale, salute,
// minori, ecc.) non vanno mai serviti a un LLM cloud; serve inoltre un
// punteggio di rischio residuo per documento/chunk con soglia di blocco.
// ============================================================

import type { DetectedEntity } from '../types.js'

/**
 * Lessico di indicatori di categorie particolari/giudiziarie (art. 9/10 GDPR).
 * Volutamente prudente: in caso di dubbio, meglio marcare "sensibile".
 */
const SENSITIVE_LEXICON: { category: string; terms: RegExp }[] = [
  {
    category: 'penale',
    terms:
      /\b(imputat|indagat|condannat|reato|delitto|querel|p\.?m\.?|pubblico ministero|custodia cautelare|misura cautelare|art\.?\s*\d+\s*c\.?p\.?)\b/i
  },
  {
    category: 'salute',
    terms:
      /\b(diagnosi|patologi|malatt|cartella clinica|referto|terapia|invalidit|disabil|psichiatr|HIV|tumore|gravidanza)\b/i
  },
  {
    category: 'minori',
    terms: /\b(minore|minorenne|tribunale per i minorenni|affidamento|potestà genitoriale|adozion)\b/i
  },
  {
    category: 'vita_sessuale',
    terms: /\b(violenza sessuale|abuso sessuale|orientamento sessuale|molesti)\b/i
  },
  {
    category: 'origine_convinzioni',
    terms:
      /\b(origine etnica|origine razziale|convinzioni religiose|appartenenza sindacale|opinioni politiche)\b/i
  }
]

export interface SensitivityResult {
  sensitive: boolean
  categories: string[]
}

/** Determina se un testo appartiene a categorie particolari (art. 9/10 GDPR). */
export function classifySensitivity(text: string): SensitivityResult {
  const categories: string[] = []
  for (const { category, terms } of SENSITIVE_LEXICON) {
    if (terms.test(text)) categories.push(category)
  }
  return { sensitive: categories.length > 0, categories }
}

/**
 * Punteggio di rischio residuo 0..1 dopo la pseudonimizzazione.
 * Combina segnali di re-identificazione contestuale (single-out/linkability):
 * più identificatori contestuali rimangono (RG, date, importi, IBAN…), più
 * il rischio è alto anche se i nomi sono stati sostituiti.
 */
export function residualRisk(anonymizedText: string, entities: DetectedEntity[]): number {
  let score = 0

  // Identificatori contestuali ad alta linkability ancora presenti nel testo.
  const linkabilitySignals: RegExp[] = [
    /\bR\.?\s?G\.?\b/i, // numero di ruolo
    /\budienza\b/i,
    /\bsezione\b/i,
    // importi: il \b vale solo dopo "euro" (dopo "€" non esiste boundary)
    /\b\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?\s?(?:€|euro\b)/i,
    /\bIT\d{2}[A-Z0-9]/i // IBAN residuo
  ]
  for (const re of linkabilitySignals) if (re.test(anonymizedText)) score += 0.15

  // Pochi tipi di entità coperti → probabile under-detection.
  const distinctTypes = new Set(entities.map((e) => e.type)).size
  if (entities.length > 0 && distinctTypes <= 1) score += 0.1

  // Densità di entità molto bassa su testo lungo → sospetto di falsi negativi.
  const words = anonymizedText.split(/\s+/).length
  if (words > 300 && entities.length / words < 0.005) score += 0.2

  return Math.min(1, score)
}

/**
 * Soglia oltre la quale l'approvazione richiede la conferma esplicita del
 * rischio residuo da parte dell'avvocato (RT-06, ADR-0008). Non è un blocco
 * MCP duro: l'esposizione resta governata da approvazione + policy cloud.
 */
export const RISK_BLOCK_THRESHOLD = 0.5
