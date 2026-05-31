// ============================================================
// documentService — orchestra la pipeline per un singolo documento:
//   read → strip metadati → canonicalizza (sanitize) → pseudonimizza
//   → classifica sensibilità → calcola rischio residuo.
// Produce un AnonymizationResult sicuro da esporre.
// ============================================================

import { readFileSync } from 'node:fs'
import type { AnonymizationResult } from '../types.js'
import { isTextDocument, isSupported, textToCanonical } from './toMarkdown.js'
import { stripTextMetadata } from './metadataStripper.js'
import { detectEntities, applyPseudonyms, type NerFn } from '../engine/anonymizer.js'
import { SessionManager } from '../engine/sessionManager.js'
import { classifySensitivity, residualRisk } from './riskScorer.js'
import { sha256 } from '../util/crypto.js'

export interface ProcessOptions {
  ner?: NerFn
  session?: SessionManager
}

/**
 * Pseudonimizza un documento già letto come testo grezzo.
 * Separato dalla lettura per essere testabile senza filesystem.
 */
export async function processText(
  raw: string,
  options: ProcessOptions = {}
): Promise<AnonymizationResult & { sourceHash: string }> {
  const sourceHash = `sha256:${sha256(raw)}`

  // 1. Strip metadati testuali (autore, path di rete, ecc.).
  const stripped = stripTextMetadata(raw)
  // 2. Canonicalizza/sanitizza (rimuove HTML/link/frontmatter, de-frammenta).
  const canonical = textToCanonical(stripped)
  // 3. Pseudonimizza.
  const { entities } = await detectEntities(canonical, options)
  const text = applyPseudonyms(canonical, entities)
  // 4. Classifica sensibilità sul testo ORIGINALE (più segnali) e rischio sul testo finale.
  const sensitivity = classifySensitivity(raw)
  const risk = residualRisk(text, entities)

  return { text, entities, sensitive: sensitivity.sensitive, residualRisk: risk, sourceHash }
}

/** Legge e processa un documento testuale dal filesystem (Fase 1). */
export async function processFile(
  filePath: string,
  options: ProcessOptions = {}
): Promise<AnonymizationResult & { sourceHash: string }> {
  if (!isSupported(filePath)) {
    throw new Error(`Formato non supportato: ${filePath}`)
  }
  if (!isTextDocument(filePath)) {
    throw new Error(
      `Formato binario (${filePath}) non gestito in Fase 1. PDF/DOCX/OCR arrivano in Fase 2 con i parser nativi (pdf.js/mammoth/tesseract).`
    )
  }
  const raw = readFileSync(filePath, 'utf8')
  return processText(raw, options)
}
