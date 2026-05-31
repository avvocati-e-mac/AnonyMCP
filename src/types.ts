// ============================================================
// Tipi condivisi di AnonyMCP.
// Adattati da `avvocati-e-mac/anonimator` (src/shared/types.ts),
// senza dipendenze Electron.
// ============================================================

/** Tipi di entità riconosciute dal motore di pseudonimizzazione. */
export type EntityType =
  | 'PERSONA'
  | 'ORGANIZZAZIONE'
  | 'LUOGO'
  | 'CODICE_FISCALE'
  | 'PARTITA_IVA'
  | 'IBAN'
  | 'EMAIL'
  | 'TELEFONO'
  | 'DATA_NASCITA'
  | 'LUOGO_NASCITA'
  | 'INDIRIZZO'
  | 'NUMERO_DOCUMENTO'
  | 'TARGA'
  // Entità specifiche del dominio legale (estensione AnonyMCP)
  | 'NUMERO_RUOLO'
  | 'PEC'
  | 'PROTOCOLLO'

/** Origine di un'entità rilevata — usato per filtri e diagnostica. */
export type EntitySource = 'regex' | 'ner' | 'coref' | 'manual'

/** Una singola entità trovata in un documento. */
export interface DetectedEntity {
  type: EntityType
  /** Testo originale così come appare nel documento (resta SOLO in RAM). */
  originalText: string
  /** Pseudonimo coerente assegnato (es. "M. R.", "CF_001"). */
  pseudonym: string
  /** Numero di occorrenze nel documento. */
  occurrences: number
  source: EntitySource
}

/** Materie del diritto italiano supportate (influenza pattern e oscuramento). */
export type LegalMatter = 'civile' | 'penale' | 'tributario' | 'amministrativo' | 'altro'

/** Una cartella/pratica esposta dall'utente. */
export interface ExposedFolder {
  /** Identificatore opaco, usato negli URI delle resource. */
  id: string
  /** Etichetta leggibile per l'utente. */
  label: string
  /** Percorso assoluto della cartella sul filesystem locale. */
  path: string
  /** Materia del diritto (default: "altro"). */
  matter?: LegalMatter
}

/** Configurazione del server (anonymcp.config.json). */
export interface AnonyMcpConfig {
  version: 1
  folders: ExposedFolder[]
  /**
   * Se true (default), i documenti appena scansionati restano in quarantena
   * finché un umano non approva il diff di pseudonimizzazione.
   */
  requireManualApproval: boolean
  /**
   * Se false (default), i documenti che contengono categorie sensibili
   * (art. 9/10 GDPR) NON sono mai serviti verso endpoint cloud.
   * Regola architetturale: non rendere true senza una DPIA esplicita.
   */
  allowCloudForSensitive: boolean
  logLevel: 'debug' | 'info' | 'warn' | 'error'
}

/**
 * File "pratica" cifrato (cache di pseudonimizzazione).
 * NB: la struttura qui descritta è il *plaintext* che viene poi cifrato
 * con AES-256-GCM prima di toccare il disco. Non contiene il testo reale:
 * solo l'hash dell'originale, per il matching deterministico.
 */
export interface PracticeCacheEntry {
  /** sha256 del testo originale normalizzato — NON il testo in chiaro. */
  origHash: string
  pseudonym: string
  type: EntityType
  /** Conferma umana (human-in-the-loop). */
  confirmed: boolean
}

export interface PracticeCache {
  version: 1
  practiceId: string
  createdAt: string
  engineVersion: string
  /** Hash dell'insieme dei contenuti sorgente: invalida la cache se cambia. */
  sourceHash: string
  entries: PracticeCacheEntry[]
}

/** Stato di approvazione di un documento. */
export type DocumentStatus = 'quarantined' | 'approved'

/** Esito della pseudonimizzazione di un documento. */
export interface AnonymizationResult {
  /** Testo pseudonimizzato (sicuro da esporre). */
  text: string
  entities: DetectedEntity[]
  /** True se contiene categorie sensibili (art. 9/10 GDPR). */
  sensitive: boolean
  /** Punteggio di rischio residuo 0..1 (più alto = più rischioso). */
  residualRisk: number
}

export const ENGINE_VERSION = 'anonymcp-engine@0.1.0'
