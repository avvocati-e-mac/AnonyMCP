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
  /** Offset di inizio nel testo (se noto). Usato per risolvere le sovrapposizioni. */
  start?: number
}

/**
 * Priorità di tipo per risolvere sovrapposizioni a parità di span: un valore
 * più alto vince. Gli identificatori formali con checksum/struttura forte
 * battono quelli più deboli (es. un CF di 16 char non va spezzato in PIVA).
 */
const TYPE_PRIORITY: Partial<Record<EntityType, number>> = {
  CODICE_FISCALE: 10,
  IBAN: 9,
  PEC: 8,
  EMAIL: 7,
  PARTITA_IVA: 6,
  NUMERO_RUOLO: 5,
  PROTOCOLLO: 4,
  TELEFONO: 3
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
      if (value.length > 1) {
        // Offset del valore catturato dentro il testo (per risolvere overlap).
        const within = m[0].indexOf(captured)
        const start = m.index + (within >= 0 ? within : 0)
        out.push({ type, text: value, source: 'regex', start })
      }
      if (m.index === re.lastIndex) re.lastIndex++ // evita loop su match vuoti
    }
  }
  return out
}

/**
 * Co-reference semplice: se "Mario Rossi" è un'entità PERSONA, mappa anche le
 * occorrenze isolate del cognome "Rossi" allo STESSO pseudonimo del nome completo.
 * Ritorna le coppie (cognome → testo-canonico-pieno) da collegare.
 *
 * Guard anti-falso-merge (ADR-0005): se lo STESSO cognome è suffisso di PIÙ persone
 * distinte ("Mario Rossi" e "Anna Rossi"), NON si emette la coppia. Attribuire quel
 * cognome a un nome a caso scriverebbe il nome SBAGLIATO in una bozza ri-idratata:
 * meglio lasciarlo pseudonimizzato come entità a sé (sarà segnalato come ambiguo).
 */
function findCoreferences(text: string, entities: RawEntity[]): { surname: string; canonical: string }[] {
  const persons = entities.filter((e) => e.type === 'PERSONA' && e.text.includes(' '))

  // Conta quante PERSONA distinte condividono ciascun cognome.
  const fullNamesBySurname = new Map<string, Set<string>>()
  for (const p of persons) {
    const surname = p.text.split(/\s+/).pop()!.toLowerCase()
    const set = fullNamesBySurname.get(surname) ?? new Set<string>()
    set.add(p.text.trim().toLowerCase())
    fullNamesBySurname.set(surname, set)
  }

  const out: { surname: string; canonical: string }[] = []
  const seen = new Set<string>()
  for (const p of persons) {
    const parts = p.text.split(/\s+/)
    const surname = parts[parts.length - 1]!
    if (surname.length < 3) continue
    // Cognome condiviso da >1 persona distinta → ambiguo, niente co-reference.
    if ((fullNamesBySurname.get(surname.toLowerCase())?.size ?? 0) > 1) continue
    if (seen.has(surname.toLowerCase())) continue
    // NB: niente flag 'g' — `.test()` su un regex globale è stateful (lastIndex).
    const re = new RegExp(`\\b${surname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
    if (re.test(text)) {
      out.push({ surname, canonical: p.text })
      seen.add(surname.toLowerCase())
    }
  }
  return out
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

/**
 * Risolve le sovrapposizioni tra entità con offset noto: se lo span di una è
 * contenuto in quello di un'altra, scarta quella contenuta (longest-match).
 * A parità di span vince il tipo a priorità più alta (es. CF batte PARTITA_IVA
 * su uno stesso numero). Le entità senza offset (NER/coref) non vengono toccate.
 */
export function resolveOverlaps(entities: RawEntity[]): RawEntity[] {
  const withPos = entities.filter((e) => e.start != null)
  const withoutPos = entities.filter((e) => e.start == null)

  const dropped = new Set<number>()
  for (let i = 0; i < withPos.length; i++) {
    for (let j = 0; j < withPos.length; j++) {
      if (i === j || dropped.has(i) || dropped.has(j)) continue
      const a = withPos[i]!
      const b = withPos[j]!
      const aStart = a.start!
      const aEnd = aStart + a.text.length
      const bStart = b.start!
      const bEnd = bStart + b.text.length
      const overlap = aStart < bEnd && bStart < aEnd
      if (!overlap) continue
      // a contiene b (più lungo) → scarta b; a parità di span, decide la priorità.
      const aLen = a.text.length
      const bLen = b.text.length
      if (aLen > bLen) dropped.add(j)
      else if (bLen > aLen) dropped.add(i)
      else {
        const pa = TYPE_PRIORITY[a.type] ?? 0
        const pb = TYPE_PRIORITY[b.type] ?? 0
        if (pa >= pb) dropped.add(j)
        else dropped.add(i)
      }
    }
  }
  return [...withPos.filter((_, idx) => !dropped.has(idx)), ...withoutPos]
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

  let raw: RawEntity[] = [...extractRegexEntities(text)]

  if (options.ner) {
    const nerEntities = await options.ner(text)
    for (const e of nerEntities) {
      if (e.source === 'ner' && isVetoed(e.text)) continue
      raw.push(e)
    }
  }

  // Risolve le sovrapposizioni di span (longest-match / priorità tipo).
  raw = resolveOverlaps(raw)

  const corefs = findCoreferences(text, raw)

  const unique = dedupe(raw)

  // Pre-assegna i pseudonimi dei nomi completi così che i cognomi isolati
  // possano ereditare lo stesso pseudonimo (coerenza co-reference).
  for (const e of unique) {
    if (e.type === 'PERSONA') session.getOrCreatePseudonym(e.text, e.type)
  }
  for (const { surname, canonical } of corefs) {
    if (!session.has(surname)) {
      // linkCoreference lega il cognome alla STESSA entità del nome completo
      // (stesso entityId + forma canonica), così la re-idratazione non lo tratta
      // come ambiguo. Vedi ADR-0005.
      session.linkCoreference(surname, canonical, 'PERSONA')
    }
  }

  // Aggiunge i cognomi co-referenziati come entità a sé (per la sostituzione).
  for (const { surname } of corefs) {
    if (!unique.some((u) => u.type === 'PERSONA' && normalize(u.text) === normalize(surname))) {
      unique.push({ type: 'PERSONA', text: surname, source: 'coref' })
    }
  }

  const entities: DetectedEntity[] = unique.map((e) => {
    const pseudonym = session.getOrCreatePseudonym(e.text, e.type)
    const occurrences = countOccurrences(text, e.text)
    return { type: e.type, originalText: e.text, pseudonym, occurrences, source: e.source }
  })

  // Arricchisce con i termini NOTI alla pratica (dizionario) che compaiono nel
  // testo ma che il NER/regex non ha ri-rilevato qui: una parte nota non deve mai
  // trapelare in chiaro (vincolo primario anti-leak). Vedi enrichFromKnownTerms.
  return { entities: enrichFromKnownTerms(text, entities, session), session }
}

/**
 * Tipi di entità per cui il match del termine noto deve rispettare i confini di
 * parola (sono testo "linguistico": evita di sostituire "Anna" dentro "Annabella").
 * Gli altri tipi (CF/IBAN/EMAIL/…) sono valori già specifici: match diretto.
 */
const WORD_BOUNDARY_TYPES = new Set<EntityType>([
  'PERSONA',
  'ORGANIZZAZIONE',
  'LUOGO',
  'INDIRIZZO',
  'LUOGO_NASCITA'
])

/**
 * Regex per cercare un termine NOTO nel testo. Come `buildEntityRegex` (spazi→`\s+`,
 * robusto agli a-capo), ma con confini di parola opzionali per i tipi linguistici,
 * usando lookaround Unicode (\p{L}/\p{N}) così "Rossi" non matcha dentro "Rossini".
 */
export function buildKnownTermRegex(term: string, wordBoundary: boolean): RegExp {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const flexible = escaped.replace(/\s+/g, '\\s+')
  if (!wordBoundary) return new RegExp(flexible, 'giu')
  return new RegExp(`(?<![\\p{L}\\p{N}])${flexible}(?![\\p{L}\\p{N}])`, 'giu')
}

/**
 * Aggiunge alla lista entità i termini noti alla sessione (dizionario di pratica)
 * che compaiono nel testo ma non sono già fra le entità rilevate. Marca queste
 * entità con `source: 'dictionary'` (la review le mostra come "(dict)"). Garantisce
 * che una parte nota alla pratica venga pseudonimizzata in OGNI documento.
 */
export function enrichFromKnownTerms(
  text: string,
  detected: DetectedEntity[],
  session: SessionManager
): DetectedEntity[] {
  const already = new Set(detected.map((e) => normalize(e.originalText)))
  const result = [...detected]
  for (const known of session.getKnownTerms()) {
    if (already.has(normalize(known.original))) continue
    const wb = WORD_BOUNDARY_TYPES.has(known.type)
    const re = buildKnownTermRegex(known.original, wb)
    const matches = text.match(re)
    if (!matches || matches.length === 0) continue
    result.push({
      type: known.type,
      originalText: known.original,
      pseudonym: known.pseudonym,
      occurrences: matches.length,
      source: 'dictionary'
    })
    already.add(normalize(known.original))
  }
  return result
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
    result = result.replace(buildEntityRegex(e.originalText), e.pseudonym)
  }
  return result
}

/**
 * Costruisce un regex per trovare un'entità nel testo, robusto agli a-capo: gli
 * spazi nell'originale matchano qualsiasi sequenza di whitespace (spazi, tab,
 * newline). Necessario perché nei documenti legali un nome può essere spezzato
 * su due righe ("Elena\nRossi") per il word-wrap, ma resta la stessa entità.
 */
export function buildEntityRegex(originalText: string): RegExp {
  const escaped = originalText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const flexible = escaped.replace(/\s+/g, '\\s+')
  return new RegExp(flexible, 'gi')
}
