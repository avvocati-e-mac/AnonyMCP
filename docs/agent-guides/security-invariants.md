# Invarianti di sicurezza (estese)

Versione approfondita delle invarianti riassunte in `CLAUDE.md`. Sono **proprietà che non
devono mai rompersi**: ogni modifica va verificata contro questa lista. Vedi anche
[threat-model.md](threat-model.md).

## Contents
- Le invarianti
- Dove sono applicate nel codice
- Test che le proteggono

## Le invarianti

1. **Mai stdout.** stdout è il canale JSON-RPC dello stdio transport. Tutto il logging va su
   stderr (`src/util/logger.ts`). Un solo `console.log` rompe il protocollo.
2. **Mai PII in chiaro su disco.** La mappa reale↔pseudonimo vive solo in RAM
   (`SessionManager`). La cache `.anonymcp` contiene solo `sha256(originale)`, mai il testo,
   ed è cifrata AES-256-GCM (`src/practice/practiceStore.ts`, `src/util/crypto.ts`).
3. **Niente de-anonimizzazione via MCP.** Nessun tool `get_mapping`/`deanonymize`. La
   reversibilità, se serve, è un proxy locale fuori dal protocollo.
4. **Anonimizza prima di ogni artefatto persistente** (chunk/indice/embedding). Gli embedding
   sono invertibili → indicizzare testo non anonimizzato = leak a riposo.
5. **Sanitizza prima di pseudonimizzare** (`src/pipeline/toMarkdown.ts:sanitizeMarkdown`):
   zero-width, entità HTML, tag HTML, NFKC, sillabazione. Difende dall'evasione del NER.
6. **Dati art. 9/10 (penale/salute/minori) mai a LLM cloud.** Classificazione in
   `src/pipeline/riskScorer.ts:classifySensitivity`; enforcement endpoint in Fase 2.
7. **Valida ogni path** (`src/util/pathGuard.ts:assertAllowed`): solo cartelle in allowlist,
   blocco artefatti interni (`.anonymcp`), no traversal. URI/docId opachi (HMAC).
8. **Quarantena di default** (`requireManualApproval`): un documento non è esposto come
   Resource finché un umano non lo approva.
9. **Errori azionabili, mai stack trace ai client.** Nei tool: `isError` + prossimo passo.

## Test che le proteggono
- Inv. 2 → `test/practiceStore.test.ts` (no plaintext), `test/cacheCoherence.test.ts`.
- Inv. 3 → `test/server.e2e.test.ts` (i tool de-anon non esistono).
- Inv. 5 → `test/redteam.sanitizer.test.ts` (fuzzing).
- Inv. 6 → `test/riskScorer.test.ts`, `test/fixtures.antileak.test.ts`.
- Inv. 7 → `test/pathGuard.test.ts`, `test/redteam.docid.test.ts`.
- Anti-leak generale → `test/fixtures.antileak.test.ts`, `test/redteam.search.test.ts`.
