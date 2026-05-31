#!/usr/bin/env node
// ============================================================
// Entrypoint del server MCP AnonyMCP (trasporto stdio).
// Uso:
//   anonymcp-server [--config ./anonymcp.config.json] [--auto-approve]
// Variabili d'ambiente:
//   ANONYMCP_CONFIG       percorso della config (alternativa a --config)
//   ANONYMCP_AUTO_APPROVE "1" per approvare automaticamente (NON consigliato
//                         per dati sensibili; bypassa la quarantena).
// ============================================================

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { loadConfig } from './config.js'
import { buildServer } from './server.js'
import { setLogLevel, log } from './util/logger.js'

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main(): Promise<void> {
  const configPath =
    argValue('--config') ?? process.env.ANONYMCP_CONFIG ?? 'anonymcp.config.json'

  const config = loadConfig(configPath)
  setLogLevel(config.logLevel)

  // Passphrase della cache cifrata (Fase 1: da env; Fase 2: keychain OS).
  // Se assente, il modello è "forward-only": coerenza pseudonimi solo in sessione.
  const cachePassphrase = process.env.ANONYMCP_CACHE_KEY || undefined
  if (!cachePassphrase) {
    log.warn('ANONYMCP_CACHE_KEY non impostata: cache pratica disabilitata (forward-only)')
  }

  const { server, registry } = buildServer(config, cachePassphrase)

  // Scansione iniziale di tutte le pratiche (i documenti vanno in quarantena
  // se requireManualApproval è attivo).
  for (const folder of config.folders) {
    try {
      const summary = await registry.scan(folder.id)
      log.info('Scansione iniziale', { folderId: folder.id, ...summary })
    } catch (err) {
      log.error('Scansione iniziale fallita', {
        folderId: folder.id,
        error: err instanceof Error ? err.message : String(err)
      })
    }
  }

  // Auto-approve opzionale (utile per Fase 1 / demo; sconsigliato in produzione).
  const autoApprove = process.argv.includes('--auto-approve') || process.env.ANONYMCP_AUTO_APPROVE === '1'
  if (autoApprove) {
    log.warn('AUTO-APPROVE attivo: i documenti sono esposti senza revisione umana')
    for (const folder of config.folders) {
      const p = registry.getPractice(folder.id)
      if (p) for (const docId of p.docs.keys()) registry.approve(folder.id, docId)
    }
  }

  const transport = new StdioServerTransport()
  await server.connect(transport)
  log.info('AnonyMCP server in ascolto su stdio')
}

main().catch((err) => {
  log.error('Avvio fallito', { error: err instanceof Error ? err.message : String(err) })
  process.exit(1)
})
