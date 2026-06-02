// ============================================================
// Caricamento e validazione della config (anonymcp.config.json).
// ============================================================

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { z } from 'zod'
import type { AnonyMcpConfig, ExposedFolder } from './types.js'
import { log } from './util/logger.js'

const FolderSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  path: z.string().min(1),
  matter: z.enum(['civile', 'penale', 'tributario', 'amministrativo', 'altro']).optional()
})

const ConfigSchema = z.object({
  version: z.literal(1),
  folders: z.array(FolderSchema).default([]),
  requireManualApproval: z.boolean().default(true),
  allowCloudForSensitive: z.boolean().default(false),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info')
})

/** Carica e valida la config dal percorso dato. Lancia errori azionabili. */
export function loadConfig(configPath: string): AnonyMcpConfig {
  const abs = resolve(configPath)
  if (!existsSync(abs)) {
    throw new Error(
      `Config non trovata: ${abs}. Copia anonymcp.config.example.json in anonymcp.config.json e indica le cartelle da esporre.`
    )
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(abs, 'utf8'))
  } catch (err) {
    throw new Error(`Config JSON non valida (${abs}): ${err instanceof Error ? err.message : err}`)
  }
  const result = ConfigSchema.safeParse(parsed)
  if (!result.success) {
    throw new Error(`Config non valida: ${result.error.issues.map((i) => i.message).join('; ')}`)
  }
  const config = result.data
  // Normalizza i percorsi delle cartelle ad assoluti.
  config.folders = config.folders.map((f) => ({ ...f, path: resolve(f.path) }))
  // Avvisa se un label di pratica sembra contenere nomi delle parti (ADR-0004):
  // il label è esposto all'LLM via list_folders → userà un numero opaco (es. "400F").
  for (const folder of config.folders) {
    if (folderIdLooksIdentifying(folder.id)) {
      log.warn(
        `Id pratica "${folder.id}" sembra contenere informazioni identificanti. ` +
          'Il folderId è esposto all\'LLM negli URI e in list_folders: usa un numero opaco ' +
          '(es. "400F"). Vedi ADR-0004.',
        { folderId: folder.id }
      )
    }
    if (labelLooksLikePersonName(folder.label)) {
      log.warn(
        `Label pratica "${folder.label}" sembra contenere nomi di persona. ` +
          'Il label è esposto all\'LLM: usa un numero di pratica opaco (es. "400F") ' +
          'per non rivelare le parti. Vedi ADR-0004.',
        { folderId: folder.id }
      )
    }
  }
  return config
}

/**
 * Euristica per il folderId: l'id e' ancora piu' delicato del label perche'
 * entra negli URI MCP. Accetta id numerici/opachi, avvisa su pattern tipo
 * "rossi-c-bianchi", "mario_rossi", "causa-rossi-bianchi".
 */
export function folderIdLooksIdentifying(id: string): boolean {
  const normalized = id.trim().toLowerCase()
  if (!normalized) return false
  if (labelLooksLikePersonName(id)) return true
  if (/(^|[-_.\s])(c|contro|vs|versus)([-_.\s]|$)/i.test(normalized)) {
    return /[a-zà-ÿ]{3,}/i.test(normalized)
  }
  const generic = new Set([
    'causa',
    'pratica',
    'fascicolo',
    'test',
    'demo',
    'civile',
    'penale',
    'tributario',
    'amministrativo',
    'rg',
    'cv',
    'p'
  ])
  const words = normalized
    .split(/[^a-zà-ÿ]+/i)
    .filter((w) => w.length >= 3 && !generic.has(w))
  return words.length >= 2
}

/**
 * Euristica: il label sembra un nome di persona/causa identificabile?
 * Riconosce pattern come "Rossi c. Bianchi", "Mario Rossi", "Studio Verdi".
 * Conservativa: meglio un warning in più che un leak silenzioso. Vedi ADR-0004.
 */
export function labelLooksLikePersonName(label: string): boolean {
  const trimmed = label.trim()
  // "X c. Y" / "X contro Y" — citazione tipica di una causa con le parti.
  if (/\b(c\.|contro)\b/i.test(trimmed) && /[A-ZÀ-Ý][a-zà-ÿ]+/.test(trimmed)) return true
  // Due o più parole capitalizzate consecutive (es. "Mario Rossi", "Studio Legale Verdi).
  const capitalizedWords = trimmed.match(/\b[A-ZÀ-Ý][a-zà-ÿ]{2,}\b/g) ?? []
  if (capitalizedWords.length >= 2) return true
  return false
}

/** Elenco dei percorsi assoluti delle cartelle esposte (allowlist). */
export function allowlistPaths(config: AnonyMcpConfig): string[] {
  return config.folders.map((f) => f.path)
}
