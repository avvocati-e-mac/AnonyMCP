// ============================================================
// writeApprovalStore — pending write persistiti su disco, condivisi tra la
// TUI di review e il server MCP (processi separati). Gemello di approvalStore.
// Vedi ADR-0005.
//
// Una bozza dell'LLM, già re-idratata, viene scritta in staging e registrata
// qui come "in attesa". La TUI la elenca e la promuove (staging→destinazione)
// su conferma umana (invariante #8). Il file di stato contiene solo metadati
// (path relativo, hash del contenuto, timestamp): nessun valore reale.
// ============================================================

import { readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { sha256 } from '../util/crypto.js'
import { log } from '../util/logger.js'

/** Nome file dei pending write dentro la cartella della pratica. */
export const WRITES_FILENAME = 'pratica.writes.json'

/** Una scrittura in attesa di conferma umana. Chiave = relPath. */
export interface PendingWrite {
  /** Percorso relativo di destinazione finale dentro la pratica. */
  relPath: string
  /** Hash del contenuto ri-idratato in staging (rileva modifiche). */
  contentHash: string
  stagedAt: string
  /** True se la promozione puo' sostituire un file finale gia' esistente. */
  overwrite?: boolean
}

export interface WritesFile {
  version: 1
  practiceId: string
  entries: PendingWrite[]
}

export function writesPath(folderPath: string): string {
  return join(folderPath, WRITES_FILENAME)
}

export function contentHash(content: string): string {
  return `sha256:${sha256(content)}`
}

/** Carica i pending write (lista). */
export function loadPendingWrites(folderPath: string): PendingWrite[] {
  const path = writesPath(folderPath)
  if (!existsSync(path)) return []
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as WritesFile
    if (raw.version !== 1 || !Array.isArray(raw.entries)) return []
    return raw.entries
  } catch (err) {
    log.warn('Pending write illeggibili (ignorati)', {
      error: err instanceof Error ? err.message : String(err)
    })
    return []
  }
}

/** Scrive i pending write in modo atomico (tmp + rename). */
export function savePendingWrites(
  folderPath: string,
  practiceId: string,
  entries: PendingWrite[]
): void {
  const file: WritesFile = { version: 1, practiceId, entries }
  const path = writesPath(folderPath)
  const tmp = `${path}.tmp`
  writeFileSync(tmp, JSON.stringify(file, null, 2), 'utf8')
  renameSync(tmp, path)
}

/** Aggiunge/aggiorna un pending write (chiave = relPath) e persiste. */
export function recordPendingWrite(
  folderPath: string,
  practiceId: string,
  pending: PendingWrite
): void {
  const entries = loadPendingWrites(folderPath).filter((e) => e.relPath !== pending.relPath)
  entries.push(pending)
  savePendingWrites(folderPath, practiceId, entries)
  log.info('Pending write registrato', { practiceId, relPath: pending.relPath })
}

/** Rimuove un pending write (dopo la promozione) e persiste. */
export function removePendingWrite(folderPath: string, practiceId: string, relPath: string): void {
  const entries = loadPendingWrites(folderPath).filter((e) => e.relPath !== relPath)
  savePendingWrites(folderPath, practiceId, entries)
}
