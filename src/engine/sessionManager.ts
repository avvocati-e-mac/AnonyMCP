// ============================================================
// SessionManager — dizionario in RAM `originale → pseudonimo`.
// Portato da `avvocati-e-mac/anonimator`, adattato per AnonyMCP:
//  - nessuna dipendenza Electron (logger interno)
//  - NESSUNA persistenza su disco in chiaro (regola di sicurezza del
//    consiglio LLM): la mappa reale↔pseudonimo vive SOLO in RAM.
//    La cache cifrata è gestita altrove (practice/practiceStore) e
//    NON contiene il testo reale.
// ============================================================

import type { DetectedEntity, EntityType } from '../types.js'

/** Prefissi leggibili per entità strutturate (pseudonimi numerici). */
const STRUCTURED_PREFIX: Partial<Record<EntityType, string>> = {
  CODICE_FISCALE: 'CF',
  PARTITA_IVA: 'PIVA',
  IBAN: 'IBAN',
  EMAIL: 'EMAIL',
  PEC: 'PEC',
  TELEFONO: 'TEL',
  DATA_NASCITA: 'NASC',
  LUOGO_NASCITA: 'NASCLUOGO',
  INDIRIZZO: 'IND',
  NUMERO_DOCUMENTO: 'DOC',
  TARGA: 'TARGA',
  NUMERO_RUOLO: 'RG',
  PROTOCOLLO: 'PROT'
}

interface SessionEntry {
  pseudonym: string
  type: EntityType
}

/**
 * Genera le iniziali da un nome/cognome o nome organizzazione.
 * "Mario Rossi" → "M. R."; "Studio Legale Strozzi" → "S. L. S.".
 * Ritorna null se non generabili (→ fallback numerico).
 */
export function toInitials(text: string): string | null {
  const cleaned = text
    .replace(/\(.*?\)/g, '')
    .replace(/[0-9]/g, '')
    .trim()

  const parts = cleaned
    .split(/[\s\-_]+/)
    .map((p) => p.replace(/[^A-Za-zÀ-ÿ]/g, '').trim())
    .filter((p) => p.length > 0)

  if (parts.length === 0) return null
  return parts.map((p) => p[0]!.toUpperCase() + '.').join(' ')
}

/**
 * Gestisce il dizionario pseudonimi in memoria per l'intera sessione.
 * Garantisce coerenza: la stessa stringa originale riceve sempre lo stesso
 * pseudonimo. I dati restano in RAM e non vengono mai scritti su disco in chiaro.
 */
export class SessionManager {
  /** Mappa: testo originale (lowercase) → entry pseudonimo. */
  private dictionary = new Map<string, SessionEntry>()
  /** Contatori fallback per tipo. */
  private counters = new Map<EntityType, number>()

  /** Restituisce (o crea) il pseudonimo per un testo originale. */
  getOrCreatePseudonym(originalText: string, type: EntityType): string {
    const key = originalText.trim().toLowerCase()
    const existing = this.dictionary.get(key)
    if (existing) return existing.pseudonym

    let pseudonym: string
    const structuredPrefix = STRUCTURED_PREFIX[type]
    if (structuredPrefix) {
      const count = (this.counters.get(type) ?? 0) + 1
      this.counters.set(type, count)
      pseudonym = `${structuredPrefix}_${String(count).padStart(3, '0')}`
    } else {
      const initials = toInitials(originalText)
      if (initials) {
        const sameInitials = [...this.dictionary.values()].filter(
          (e) => e.pseudonym === initials || e.pseudonym.startsWith(initials + ' (')
        )
        pseudonym = sameInitials.length > 0 ? `${initials} (${sameInitials.length + 1})` : initials
      } else {
        const prefix =
          type === 'PERSONA' ? 'SOGGETTO' : type === 'ORGANIZZAZIONE' ? 'ENTE' : 'LUOGO'
        const count = (this.counters.get(type) ?? 0) + 1
        this.counters.set(type, count)
        pseudonym = `${prefix}_${String(count).padStart(3, '0')}`
      }
    }

    this.dictionary.set(key, { pseudonym, type })
    return pseudonym
  }

  /**
   * Pre-carica una coppia originale→pseudonimo conosciuta (es. da una cache
   * pratica già approvata). Mantiene la coerenza tra sessioni senza ri-NER.
   */
  preload(originalText: string, pseudonym: string, type: EntityType): void {
    this.dictionary.set(originalText.trim().toLowerCase(), { pseudonym, type })
  }

  /** Arricchisce entità rilevate con pseudonimi coerenti. */
  enrichEntities(entities: DetectedEntity[]): DetectedEntity[] {
    return entities.map((entity) => ({
      ...entity,
      pseudonym: entity.pseudonym || this.getOrCreatePseudonym(entity.originalText, entity.type)
    }))
  }

  /** True se il testo originale è già noto. */
  has(originalText: string): boolean {
    return this.dictionary.has(originalText.trim().toLowerCase())
  }

  /** Statistiche del dizionario (senza esporre i valori reali). */
  getStats(): { totalEntries: number; byType: Record<string, number> } {
    const byType: Record<string, number> = {}
    for (const { type } of this.dictionary.values()) {
      byType[type] = (byType[type] ?? 0) + 1
    }
    return { totalEntries: this.dictionary.size, byType }
  }

  /** Cancella e azzera la memoria (zeroization su chiusura sessione). */
  reset(): void {
    this.dictionary.clear()
    this.counters.clear()
  }
}
