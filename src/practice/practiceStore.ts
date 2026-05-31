// ============================================================
// practiceStore — cache di pseudonimizzazione per "pratica", cifrata.
// Vive accanto ai documenti (scelta utente) come blob `.anonymcp` cifrato
// AES-256-GCM. NON contiene testo reale: solo l'hash dell'originale, il
// pseudonimo e il tipo. La mappa reversibile completa vive solo in RAM.
// ============================================================

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import type { DetectedEntity, PracticeCache, PracticeCacheEntry } from '../types.js'
import { ENGINE_VERSION } from '../types.js'
import { encrypt, decrypt, sha256 } from '../util/crypto.js'
import { log } from '../util/logger.js'

/** Nome file della cache dentro la cartella della pratica. */
export const CACHE_FILENAME = 'pratica.anonymcp'

/** Hash normalizzato di un testo originale (chiave deterministica, non reversibile). */
export function hashOriginal(originalText: string): string {
  return sha256(originalText.trim().toLowerCase())
}

/** Costruisce una PracticeCache dalle entità rilevate (senza testo in chiaro). */
export function buildCache(
  practiceId: string,
  sourceHash: string,
  entities: DetectedEntity[],
  confirmed: boolean
): PracticeCache {
  const seen = new Set<string>()
  const entries: PracticeCacheEntry[] = []
  for (const e of entities) {
    const origHash = hashOriginal(e.originalText)
    if (seen.has(origHash)) continue
    seen.add(origHash)
    entries.push({ origHash, pseudonym: e.pseudonym, type: e.type, confirmed })
  }
  return {
    version: 1,
    practiceId,
    createdAt: new Date().toISOString(),
    engineVersion: ENGINE_VERSION,
    sourceHash,
    entries
  }
}

/** Percorso del file cache per una cartella pratica. */
export function cachePath(folderPath: string): string {
  return join(folderPath, CACHE_FILENAME)
}

/** Scrive la cache cifrata su disco. */
export function saveCache(folderPath: string, cache: PracticeCache, passphrase: string): void {
  const blob = encrypt(JSON.stringify(cache), passphrase)
  writeFileSync(cachePath(folderPath), blob)
  log.info('Cache pratica salvata (cifrata)', {
    practiceId: cache.practiceId,
    entries: cache.entries.length
  })
}

/**
 * Carica e decifra la cache. Ritorna null se assente, corrotta, o se
 * `sourceHash`/`engineVersion` non combaciano (cache invalidata → niente
 * staleness, evita di esporre testo non ri-anonimizzato).
 */
export function loadCache(
  folderPath: string,
  passphrase: string,
  expectedSourceHash?: string
): PracticeCache | null {
  const path = cachePath(folderPath)
  if (!existsSync(path)) return null
  try {
    const cache = JSON.parse(decrypt(readFileSync(path), passphrase)) as PracticeCache
    if (cache.version !== 1) return null
    if (cache.engineVersion !== ENGINE_VERSION) {
      log.warn('Cache pratica ignorata: engineVersion diversa', {
        cache: cache.engineVersion,
        expected: ENGINE_VERSION
      })
      return null
    }
    if (expectedSourceHash && cache.sourceHash !== expectedSourceHash) {
      log.warn('Cache pratica invalidata: sourceHash cambiato', { practiceId: cache.practiceId })
      return null
    }
    return cache
  } catch (err) {
    log.error('Errore lettura cache pratica (corrotta o chiave errata)', {
      error: err instanceof Error ? err.message : String(err)
    })
    return null
  }
}
