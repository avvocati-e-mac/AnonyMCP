// ============================================================
// Pattern regex per il riconoscimento di entità (italiano legale).
// Portato da `avvocati-e-mac/anonimator` (src/main/services/regexPatterns.ts),
// con estensioni AnonyMCP per il dominio legale (PEC, RG, protocollo).
// Esportati come costanti nominate per poter essere testati isolatamente.
// ============================================================

import type { EntityType } from '../types.js'

// ─── Costanti di supporto ────────────────────────────────────────────────────

const JUDICIAL_ROLES =
  'presidente|consigliere|rel\\.?\\s*consigliere|giudice|sostituto\\s+procuratore|' +
  'procuratore|cancelliere|segretario|relatore|estensore|componente'

// ─── Header di sentenza ──────────────────────────────────────────────────────

/** Nome/cognome seguito da ruolo giudiziario con trattini. */
export const SENTENCE_HEADER_PATTERN = new RegExp(
  '(?:(?:dott\\.?(?:ssa)?|avv\\.?|prof\\.?|ing\\.?)\\s+)?' +
    "([A-ZÀ-Ü][A-ZÀ-Üa-zà-ü]*'?[A-ZÀ-Üa-zà-ü]*(?:\\s+[A-ZÀ-Ü][A-ZÀ-Üa-zà-ü']+){1,3})" +
    '\\s*[-–]\\s*(?:' +
    JUDICIAL_ROLES +
    ')\\s*[-–]',
  'gi'
)

// ─── Pattern strutturati contestuali legali ──────────────────────────────────

/** ricorrente/appellante/attore/ecc. seguito dal nome della parte */
export const PROCESSO_PARTE_PATTERN = new RegExp(
  '(?:^|\\n)\\s*(?:ricorrente|resistente|appellante|appellato|intimato|' +
    'controricorrente|opponente|opposto|attore|convenuto|debitore|creditore|' +
    'fallito|fallendo|istante|intervenuto)[:\\s,]+' +
    "([A-ZÀ-Ü][A-ZÀ-Üa-zà-ü']+(?:\\s+[A-ZÀ-Ü][A-ZÀ-Üa-zà-ü']+){1,3})",
  'gi'
)

/** difeso/assistito dall'avv./avvocato + nome */
export const DIFENSORE_PATTERN = new RegExp(
  '(?:difeso|difesa|rappresentato|rappresentata|assistito|assistita)\\s+' +
    "(?:dall?['\\u2019])?(?:avv\\.?|avvocato|procuratore)\\s+" +
    "([A-Z][A-Za-zÀ-ÿ']+(?:\\s+[A-Z][A-Za-zÀ-ÿ']+){1,3})",
  'gi'
)

/** Nome tutto-maiuscolo su riga propria o seguito da trattino */
export const ALLCAPS_NAME_PATTERN = new RegExp(
  '(?:^|\\n)([A-ZÀ-Ü][A-ZÀ-Ü\']{1,25}' +
    '(?:\\s+[A-ZÀ-Ü][A-ZÀ-Ü]{1,25}){1,2})' +
    '(?:\\s*$|\\s*[+]|\\s*[-–]\\s*(?:$|\\n))',
  'gm'
)

/** nato/nata/data di nascita + data (numerica o letterale italiana) */
export const DATA_NASCITA_PATTERN =
  /(?:nato|nata|n\.)[\s,]+(?:a\s+\S+\s+)?il\s+(\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4}|\d{1,2}\s+(?:gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+\d{4})|(?:data(?:\s+di)?\s+nascita|d\.d\.n\.)[:\s]+(\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4}|\d{1,2}\s+(?:gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+\d{4})/gi

/** nato/nata a <Città> il — luogo di nascita con contesto esplicito */
export const LUOGO_NASCITA_PATTERN =
  /(?:nato|nata)\s+a\s+([A-ZÀ-Üa-zà-ü][A-Za-zÀ-ÿ\s]{1,30}?)\s+il\b/gi

/** Indirizzo con prefisso contestuale (residente/domiciliato/con sede) — CAP obbligatorio. */
export const INDIRIZZO_PATTERN_STANDARD =
  /(?:residente(?:\s+attualmente)?|domiciliato|domiciliata|con\s+sede|sito)\s+(?:in\s+)?(?:Via|Viale|Piazza|Largo|Vicolo|Str\.|Loc\.|Fraz\.|V\.le)\s+[A-Za-zÀ-ÿ\s0-9,.']{3,50}(?:\s*[-–,]\s*\d{5}|\s*,?\s*\d{5})/gi

/** "Corso" come indirizzo solo con contesto di residenza/domicilio. */
export const INDIRIZZO_PATTERN_CORSO =
  /(?:residente(?:\s+attualmente)?|domiciliato|domiciliata|con\s+sede|sito)\s+(?:in\s+)?[Cc]orso\s+[A-ZÀ-Ü][A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+){0,5},?\s*\d+[,\s]*(?:[-–]\s*)?\d{5}/gi

/** Documento d'identità — con contesto o formato bare con contesto esplicito. */
export const NUMERO_DOCUMENTO_PATTERN =
  /(?:carta(?:\s+d[i']\s*identit[àa])?|passaporto|patente|C\.I\.E?\.?|documento\s+d'identit[àa]?)[\s:,n.°]*([A-Z]{2}\s?[0-9]{5,7}[A-Z]?)|(?:n(?:umero)?\.?\s*doc(?:umento)?[:\s]+)([A-Z]{2}\s?[0-9]{5,7}[A-Z]?)|(?:(?:rilasciata?|emessa?)\s+(?:il\s+\S+\s+)?(?:dal?\s+\S+\s+)?(?:con\s+)?(?:n[°.]?\s*|numero\s+))([A-Z]{2}\s?[0-9]{5,7}[A-Z]?)/gi

/** Targa veicolo italiana — formato moderno (AB 123 CD). */
export const TARGA_PATTERN = /\b([A-Z]{2}\s?[0-9]{3}\s?[A-Z]{2})\b/g

/** Contraente/Assicurato/Beneficiario + nome (polizze). */
export const POLIZZA_PARTE_PATTERN =
  /(?:Contraente|Assicurato|Assicurata|Beneficiario|Intestatario)[:\s]+([A-Z][A-Za-zÀ-ÿ']+(?:\s+[A-Z][A-Za-zÀ-ÿ']+){1,3})/gi

/** tra/fra + nome + nato/residente/ecc. (contratti). */
export const CONTRATTO_PARTE_PATTERN =
  /(?:tra|fra)\s+([A-Z][A-Za-zÀ-ÿ']+(?:\s+[A-Z][A-Za-zÀ-ÿ']+){1,3}),\s+(?:nato|nata|residente|domiciliato|codice\s+fiscale|con\s+sede)/gi

/** Paziente/CTU/CTP/Perito + nome (perizie). */
export const PERIZIA_SOGGETTO_PATTERN =
  /(?:Paziente|CTU|C\.T\.U\.|CTP|C\.T\.P\.|Perito|Esaminato|Esaminata)[:\s]+([A-Z][A-Za-zÀ-ÿ']+(?:\s+[A-Z][A-Za-zÀ-ÿ']+){1,3})/gi

/** Titolo professionale + nome (min 2 token). */
export const TITOLO_NOME_PATTERN =
  /(?:Ing\.|Dott\.(?:ssa)?|Dr\.(?:ssa)?|Prof\.(?:ssa)?|Sig\.(?:ra)?|Avv\.|Arch\.|Geom\.)\s+([A-ZÀ-Ü][A-Za-zÀ-ÿ']+(?:\s+[A-ZÀ-Ü][A-Za-zÀ-ÿ']+){1,3})/g

/** Elenco avvocati separati da virgola. */
export const AVV_LISTA_PATTERN =
  /avvocat[oi]\s+((?:[A-Z][A-Za-zÀ-ÿ']+(?:\s+[A-Z][A-Za-zÀ-ÿ']+){1,3})(?:\s*,\s*(?:[A-Z][A-Za-zÀ-ÿ']+(?:\s+[A-Z][A-Za-zÀ-ÿ']+){1,3}))*)/gi

/** Firma digitale PKI: "Firmato Da: NOME COGNOME Emesso Da:" */
export const PKI_FIRMA_PATTERN =
  /Firmato\s+Da:\s+([A-Z][A-ZÀ-Ü]+\s+[A-Z][A-ZÀ-Ü]+)\s+Emesso/gi

// ─── Estensioni AnonyMCP: entità contestuali legali (anti re-identificazione) ─

/**
 * Numero di Ruolo Generale (RG / RGN / R.G. / n. ruolo).
 * Cattura forme come "R.G. 1234/2026", "n. ruolo 1234/26", "RGN 12/2025".
 * Identificatore ad alta linkability con i portali della giustizia.
 */
export const NUMERO_RUOLO_PATTERN =
  /\b(?:R\.?\s?G\.?(?:\s?N\.?)?|n(?:umero)?\.?\s*(?:di\s*)?ruolo)\s*:?\s*(\d{1,6}\s*\/\s*\d{2,4})/gi

/** Indirizzo PEC (posta elettronica certificata) — email su domini PEC noti. */
export const PEC_PATTERN =
  /\b[A-Za-z0-9._%+\-]+@(?:pec\.|legalmail\.|postacert\.|[A-Za-z0-9.\-]*pec[A-Za-z0-9.\-]*)\.[A-Za-z]{2,}\b/gi

/** Numero di protocollo (PA / amministrativo): "prot. n. 12345/2026". */
export const PROTOCOLLO_PATTERN =
  /\b(?:prot(?:ocollo)?\.?\s*(?:n\.?|numero)?)\s*:?\s*(\d{1,8}(?:\s*\/\s*\d{2,4})?)/gi

// ─── Array aggregato dei pattern contestuali (con tipo associato) ─────────────

export const STRUCTURED_LEGAL_PATTERNS: { pattern: RegExp; type: EntityType }[] = [
  { pattern: PROCESSO_PARTE_PATTERN, type: 'PERSONA' },
  { pattern: DIFENSORE_PATTERN, type: 'PERSONA' },
  { pattern: ALLCAPS_NAME_PATTERN, type: 'PERSONA' },
  { pattern: LUOGO_NASCITA_PATTERN, type: 'LUOGO_NASCITA' },
  { pattern: DATA_NASCITA_PATTERN, type: 'DATA_NASCITA' },
  { pattern: INDIRIZZO_PATTERN_STANDARD, type: 'INDIRIZZO' },
  { pattern: INDIRIZZO_PATTERN_CORSO, type: 'INDIRIZZO' },
  { pattern: NUMERO_DOCUMENTO_PATTERN, type: 'NUMERO_DOCUMENTO' },
  { pattern: POLIZZA_PARTE_PATTERN, type: 'PERSONA' },
  { pattern: CONTRATTO_PARTE_PATTERN, type: 'PERSONA' },
  { pattern: PERIZIA_SOGGETTO_PATTERN, type: 'PERSONA' },
  { pattern: TITOLO_NOME_PATTERN, type: 'PERSONA' },
  { pattern: TARGA_PATTERN, type: 'TARGA' },
  { pattern: NUMERO_RUOLO_PATTERN, type: 'NUMERO_RUOLO' }
]

// ─── Pattern strutturati (dati personali formali) ────────────────────────────

/** Codice Fiscale — lenient (default; tollera distorsioni OCR). */
export const CODICE_FISCALE_PATTERN_LENIENT =
  /\b[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]\b/gi

/** Codice Fiscale — strict (valida mese e range giorno). */
export const CODICE_FISCALE_PATTERN_STRICT =
  /\b[A-Z]{6}[0-9]{2}[ABCDEHLMPRST](?:0[1-9]|[1-6][0-9]|7[01])[A-Z][0-9]{3}[A-Z]\b/gi

/** Partita IVA — 11 cifre, opzionalmente preceduto da "P.IVA". */
export const PARTITA_IVA_PATTERN = /\b(?:P\.?\s?IVA\s*:?\s*)?([0-9]{11})\b/gi

/** IBAN italiano — compatto o con spazi ogni 4 char. */
export const IBAN_PATTERN = /\bIT[0-9]{2}(?:\s?[A-Z0-9]){23}\b/gi

/** Indirizzo email. */
export const EMAIL_PATTERN =
  /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/gi

/** Numero di telefono italiano (fisso o mobile). */
export const TELEFONO_PATTERN =
  /\b(?:\+39[\s\-]?)?(?:0[0-9]{1,3}[\s\-]?[0-9]{5,8}|3[0-9]{2}[\s\-]?[0-9]{6,7})\b/g

/**
 * Array aggregato dei pattern strutturati formali.
 * NB: l'ordine conta — PEC prima di EMAIL così che una PEC sia tipizzata come tale.
 */
export const REGEX_PATTERNS: { type: EntityType; pattern: RegExp }[] = [
  { type: 'CODICE_FISCALE', pattern: CODICE_FISCALE_PATTERN_LENIENT },
  { type: 'PARTITA_IVA', pattern: PARTITA_IVA_PATTERN },
  { type: 'IBAN', pattern: IBAN_PATTERN },
  { type: 'PEC', pattern: PEC_PATTERN },
  { type: 'EMAIL', pattern: EMAIL_PATTERN },
  { type: 'TELEFONO', pattern: TELEFONO_PATTERN },
  { type: 'PROTOCOLLO', pattern: PROTOCOLLO_PATTERN }
]
