#!/usr/bin/env node
// ============================================================
// Entry point della TUI di review (Fase 1 di sviluppo).
// Uso:
//   npm run review -- --practice 400f [--config ./anonymcp.config.json]
//
// Scansiona la pratica e, per ogni documento in review_required, mostra la TUI
// (lista entità colorata + anteprima originale/anonimizzato). All'approvazione
// il documento diventa esponibile via MCP e ricercabile via BM25.
//
// ⚠️ Provvisoria: la Fase 2 sarà un'app Electron grafica per gli avvocati.
// ============================================================

import { readFileSync } from 'node:fs'
import React from 'react'
import { render } from 'ink'
import { loadConfig } from '../config.js'
import { PracticeRegistry } from '../practice/practiceRegistry.js'
import { setLogLevel, log } from '../util/logger.js'
import { ReviewApp } from './reviewApp.js'
import type { DetectedEntity } from '../types.js'

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : undefined
}

/** Mostra la TUI per un singolo documento e risolve con le entità confermate (o null se annullato). */
function reviewOne(props: {
  practiceLabel: string
  fileName: string
  originalText: string
  anonymizedText: string
  entities: DetectedEntity[]
}): Promise<DetectedEntity[] | null> {
  return new Promise((resolve) => {
    const { unmount } = render(
      React.createElement(ReviewApp, {
        ...props,
        onApprove: (confirmed) => {
          unmount()
          resolve(confirmed)
        },
        onCancel: () => {
          unmount()
          resolve(null)
        }
      })
    )
  })
}

async function main(): Promise<void> {
  const practiceId = argValue('--practice')
  if (!practiceId) {
    process.stderr.write('Uso: npm run review -- --practice <id> [--config <path>]\n')
    process.exit(2)
  }

  const configPath = argValue('--config') ?? process.env.ANONYMCP_CONFIG ?? 'anonymcp.config.json'
  const config = loadConfig(configPath)
  setLogLevel('warn') // meno rumore durante la review interattiva

  const folder = config.folders.find((f) => f.id === practiceId)
  if (!folder) {
    process.stderr.write(`Pratica "${practiceId}" non trovata nella config.\n`)
    process.exit(2)
  }

  const cachePassphrase = process.env.ANONYMCP_CACHE_KEY || undefined
  const registry = new PracticeRegistry(config.folders, config.requireManualApproval, cachePassphrase)
  await registry.scan(practiceId)

  const practice = registry.getPractice(practiceId)!
  const pending = [...practice.docs.values()].filter((d) => d.status === 'review_required')

  if (pending.length === 0) {
    process.stdout.write('Nessun documento da revisionare. Tutto già approvato.\n')
    registry.closeIndexes()
    return
  }

  let approvedCount = 0
  for (const doc of pending) {
    if (!doc.result) continue
    // Il testo originale viene letto dal file sorgente (già sul disco) SOLO per la
    // preview locale; non passa mai per il canale MCP.
    const originalText = safeRead(doc.filePath)
    const confirmed = await reviewOne({
      practiceLabel: folder.label,
      fileName: doc.filePath.split('/').pop() ?? doc.docId,
      originalText,
      anonymizedText: doc.result.text,
      entities: doc.result.entities
    })
    if (confirmed) {
      registry.approve(practiceId, doc.docId)
      approvedCount++
    }
  }

  registry.exportDictionary(practiceId)
  registry.closeIndexes()
  process.stdout.write(
    `\nRevisione completata: ${approvedCount}/${pending.length} document${pending.length === 1 ? 'o approvato' : 'i approvati'}.\n`
  )
}

function safeRead(path: string): string {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return '(impossibile leggere il file sorgente)'
  }
}

main().catch((err) => {
  log.error('TUI review fallita', { error: err instanceof Error ? err.message : String(err) })
  process.exit(1)
})
