// ============================================================
// entityDictionary — dizionario di pratica in TESTO CHIARO (formato Anonimator).
// Vive accanto ai documenti della pratica come file JSON. Vedi ADR-0003.
//
// A differenza di practiceStore (cache cifrata, solo hash), questo file contiene
// il testo originale delle entità: serve a ricaricare le parti note di una pratica
// e a permettere la correzione manuale. NON è mai esposto via MCP → non viola lo
// scopo (nessun leak verso l'LLM). La cifratura è opzionale (ADR-0001).
// ============================================================

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import type { DetectedEntity, EntityDictionary, EntityDictionaryEntry } from '../types.js'
import { log } from '../util/logger.js'

/** Nome file del dizionario dentro la cartella della pratica. */
export const DICTIONARY_FILENAME = 'pratica.entitydict.json'

/** Percorso del file dizionario per una cartella pratica. */
export function dictionaryPath(folderPath: string): string {
  return join(folderPath, DICTIONARY_FILENAME)
}

/**
 * Costruisce un EntityDictionary dalle entità rilevate, deduplicando per
 * (testo originale normalizzato + tipo). Mantiene il testo in chiaro.
 */
export function buildDictionary(
  practiceId: string,
  entities: DetectedEntity[],
  canonicalOf?: (original: string) => string | undefined
): EntityDictionary {
  const seen = new Set<string>()
  const entries: EntityDictionaryEntry[] = []
  for (const e of entities) {
    const key = `${e.type}:${e.originalText.trim().toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    const entry: EntityDictionaryEntry = {
      original: e.originalText,
      pseudonym: e.pseudonym,
      type: e.type
    }
    // Persisti il canonical solo se presente e diverso dall'originale (additivo).
    const canonical = canonicalOf?.(e.originalText)
    if (canonical && canonical.trim().toLowerCase() !== e.originalText.trim().toLowerCase()) {
      entry.canonical = canonical
    }
    entries.push(entry)
  }
  return {
    version: 1,
    practiceId,
    exportedAt: new Date().toISOString(),
    entries
  }
}

/** Scrive il dizionario su disco (testo in chiaro, leggibile e modificabile). */
export function saveDictionary(folderPath: string, dict: EntityDictionary): void {
  writeFileSync(dictionaryPath(folderPath), JSON.stringify(dict, null, 2), 'utf8')
  log.info('Dizionario pratica salvato', {
    practiceId: dict.practiceId,
    entries: dict.entries.length
  })
}

/**
 * Carica il dizionario di una pratica. Ritorna null se assente o malformato.
 * La validazione è permissiva sulle entry (scarta le malformate) per non
 * perdere tutto il dizionario per una singola voce corrotta.
 */
export function loadDictionary(folderPath: string): EntityDictionary | null {
  const path = dictionaryPath(folderPath)
  if (!existsSync(path)) return null
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown
    if (!isDictionaryShape(raw)) {
      log.warn('Dizionario pratica ignorato: formato non valido', { path })
      return null
    }
    const entries = raw.entries.filter(isValidEntry).map((e) => {
      const out: EntityDictionaryEntry = { original: e.original, pseudonym: e.pseudonym, type: e.type }
      if (typeof (e as { canonical?: unknown }).canonical === 'string') {
        out.canonical = (e as { canonical: string }).canonical
      }
      return out
    })
    return { version: 1, practiceId: raw.practiceId, exportedAt: raw.exportedAt, entries }
  } catch (err) {
    log.error('Errore lettura dizionario pratica', {
      error: err instanceof Error ? err.message : String(err)
    })
    return null
  }
}

/** Type guard sulla struttura di base del dizionario. */
function isDictionaryShape(
  v: unknown
): v is { version: number; practiceId: string; exportedAt: string; entries: unknown[] } {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return (
    o.version === 1 &&
    typeof o.practiceId === 'string' &&
    typeof o.exportedAt === 'string' &&
    Array.isArray(o.entries)
  )
}

/** Type guard su una singola entry (scarta le voci incomplete). */
function isValidEntry(v: unknown): v is EntityDictionaryEntry {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  if (typeof o.original !== 'string' || typeof o.pseudonym !== 'string') return false
  const original = o.original.trim().toLowerCase()
  const pseudonym = o.pseudonym.trim().toLowerCase()
  return (
    original.length > 0 &&
    pseudonym.length > 0 &&
    pseudonym !== original &&
    !pseudonym.includes(original) &&
    typeof o.type === 'string'
  )
}
