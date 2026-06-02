// ============================================================
// entityColors — mappa tipo-entità → colore, per evidenziare le entità a colpo
// d'occhio (come Anonimator). Riusabile dalla TUI (chalk, Fase 1) e dall'app
// Electron (Fase 2). Nessuna dipendenza da framework UI: solo dati.
// ============================================================

import type { EntityType } from '../types.js'

/**
 * Colore associato a ogni tipo di entità. I valori sono nomi colore compatibili
 * con Ink/chalk (terminale). In Electron si mapperanno a colori CSS equivalenti.
 */
export const ENTITY_COLORS: Record<EntityType, string> = {
  PERSONA: 'blue',
  ORGANIZZAZIONE: 'magenta',
  LUOGO: 'green',
  INDIRIZZO: 'green',
  LUOGO_NASCITA: 'green',
  CODICE_FISCALE: 'red',
  PARTITA_IVA: 'red',
  IBAN: 'redBright',
  EMAIL: 'cyan',
  PEC: 'cyan',
  TELEFONO: 'cyanBright',
  DATA_NASCITA: 'yellow',
  NUMERO_DOCUMENTO: 'yellowBright',
  TARGA: 'yellowBright',
  NUMERO_RUOLO: 'white',
  PROTOCOLLO: 'gray'
}

/** Elenco dei tipi di entità (per i menu di aggiunta manuale nella TUI). */
export const ENTITY_TYPES = Object.keys(ENTITY_COLORS) as EntityType[]

/** Colore di fallback per tipi non mappati (robustezza). */
export const DEFAULT_ENTITY_COLOR = 'white'

/** Ritorna il colore di un tipo entità (con fallback sicuro). */
export function colorForType(type: EntityType): string {
  return ENTITY_COLORS[type] ?? DEFAULT_ENTITY_COLOR
}
