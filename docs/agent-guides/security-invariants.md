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
2. **Mai PII in chiaro nell'output verso l'LLM.** Il vincolo primario è il canale MCP/cloud:
   Resources, search e tool return non devono contenere valori reali. La mappa
   reale↔pseudonimo vive in RAM (`SessionManager`); la cache `.anonymcp` contiene solo
   `sha256(originale)` ed è cifrata AES-256-GCM. Il dizionario di pratica può contenere testo
   reale in chiaro perché resta locale accanto ai documenti originali (ADR-0003) e non è mai
   esposto via MCP.
3. **Niente de-anonimizzazione via MCP.** Nessun tool `get_mapping`/`deanonymize`. La
   reversibilità, se serve, è un proxy locale fuori dal protocollo. La re-idratazione di
   `write_document` (M-Write, ADR-0005) è coerente: avviene LOCALE lato server prima di
   scrivere su disco e il return verso l'LLM non contiene mai PII — non è un tool di de-anon.
4. **Anonimizza prima di ogni artefatto persistente** (chunk/indice/embedding). Gli embedding
   sono invertibili → indicizzare testo non anonimizzato = leak a riposo.
5. **Sanitizza prima di pseudonimizzare** (`src/pipeline/toMarkdown.ts:sanitizeMarkdown`):
   zero-width, entità HTML, tag HTML, NFKC, sillabazione. Difende dall'evasione del NER.
6. **Dati art. 9/10 (penale/salute/minori) mai a LLM cloud.** Il classificatore locale
   (`src/pipeline/riskScorer.ts:classifySensitivity`) e' un suggerimento prudenziale; la
   decisione finale puo' essere forzata localmente dall'avvocato e persiste su hash del
   documento (`pratica.sensitivity.json`, senza path/nomi reali). Con
   `allowCloudForSensitive=false` il gate effettivo e' applicato in
   `PracticeRegistry.isExposable`: niente Resource, niente read diretto, niente indice/search
   per documenti sensibili.
7. **Valida ogni path** (`src/util/pathGuard.ts:assertAllowed`): solo cartelle in allowlist,
   blocco artefatti interni (`.anonymcp`), no traversal. URI/docId opachi (HMAC).
8. **Quarantena di default** (`requireManualApproval`): un documento non è esposto come
   Resource finché un umano non lo approva.
9. **Errori azionabili, mai stack trace ai client.** Nei tool: `isError` + prossimo passo.

## Test che le proteggono
- Inv. 2 → `test/practiceStore.test.ts` (cache senza plaintext), `test/cacheCoherence.test.ts`,
  `test/server.e2e.test.ts`.
- Inv. 3 → `test/server.e2e.test.ts` (i tool de-anon non esistono).
- Inv. 5 → `test/redteam.sanitizer.test.ts` (fuzzing).
- Inv. 6 → `test/riskScorer.test.ts`, `test/fixtures.antileak.test.ts`,
  `test/redteam.search.test.ts`, `test/sensitivityOverride.test.ts`.
- Inv. 7 → `test/pathGuard.test.ts`, `test/redteam.docid.test.ts`.
- Anti-leak generale → `test/fixtures.antileak.test.ts`, `test/redteam.search.test.ts`.
