// ============================================================
// folderImport - scoperta cartelle pratica e assegnazione ID opachi.
//
// Serve alla UI Electron di primo setup: manuale, cartella "Pratiche",
// oppure struttura Clienti -> Pratiche. Non espone dati al canale MCP.
// ============================================================

import { readdirSync, statSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { folderIdLooksIdentifying, labelLooksLikePersonName } from '../config.js'
import type { ExposedFolder, LegalMatter } from '../types.js'

export type FolderImportMode = 'manual' | 'practices_root' | 'clients_root'

export interface PracticeCandidate {
  path: string
  name: string
  createdAtMs: number
}

export interface BuildFoldersOptions {
  existingFolders?: ExposedFolder[]
  matter?: LegalMatter
}

function dirCandidate(path: string): PracticeCandidate | null {
  try {
    const abs = resolve(path)
    const stat = statSync(abs)
    if (!stat.isDirectory()) return null
    return {
      path: abs,
      name: basename(abs),
      createdAtMs: stat.birthtimeMs || stat.mtimeMs
    }
  } catch {
    return null
  }
}

function childDirs(root: string): PracticeCandidate[] {
  const rootAbs = resolve(root)
  let names: string[]
  try {
    names = readdirSync(rootAbs)
  } catch {
    return []
  }
  return names
    .map((name) => dirCandidate(resolve(rootAbs, name)))
    .filter((candidate): candidate is PracticeCandidate => candidate != null)
}

export function discoverPracticeFolders(paths: string[], mode: FolderImportMode): PracticeCandidate[] {
  const candidates =
    mode === 'manual'
      ? paths.map(dirCandidate).filter((candidate): candidate is PracticeCandidate => candidate != null)
      : mode === 'practices_root'
        ? paths.flatMap(childDirs)
        : paths.flatMap((root) => childDirs(root).flatMap((clientDir) => childDirs(clientDir.path)))

  const seen = new Set<string>()
  return candidates
    .filter((candidate) => {
      if (seen.has(candidate.path)) return false
      seen.add(candidate.path)
      return true
    })
    .sort((a, b) => a.createdAtMs - b.createdAtMs || a.path.localeCompare(b.path))
}

function safeOpaqueName(name: string): string | null {
  const compact = name.trim().replace(/\s+/g, '-')
  if (!compact || compact.length > 48) return null
  if (!/^[A-Za-z0-9._-]+$/.test(compact)) return null
  if (!/\d/.test(compact)) return null
  if (folderIdLooksIdentifying(name) || labelLooksLikePersonName(name)) return null
  return compact
}

function nextNumericId(usedIds: Set<string>): string {
  let n = 1
  while (usedIds.has(String(n))) n += 1
  return String(n)
}

export function buildExposedFolders(
  candidates: PracticeCandidate[],
  options: BuildFoldersOptions = {}
): ExposedFolder[] {
  const existingFolders = options.existingFolders ?? []
  const usedIds = new Set(existingFolders.map((folder) => folder.id))
  const usedPaths = new Set(existingFolders.map((folder) => resolve(folder.path)))
  const out: ExposedFolder[] = []

  for (const candidate of [...candidates].sort((a, b) => a.createdAtMs - b.createdAtMs || a.path.localeCompare(b.path))) {
    if (usedPaths.has(candidate.path)) continue
    const opaqueName = safeOpaqueName(candidate.name)
    const id = opaqueName && !usedIds.has(opaqueName) ? opaqueName : nextNumericId(usedIds)
    usedIds.add(id)
    usedPaths.add(candidate.path)
    out.push({
      id,
      label: id,
      path: candidate.path,
      matter: options.matter ?? 'altro'
    })
  }

  return out
}
