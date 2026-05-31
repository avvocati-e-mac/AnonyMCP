// ============================================================
// Motore di pseudonimizzazione (regex + co-reference + veto filter).
// La componente NER (BERT/ONNX) è iniettabile: in Fase 1 il default è
// solo-regex (deterministico, testabile). Una NerFn può essere fornita
// per arricchire il recall in modo opzionale.
// ============================================================

import type { DetectedEntity, EntityType } from '../types.js'
import { REGEX_PATTERNS, STRUCTURED_LEGAL_PATTERNS } from './regexPatterns.js'
import { LEGAL_STOP_WORDS, LEGAL_SECTION_HEADERS } from './legalStopWords.js'
import { SessionManager } from './sessionManager.js'

/** Funzione NER opzionale: dato il testo, ritorna entità candidate. */
export type NerFn = (text: string) => Promise<RawEntity[]> | RawEntity[]

/** Entità grezza (prima di pseudonimo e dedup). */
export interface RawEntity {
  type: EntityType
  text: string
  source: DetectedEntity['source']
}

/** Normalizza una stringa per il confronto col veto filter. */
function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * True se l'entità NER va scartata perché è in realtà un ruolo processuale
 * o un'intestazione di sezione (falso positivo tipico del BERT).
 * Applicato SOLO alle entità di source 'ner'.
 */
export function isVetoed(text: string): boolean {
  const n = normalize(text)
  if (LEGAL_SECTION_HEADERS.has(n)) return true
  // Veto se ogni token è uno stop-word giuridico.
  const tokens = n.split(' ')
  return tokens.every((t) => LEGAL_STOP_WORDS.has(t))
}

/** Estrae le entità via i pattern regex (formali + contestuali legali). */
export function extractRegexEntities(text: string): RawEntity[] {
  const out: RawEntity[] = []
  const all = [
    ...REGEX_PATTERNS.map((p) => ({ ...p, source: 'regex' as const })),
    ...STRUCTURED_LEGAL_PATTERNS.map((p) => ({ ...p, source: 'regex' as const }))
  ]
  for (const { type, pattern } of all) {
    // Clona il regex per resettare lastIndex (i pattern sono globali e condivisi).
    const re = new RegExp(pattern.source, pattern.flags)
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      // Usa il primo gruppo di cattura non vuoto, altrimenti l'intero match.
      const captured = m.slice(1).find((g) => g != null && g !== '') ?? m[0]
      const value = captured.trim()
      if (value.length > 1) out.push({ type, text: value, source: 'regex' })
      if (m.index === re.lastIndex) re.lastIndex++ // evita loop su match vuoti
    }
  }
  return out
}

/**
 * Co-reference semplice: se "Mario Rossi" è un'entità PERSONA, anche le
 * occorrenze isolate del cognome "Rossi" ricevono lo stesso pseudonimo.
 */
function addCoreferences(text: string, entities: RawEntity[]): RawEntity[] {
  const extra: RawEntity[] = []
  const persons = entities.filter((e) => e.type === 'PERSONA' && e.text.includes(' '))
  for (const p of persons) {
    const parts = p.text.split(/\s+/)
    const surname = parts[parts.length - 1]!
    if (surname.length < 3) continue
    const re = new RegExp(`\\b${surname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g')
    if (re.test(text)) extra.push({ type: 'PERSONA', text: surname, source: 'coref' })
  }
  return extra
}

/** Deduplica le entità per (tipo, testo normalizzato), tenendo la prima source. */
function dedupe(entities: RawEntity[]): RawEntity[] {
  const seen = new Map<string, RawEntity>()
  for (const e of entities) {
    const key = `${e.type}::${normalize(e.text)}`
    if (!seen.has(key)) seen.set(key, e)
  }
  return [...seen.values()]
}

export interface DetectOptions {
  /** Funzione NER opzionale (BERT/ONNX). Default: nessuna (solo regex). */
  ner?: NerFn
  /** SessionManager esistente (per coerenza tra documenti della stessa pratica). */
  session?: SessionManager
}

/**
 * Rileva le entità in un testo e assegna pseudonimi coerenti.
 * Pipeline: regex + (NER opz., con veto filter) + co-reference → dedup → pseudonimi.
 */
export async function detectEntities(
  text: string,
  options: DetectOptions = {}
): Promise<{ entities: DetectedEntity[]; session: SessionManager }> {
  const session = options.session ?? new SessionManager()

  const raw: RawEntity[] = [...extractRegexEntities(text)]

  if (options.ner) {
    const nerEntities = await options.ner(text)
    for (const e of nerEntities) {
      if (e.source === 'ner' && isVetoed(e.text)) continue
      raw.push(e)
    }
  }

  raw.push(...addCoreferences(text, raw))

  const unique = dedupe(raw)

  const entities: DetectedEntity[] = unique.map((e) => {
    const pseudonym = session.getOrCreatePseudonym(e.text, e.type)
    const occurrences = countOccurrences(text, e.text)
    return { type: e.type, originalText: e.text, pseudonym, occurrences, source: e.source }
  })

  return { entities, session }
}

/** Conta le occorrenze (case-insensitive) di un valore nel testo. */
export function countOccurrences(text: string, value: string): number {
  if (!value) return 0
  const re = new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
  return (text.match(re) ?? []).length
}

/**
 * Applica la sostituzione: ogni `originalText` → `pseudonym` nel testo.
 * Sostituisce le occorrenze più lunghe prima (evita sostituzioni parziali).
 */
export function applyPseudonyms(text: string, entities: DetectedEntity[]): string {
  let result = text
  const ordered = [...entities].sort((a, b) => b.originalText.length - a.originalText.length)
  for (const e of ordered) {
    const re = new RegExp(e.originalText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
    result = result.replace(re, e.pseudonym)
  }
  return result
}
