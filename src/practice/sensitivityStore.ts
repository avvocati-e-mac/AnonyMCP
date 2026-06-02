// ============================================================
// sensitivityStore — decisioni locali dell'avvocato sui documenti sensibili.
//
// AnonyMCP suggerisce la sensibilita' con il classificatore locale, ma la
// decisione finale resta umana. Lo store persiste solo hash e metadati minimi:
// niente nomi file, percorsi, parti o motivazioni potenzialmente identificanti.
// ============================================================

import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { SensitivityOverride } from '../types.js'
import { log } from '../util/logger.js'

export const SENSITIVITY_FILENAME = 'pratica.sensitivity.json'

export interface SensitivityDecision {
  /** Hash del contenuto sorgente; invalida la decisione se il file cambia. */
  sourceHash: string
  decision: SensitivityOverride
  decidedAt: string
}

export interface SensitivityFile {
  version: 1
  practiceId: string
  entries: SensitivityDecision[]
}

export function sensitivityPath(folderPath: string): string {
  return join(folderPath, SENSITIVITY_FILENAME)
}

export function loadSensitivityDecisions(folderPath: string): SensitivityDecision[] {
  const path = sensitivityPath(folderPath)
  if (!existsSync(path)) return []
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as SensitivityFile
    if (raw.version !== 1 || !Array.isArray(raw.entries)) return []
    return raw.entries.filter(
      (entry): entry is SensitivityDecision =>
        typeof entry.sourceHash === 'string' &&
        (entry.decision === 'sensitive' || entry.decision === 'not_sensitive') &&
        typeof entry.decidedAt === 'string'
    )
  } catch (err) {
    log.warn('Decisioni sensibilita illeggibili (ignorate)', {
      error: err instanceof Error ? err.message : String(err)
    })
    return []
  }
}

export function getSensitivityDecision(
  entries: SensitivityDecision[],
  sourceHash: string
): SensitivityOverride | undefined {
  return entries.find((entry) => entry.sourceHash === sourceHash)?.decision
}

export function saveSensitivityDecisions(
  folderPath: string,
  practiceId: string,
  entries: SensitivityDecision[]
): void {
  const file: SensitivityFile = { version: 1, practiceId, entries }
  const path = sensitivityPath(folderPath)
  const tmp = `${path}.tmp`
  writeFileSync(tmp, JSON.stringify(file, null, 2), 'utf8')
  renameSync(tmp, path)
}

export function recordSensitivityDecision(
  folderPath: string,
  practiceId: string,
  sourceHash: string,
  decision: SensitivityOverride
): void {
  const entries = loadSensitivityDecisions(folderPath).filter((entry) => entry.sourceHash !== sourceHash)
  entries.push({ sourceHash, decision, decidedAt: new Date().toISOString() })
  saveSensitivityDecisions(folderPath, practiceId, entries)
  log.info('Decisione sensibilita registrata', { practiceId, decision })
}

export function removeSensitivityDecision(
  folderPath: string,
  practiceId: string,
  sourceHash: string
): void {
  const entries = loadSensitivityDecisions(folderPath).filter((entry) => entry.sourceHash !== sourceHash)
  saveSensitivityDecisions(folderPath, practiceId, entries)
  log.info('Decisione sensibilita rimossa', { practiceId })
}
