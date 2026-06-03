// ============================================================
// writeService — logica pura (testabile senza MCP) per M-Write:
// salvare nella cartella di pratica le bozze TESTUALI prodotte dall'LLM,
// re-idratate (pseudonimo→reale) e con tutte le guardie di sicurezza.
// Vedi ADR-0005.
//
// L'LLM non tocca mai il disco: passa folderId opaco + relPath + content.
// Qui validiamo il path (dentro la pratica), l'estensione (allowlist testuale),
// ri-idratiamo il contenuto e decidiamo dove scrivere (staging o destinazione).
// ============================================================

import { existsSync, lstatSync, realpathSync } from 'node:fs'
import { resolve, join, extname, basename, isAbsolute, relative } from 'node:path'
import { isInside, isInternalArtifact } from '../util/pathGuard.js'
import type { SessionManager, RehydrationResult } from '../engine/sessionManager.js'

/** Estensioni testuali consentite alla scrittura (ADR-0005). Niente binari/eseguibili. */
export const WRITABLE_EXTENSIONS = new Set([
  '.md',
  '.markdown',
  '.txt',
  '.tex',
  '.csv',
  '.json',
  '.xml',
  '.html'
])

/** Sottocartella di staging (artefatto: mai esposta come resource). */
export const STAGING_DIRNAME = '.anonymcp-staging'

export interface PreparedWrite {
  /** Path assoluto di destinazione finale (validato dentro la pratica). */
  absTarget: string
  /** Contenuto già re-idratato, pronto da scrivere. */
  rehydrated: RehydrationResult
}

/**
 * Valida `relPath` come percorso di scrittura sicuro dentro `folderPath`.
 * Lancia un errore azionabile (invariante #9) se non ammesso. Ritorna l'abs path.
 */
export function resolveWriteTarget(folderPath: string, relPath: string): string {
  const trimmed = relPath.trim()
  if (!trimmed) {
    throw new Error('Percorso vuoto: indica un percorso relativo, es. "Ricerche/bozza.md".')
  }
  // Path assoluto rifiutato esplicitamente: join() non lo normalizza come tale.
  if (isAbsolute(trimmed)) {
    throw new Error('Percorso assoluto non ammesso: usa un percorso relativo dentro la pratica.')
  }
  // Nessun segmento nascosto/artefatto.
  if (trimmed.split(/[\\/]/).some((seg) => seg.startsWith('.') && seg !== '')) {
    throw new Error('Percorso non ammesso: i segmenti non possono iniziare con "." (artefatti).')
  }
  const absTarget = resolve(join(folderPath, trimmed))
  if (!isInside(folderPath, absTarget)) {
    throw new Error(
      'Percorso fuori dalla cartella della pratica (no "..", no path assoluti). Usa un percorso relativo interno.'
    )
  }
  if (isInternalArtifact(absTarget)) {
    throw new Error(`Nome non ammesso (artefatto interno): ${basename(absTarget)}.`)
  }
  assertNoSymlinkEscape(folderPath, absTarget)
  return absTarget
}

function assertNoSymlinkEscape(folderPath: string, absTarget: string): void {
  const root = resolve(folderPath)
  const rootReal = realpathSync(root)
  let current = root
  const parts = relative(root, absTarget).split(/[\\/]+/).filter(Boolean)

  for (const part of parts) {
    current = join(current, part)
    if (!existsSync(current)) return
    if (lstatSync(current).isSymbolicLink()) {
      throw new Error('Percorso non ammesso: contiene un link simbolico.')
    }
    if (!isInside(rootReal, realpathSync(current))) {
      throw new Error('Percorso fuori dalla cartella della pratica tramite link simbolico.')
    }
  }
}

/** True se l'estensione è nella allowlist testuale. */
export function isWritableExtension(filePath: string): boolean {
  return WRITABLE_EXTENSIONS.has(extname(filePath).toLowerCase())
}

/**
 * Prepara una scrittura: valida path + estensione e ri-idrata il contenuto.
 * NON scrive su disco (lo fa il chiamante, che decide staging vs destinazione).
 */
export function prepareWrite(
  folderPath: string,
  relPath: string,
  content: string,
  session: SessionManager
): PreparedWrite {
  const absTarget = resolveWriteTarget(folderPath, relPath)
  if (!isWritableExtension(absTarget)) {
    throw new Error(
      `Estensione non consentita. M-Write salva solo file testuali (${[...WRITABLE_EXTENSIONS].join(', ')}). I formati binari (.docx/.pdf) arrivano in una milestone successiva.`
    )
  }
  const rehydrated = session.rehydrate(content)
  return { absTarget, rehydrated }
}

/**
 * Valida `relPath` come sottocartella creabile dentro la pratica.
 * Ritorna l'abs path (la creazione vera la fa il chiamante).
 */
export function resolveFolderTarget(folderPath: string, relPath: string): string {
  return resolveWriteTarget(folderPath, relPath)
}

/** Percorso di staging corrispondente a una destinazione finale. */
export function stagingPathFor(folderPath: string, absTarget: string): string {
  const rel = absTarget.slice(folderPath.length).replace(/^[\\/]+/, '')
  return resolve(join(folderPath, STAGING_DIRNAME, rel))
}
