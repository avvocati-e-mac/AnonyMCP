// ============================================================
// Caricamento e validazione della config (anonymcp.config.json).
// ============================================================

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { z } from 'zod'
import type { AnonyMcpConfig } from './types.js'

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
  return config
}

/** Elenco dei percorsi assoluti delle cartelle esposte (allowlist). */
export function allowlistPaths(config: AnonyMcpConfig): string[] {
  return config.folders.map((f) => f.path)
}
