#!/usr/bin/env node
// ============================================================
// Entry point della TUI di review (Fase 1 di sviluppo).
// Uso:
//   npm run review -- --practice 400f [--config ./anonymcp.config.json]
//
// Scansiona la pratica e, per ogni documento in review_required, mostra la review
// da terminale (documento intero con entità evidenziate + lista entità + aggiunta
// manuale). All'approvazione il documento diventa esponibile via MCP e ricercabile.
//
// ⚠️ Provvisoria: la Fase 2 sarà un'app Electron grafica per gli avvocati.
// ============================================================

import { readFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { loadConfig } from '../config.js'
import { PracticeRegistry } from '../practice/practiceRegistry.js'
import { setLogLevel, log } from '../util/logger.js'
import { runReview } from './reviewApp.js'

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : undefined
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
    await reviewPendingWrites(registry, practiceId)
    registry.closeIndexes()
    return
  }

  let approvedCount = 0
  for (const doc of pending) {
    if (!doc.result) continue
    // Il testo originale viene letto dal file sorgente (già sul disco) SOLO per la
    // preview locale; non passa mai per il canale MCP.
    const originalText = safeRead(doc.filePath)
    const result = await runReview({
      practiceLabel: folder.label,
      fileName: doc.filePath.split('/').pop() ?? doc.docId,
      originalText,
      anonymizedText: doc.result.text,
      entities: doc.result.entities,
      onAddEntity: (term, type) => {
        const entity = registry.addManualEntity(practiceId, doc.docId, term, type)
        if (!entity) return null
        return { entity, anonymizedText: doc.result!.text }
      }
    })
    if (result) {
      registry.approve(practiceId, doc.docId)
      approvedCount++
    }
  }

  registry.exportDictionary(practiceId)
  process.stdout.write(
    `\nRevisione completata: ${approvedCount}/${pending.length} document${pending.length === 1 ? 'o approvato' : 'i approvati'}.\n`
  )

  // Bozze scritte dall'LLM in attesa di conferma (M-Write, ADR-0005).
  await reviewPendingWrites(registry, practiceId)
  registry.closeIndexes()
}

/**
 * Mostra le bozze scritte dall'LLM in staging e, su conferma umana, le promuove
 * dalla cartella di staging alla destinazione finale (invariante #8, ADR-0005).
 * I file in staging contengono già i valori reali (re-idratati): è qui che
 * l'avvocato decide se renderli definitivi.
 */
async function reviewPendingWrites(registry: PracticeRegistry, practiceId: string): Promise<void> {
  const pending = registry.listPendingWrites(practiceId)
  if (pending.length === 0) return

  process.stdout.write(
    `\nBozze scritte dall'assistente in attesa di conferma (${pending.length}):\n`
  )
  for (const w of pending) {
    const ok = await confirm(`  Salvare "${w.relPath}" nella pratica? [s/N] `)
    if (ok) {
      registry.promoteWrite(practiceId, w.relPath)
      process.stdout.write(`  ✓ Salvato: ${w.relPath}\n`)
    } else {
      process.stdout.write(`  · Lasciato in sospeso: ${w.relPath}\n`)
    }
  }
}

/** Domanda sì/no da terminale (default: no). */
function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((res) => {
    rl.question(question, (answer) => {
      rl.close()
      res(/^s(i|ì)?$/i.test(answer.trim()))
    })
  })
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
