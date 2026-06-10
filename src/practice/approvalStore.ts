// ============================================================
// approvalStore — stato di approvazione persistito su disco, condiviso tra la
// TUI di review e il server MCP (processi separati). Vedi council 2026-06-01.
//
// Problema risolto: l'approvazione (review_required → approved) viveva solo in
// RAM. La TUI e il server di Claude Desktop sono processi distinti: senza
// persistenza, l'approvazione fatta nella TUI non era vista dal server.
//
// CHIAVE = sourceHash del file (hash del contenuto). È deterministico tra processi,
// a differenza del docId (HMAC con idKey casuale per sessione, non correlabile).
// Così la TUI e il server — pur avendo docId diversi per lo stesso file —
// condividono l'approvazione tramite l'hash del contenuto. Se il file cambia,
// l'hash cambia e l'approvazione decade automaticamente (torna in review).
// Niente PII: solo hash del contenuto. Vedi ADR-0001 (at-rest non prioritario).
// ============================================================

import { readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { sha256 } from '../util/crypto.js'
import { log } from '../util/logger.js'

/** Nome file dello stato di approvazione dentro la cartella della pratica. */
export const APPROVAL_FILENAME = 'pratica.approvals.json'

/** Stato di un documento approvato (persistito). Chiave = sourceHash. */
export interface ApprovalEntry {
  /** Hash del contenuto del file al momento dell'approvazione (chiave stabile). */
  sourceHash: string
  approvedAt: string
  /**
   * Conferma esplicita del rischio residuo contestuale (RT-06, ADR-0008).
   * Richiesta quando residualRisk >= RISK_BLOCK_THRESHOLD al momento
   * dell'approvazione. Le approvazioni storiche senza flag NON valgono per
   * documenti ad alto rischio: decadono in review (fail-closed).
   */
  residualRiskAccepted?: boolean
}

export interface ApprovalFile {
  version: 1
  practiceId: string
  entries: ApprovalEntry[]
}

/** Percorso del file di stato per una cartella pratica. */
export function approvalPath(folderPath: string): string {
  return join(folderPath, APPROVAL_FILENAME)
}

/** Hash del contenuto di un file (per legare l'approvazione alla versione approvata). */
export function fileSourceHash(content: string): string {
  return `sha256:${sha256(content)}`
}

/** Carica lo stato di approvazione. Ritorna una mappa sourceHash → entry. */
export function loadApprovals(folderPath: string): Map<string, ApprovalEntry> {
  const path = approvalPath(folderPath)
  if (!existsSync(path)) return new Map()
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as ApprovalFile
    if (raw.version !== 1 || !Array.isArray(raw.entries)) return new Map()
    return new Map(
      raw.entries
        .filter((e) => typeof e?.sourceHash === 'string')
        .map((e) => [e.sourceHash, e])
    )
  } catch (err) {
    log.warn('Stato approvazione illeggibile (ignorato)', {
      error: err instanceof Error ? err.message : String(err)
    })
    return new Map()
  }
}

/** Scrive lo stato di approvazione in modo atomico (write su tmp + rename). */
export function saveApprovals(
  folderPath: string,
  practiceId: string,
  approvals: Map<string, ApprovalEntry>
): void {
  const file: ApprovalFile = { version: 1, practiceId, entries: [...approvals.values()] }
  const path = approvalPath(folderPath)
  const tmp = `${path}.tmp`
  writeFileSync(tmp, JSON.stringify(file, null, 2), 'utf8')
  renameSync(tmp, path) // atomico: nessun lettore vede un file a metà
}

/**
 * Registra l'approvazione di un documento (idempotente) e persiste, usando il
 * sourceHash come chiave stabile tra processi (TUI ↔ server). L'eventuale
 * conferma del rischio residuo viene persistita con l'entry (RT-06).
 */
export function recordApproval(
  folderPath: string,
  practiceId: string,
  sourceHash: string,
  options: { residualRiskAccepted?: boolean } = {}
): void {
  const approvals = loadApprovals(folderPath)
  const existing = approvals.get(sourceHash)
  approvals.set(sourceHash, {
    sourceHash,
    approvedAt: existing?.approvedAt ?? new Date().toISOString(),
    ...(options.residualRiskAccepted || existing?.residualRiskAccepted
      ? { residualRiskAccepted: true }
      : {})
  })
  saveApprovals(folderPath, practiceId, approvals)
  log.info('Approvazione persistita', { practiceId })
}

/**
 * True se il sourceHash corrente del documento risulta approvato. Se il file è
 * cambiato, il suo hash non sarà nella mappa → l'approvazione è decaduta.
 * Con `requireRiskAck` l'approvazione vale solo se è stata registrata con la
 * conferma esplicita del rischio residuo (RT-06): le approvazioni storiche
 * senza flag decadono fail-closed.
 */
export function isApproved(
  approvals: Map<string, ApprovalEntry>,
  currentSourceHash: string,
  options: { requireRiskAck?: boolean } = {}
): boolean {
  const entry = approvals.get(currentSourceHash)
  if (!entry) return false
  if (options.requireRiskAck) return entry.residualRiskAccepted === true
  return true
}
