// ============================================================
// pathGuard — protezione contro directory traversal e accessi fuori
// dall'allowlist delle cartelle esposte. Requisito di sicurezza della
// spec MCP ("Servers MUST validate all resource URIs").
// ============================================================

import { resolve, relative, isAbsolute, sep, basename } from 'node:path'

/** Estensioni mai esposte (artefatti AnonyMCP) anche se dentro una cartella esposta. */
const NEVER_EXPOSE = new Set(['.anonymcp', '.sqlite', '.sqlite-journal'])

/**
 * True se `child` è contenuto (in modo sicuro) dentro `parent`.
 * Risolve i path e impedisce `..`, symlink-escape testuale e prefissi ingannevoli.
 */
export function isInside(parent: string, child: string): boolean {
  const p = resolve(parent)
  const c = resolve(child)
  if (p === c) return true
  const rel = relative(p, c)
  return rel.length > 0 && !rel.startsWith('..') && !isAbsolute(rel)
}

/** True se il file è un artefatto interno da non esporre mai. */
export function isInternalArtifact(filePath: string): boolean {
  const name = basename(filePath)
  if (name.startsWith('.')) {
    // file nascosti: blocca i nostri artefatti, lascia passare il resto solo se
    // l'estensione non è nella blocklist
  }
  const dot = name.lastIndexOf('.')
  const ext = dot >= 0 ? name.slice(dot) : ''
  if (NEVER_EXPOSE.has(ext)) return true
  if (name.endsWith('.anonymcp')) return true
  return false
}

/**
 * Valida che `requestedPath` sia dentro una delle cartelle dell'allowlist
 * e non sia un artefatto interno. Ritorna il path assoluto normalizzato.
 * Lancia un errore azionabile se il percorso non è ammesso.
 */
export function assertAllowed(requestedPath: string, allowlist: string[]): string {
  const abs = resolve(requestedPath)
  if (isInternalArtifact(abs)) {
    throw new Error(`Percorso non esponibile (artefatto interno): ${basename(abs)}`)
  }
  const ok = allowlist.some((root) => isInside(root, abs))
  if (!ok) {
    throw new Error(
      `Percorso fuori dalle cartelle esposte. Aggiungi la cartella in anonymcp.config.json per consentirne l'accesso.`
    )
  }
  return abs
}

/** Sanitizza un id di cartella/documento usato negli URI (no separatori/traversal). */
export function sanitizeId(id: string): string {
  return id.replace(/[^A-Za-z0-9_\-.]/g, '_').replace(new RegExp(`\\${sep}`, 'g'), '_')
}
