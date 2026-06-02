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

/**
 * Esito di una ri-idratazione (pseudonimo→reale). Uso LOCALE lato server,
 * mai esposto via MCP. Vedi ADR-0005.
 */
export interface RehydrationResult {
  /** Testo con i pseudonimi noti sostituiti dai valori reali. */
  text: string
  /** Numero di pseudonimi distinti effettivamente sostituiti. */
  substituted: number
  /** Pseudonimi NON sostituiti perché ambigui (mappano a >1 originale). */
  ambiguous: string[]
}

interface SessionEntry {
  pseudonym: string
  type: EntityType
  /**
   * Forma originale con le maiuscole reali (la chiave del dizionario è lowercase).
   * Serve alla re-idratazione (pseudonimo→reale) per ripristinare il case corretto.
   * Vedi ADR-0005. Uso LOCALE: mai esposta via MCP.
   */
  displayOriginal: string
  /**
   * Id interno dell'ENTITÀ (non del mention). Le occorrenze co-referenziate della
   * stessa persona ("Mario Rossi" e il successivo "Rossi") condividono lo stesso
   * entityId. Permette alla re-idratazione di distinguere la co-reference (stessa
   * entità, da collassare) dall'omonimia di iniziali (entità diverse). RAM-only,
   * mai serializzato nello pseudonimo né esposto via MCP. Vedi ADR-0005.
   */
  entityId?: string
  /**
   * Forma canonica dell'entità (longest mention del gruppo, es. "Mario Rossi" per
   * il cluster {"Mario Rossi", "Rossi"}). È il valore con cui si ri-idrata. RAM-only.
   */
  canonical?: string
}

/** Esegue l'escape dei metacaratteri regex in una stringa letterale. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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
  /** Contatore degli id-entità interni (RAM-only, mai esposto). Vedi ADR-0005. */
  private entityCounter = 0
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
    const display = originalText.trim()
    const key = display.toLowerCase()
    const existing = this.dictionary.get(key)
    if (existing) return existing.pseudonym

    // Coerenza cross-sessione: se l'hash è nella cache precaricata, riusa il pseudonimo.
    const fromCache = this.byHash.get(SessionManager.hashKey(originalText))
    if (fromCache) {
      this.dictionary.set(key, {
        pseudonym: fromCache.pseudonym,
        type: fromCache.type,
        displayOriginal: display
      })
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

    // Le PERSONA ricevono un id-entità interno (co-reference): le occorrenze legate
    // a questo nome erediteranno lo stesso entityId via linkCoreference. Il canonical
    // iniziale è la mention stessa (potrà essere allungato da un mention più completo).
    const entry: SessionEntry = { pseudonym, type, displayOriginal: display }
    if (type === 'PERSONA') {
      entry.entityId = this.newEntityId()
      entry.canonical = display
    }
    this.dictionary.set(key, entry)
    return pseudonym
  }

  /** Genera un nuovo id-entità interno (RAM-only). */
  private newEntityId(): string {
    this.entityCounter += 1
    return `ENT_${this.entityCounter}`
  }

  /**
   * Pre-carica una coppia originale→pseudonimo conosciuta (es. da una cache
   * pratica già approvata). Mantiene la coerenza tra sessioni senza ri-NER.
   */
  preload(originalText: string, pseudonym: string, type: EntityType): void {
    const display = originalText.trim()
    this.dictionary.set(display.toLowerCase(), { pseudonym, type, displayOriginal: display })
  }

  /**
   * Registra `mention` (es. "Rossi") come co-reference di `canonicalText`
   * (es. "Mario Rossi"): eredita lo stesso pseudonimo e lo stesso entityId del
   * canonical, così la re-idratazione le tratta come la STESSA entità (le collassa)
   * e usa la forma canonica più completa. Vedi ADR-0005. Ritorna il pseudonimo.
   * Se il canonical non è ancora noto, lo crea.
   */
  linkCoreference(mention: string, canonicalText: string, type: EntityType): string {
    const canonKey = canonicalText.trim().toLowerCase()
    // Assicura che il canonical esista e abbia un entityId (lo crea se serve).
    const pseudonym = this.getOrCreatePseudonym(canonicalText, type)
    const canonEntry = this.dictionary.get(canonKey)!
    const entityId = canonEntry.entityId
    // La forma canonica del gruppo è la mention più lunga (longest-mention).
    const canonical =
      canonEntry.canonical && canonEntry.canonical.length >= canonicalText.trim().length
        ? canonEntry.canonical
        : canonicalText.trim()
    canonEntry.canonical = canonical

    const mentionDisplay = mention.trim()
    const mentionKey = mentionDisplay.toLowerCase()
    if (!this.dictionary.has(mentionKey)) {
      this.dictionary.set(mentionKey, {
        pseudonym,
        type,
        displayOriginal: mentionDisplay,
        entityId,
        canonical
      })
    }
    return pseudonym
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

  /**
   * Tutti i termini noti alla sessione (testo, pseudonimo, tipo). Serve a CERCARLI
   * nel testo di ogni documento: una parte nota alla pratica non deve mai trapelare
   * anche se il NER non la rileva in quel documento (vedi enrichFromKnownTerms).
   * Il testo è normalizzato a minuscolo (la chiave del dizionario); il match è
   * comunque case-insensitive.
   */
  getKnownTerms(): { original: string; pseudonym: string; type: EntityType }[] {
    return [...this.dictionary.entries()].map(([original, v]) => ({
      original,
      pseudonym: v.pseudonym,
      type: v.type
    }))
  }

  /** Statistiche del dizionario (senza esporre i valori reali). */
  getStats(): { totalEntries: number; byType: Record<string, number> } {
    const byType: Record<string, number> = {}
    for (const { type } of this.dictionary.values()) {
      byType[type] = (byType[type] ?? 0) + 1
    }
    return { totalEntries: this.dictionary.size, byType }
  }

  /**
   * Costruisce on-demand la mappa inversa pseudonimo→originale dalla `dictionary`.
   * Se uno stesso pseudonimo mappa a >1 originale distinto, è AMBIGUO e non sarà
   * sostituito (la re-idratazione resta fail-safe: meglio lo pseudonimo che un
   * valore sbagliato). Vedi ADR-0005. Uso LOCALE.
   */
  private buildInverseMap(): { unique: Map<string, string>; ambiguous: Set<string> } {
    const originalsByPseudonym = new Map<string, Set<string>>()
    for (const entry of this.dictionary.values()) {
      const set = originalsByPseudonym.get(entry.pseudonym) ?? new Set<string>()
      set.add(entry.displayOriginal)
      originalsByPseudonym.set(entry.pseudonym, set)
    }
    const unique = new Map<string, string>()
    const ambiguous = new Set<string>()
    for (const [pseudonym, originals] of originalsByPseudonym) {
      if (originals.size === 1) unique.set(pseudonym, [...originals][0]!)
      else ambiguous.add(pseudonym)
    }
    return { unique, ambiguous }
  }

  /**
   * Re-idrata un testo: sostituisce gli pseudonimi noti con i valori reali.
   * Passaggio LOCALE lato server (es. prima di salvare una bozza dell'LLM su disco):
   * NON è un tool MCP di de-anonimizzazione e il risultato non va mai esposto via MCP.
   * Vedi ADR-0005.
   *
   * - Sostituisce gli pseudonimi più lunghi prima (es. "M. R. (2)" prima di "M. R.")
   *   per non corrompere i prefissi condivisi.
   * - I pseudonimi ambigui (→ più originali) NON vengono sostituiti e finiscono in `ambiguous`.
   */
  rehydrate(text: string): RehydrationResult {
    const { unique, ambiguous } = this.buildInverseMap()
    const pseudonyms = [...unique.keys()].sort((a, b) => b.length - a.length)

    let result = text
    let substituted = 0
    for (const pseudonym of pseudonyms) {
      const pattern = new RegExp(
        `(?<![\\p{L}\\p{N}_])${escapeRegExp(pseudonym)}(?![\\p{L}\\p{N}_])`,
        'gu'
      )
      let hit = false
      result = result.replace(pattern, () => {
        hit = true
        return unique.get(pseudonym)!
      })
      if (hit) substituted++
    }

    const usedAmbiguous = [...ambiguous].filter((p) =>
      new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRegExp(p)}(?![\\p{L}\\p{N}_])`, 'u').test(text)
    )
    return { text: result, substituted, ambiguous: usedAmbiguous }
  }

  /** Cancella e azzera la memoria (zeroization su chiusura sessione). */
  reset(): void {
    this.dictionary.clear()
    this.counters.clear()
    this.byHash.clear()
  }
}
