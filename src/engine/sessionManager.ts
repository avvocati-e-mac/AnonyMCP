// ============================================================
// SessionManager — dizionario in RAM `originale → pseudonimo`.
// Portato da `avvocati-e-mac/anonimator`, adattato per AnonyMCP:
//  - nessuna dipendenza Electron (logger interno)
//  - NESSUNA persistenza su disco in chiaro (regola di sicurezza del
//    consiglio LLM): la mappa reale↔pseudonimo vive SOLO in RAM.
//    La cache cifrata è gestita altrove (practice/practiceStore) e
//    NON contiene il testo reale.
// ============================================================

import type { DetectedEntity, EntityDictionary, EntityType } from '../types.js'
import { sha256 } from '../util/crypto.js'

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
  /**
   * Mappa: sha256(originale normalizzato) → pseudonimo, precaricata dalla cache
   * cifrata della pratica. Permette di riusare lo stesso pseudonimo tra sessioni
   * SENZA conservare il testo reale su disco (la cache contiene solo l'hash).
   */
  private byHash = new Map<string, { pseudonym: string; type: EntityType }>()

  /** Hash di un testo originale — DEVE combaciare con practiceStore.hashOriginal. */
  private static hashKey(originalText: string): string {
    return sha256(originalText.trim().toLowerCase())
  }

  /** Restituisce (o crea) il pseudonimo per un testo originale. */
  getOrCreatePseudonym(originalText: string, type: EntityType): string {
    const key = originalText.trim().toLowerCase()
    const existing = this.dictionary.get(key)
    if (existing) return existing.pseudonym

    // Coerenza cross-sessione: se l'hash è nella cache precaricata, riusa il pseudonimo.
    const fromCache = this.byHash.get(SessionManager.hashKey(originalText))
    if (fromCache) {
      this.dictionary.set(key, { pseudonym: fromCache.pseudonym, type: fromCache.type })
      return fromCache.pseudonym
    }

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

  /**
   * Precarica una coppia hash→pseudonimo dalla cache cifrata (che NON contiene
   * il testo reale). Alla prossima occorrenza dell'entità, il pseudonimo sarà
   * riusato senza generarne uno nuovo → coerenza tra sessioni.
   */
  preloadByHash(origHash: string, pseudonym: string, type: EntityType): void {
    this.byHash.set(origHash, { pseudonym, type })
  }

  /**
   * Precarica tutte le entità da un dizionario di pratica (testo in chiaro,
   * formato Anonimator). Ogni voce diventa una coppia originale→pseudonimo nota,
   * così la prossima scansione riusa gli stessi pseudonimi senza ri-NER. Vedi ADR-0003.
   * Ritorna il numero di entità importate.
   */
  importFromDictionary(dict: EntityDictionary): number {
    for (const entry of dict.entries) {
      this.preload(entry.original, entry.pseudonym, entry.type)
      // Allinea il contatore se il pseudonimo è del tipo PREFIX_NNN, per evitare
      // collisioni con pseudonimi generati dopo l'import.
      this.bumpCounterFromPseudonym(entry.type, entry.pseudonym)
    }
    return dict.entries.length
  }

  /**
   * Se il pseudonimo ha forma `PREFIX_NNN`, assicura che il contatore del tipo
   * sia almeno NNN, così i nuovi pseudonimi non riusano un numero già assegnato.
   */
  private bumpCounterFromPseudonym(type: EntityType, pseudonym: string): void {
    const m = /_(\d+)$/.exec(pseudonym)
    if (!m) return
    const n = Number.parseInt(m[1]!, 10)
    if (Number.isNaN(n)) return
    const current = this.counters.get(type) ?? 0
    if (n > current) this.counters.set(type, n)
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
    this.byHash.clear()
  }
}
