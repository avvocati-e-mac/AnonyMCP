# Roadmap Fase 2 — AnonyMCP

> Stato: Fase 1 chiusa (v0.1.0, server MCP stdio, testuali `.txt`/`.md`).
> Questo documento traccia la Fase 2. La prima fetta in lavorazione è **M-Write**.

## Principio guida (stella polare)

AnonyMCP è un **filtro verso l'LLM cloud**: espone testo pseudonimizzato via MCP e impedisce
che dati personali in chiaro raggiungano l'LLM. Ogni scelta della Fase 2 si valuta con:
«riduce il rischio di leak verso l'LLM cloud?». In Fase 2 l'app Electron **avvolge** il server
MCP (resta MCP, client LLM esterno), non lo sostituisce. NON si generano file *anonimizzati*
(differenza con Anonimator); per le bozze prodotte dall'LLM vedi M-Write.

## Milestone

| # | Milestone | Cosa | Stato |
|---|---|---|---|
| **M-Write** | **Scrittura LLM→cartella (testuali)** | Tool MCP per salvare bozze testuali re-idratate + creare sottocartelle nella pratica | implementata |
| M-Write-Binary | Scrittura formati binari ricchi | `.docx/.pdf/.xlsx/.pptx` generati **dall'MCP** dal testo ri-idratato | pianificata (ADR a parte) |
| M1 | Parser input PDF/DOCX/ODT | Estrarre testo da binari e alimentare `processFile` (riuso parser Anonimator) | pianificata |
| M2 | OCR scansioni | PDF scansionati → testo via Tesseract | pianificata |
| M3 | NER in worker | `italian-ner-xxl-v2` (ONNX) come `NerFn` in worker isolato | pianificata |
| M4-Design | Design app Electron | Specifica UI/funzionamento, schermate ASCII, sicurezza Electron e red-team in [`electron-app-design`](electron-app-design.md) | documentata |
| M4 | Scaffold Electron | App che avvolge il server MCP stdio (main/preload sandbox) | baseline + dashboard IPC implementate |
| M4-Service | API locale review/sensibilità | Facciata locale per dashboard, review, pending write e override sensibilità deciso dall'avvocato | implementata |
| M5 | UI review entità | Review grafica (sostituisce TUI); consenso cartelle; log live | review base + import cartelle via dialog/drop + bozze LLM implementati |
| M6 | Hardening produzione | keychain OS, audit trail, sandbox parser, DPIA/registro | pianificata |
| M7 | Packaging 4-OS | estendere `release.yml` a installer .dmg/.exe/.AppImage | pianificata |

**Decisione M3:** il target NER è `italian-ner-xxl-v2`, **non** "Italian-Legal-BERT". Il motivo
è pratico: AnonyMCP deve ricevere entità da pseudonimizzare (`NerFn`), non solo un modello che
comprenda meglio il linguaggio legale. Vedi [ADR-0007](adr/0007-ner-model-target.md).

**Gap M6/M7 emerso nel test Electron:** `better-sqlite3` è un modulo nativo e usa ABI diverse
tra Node CLI e Electron. Con un solo `node_modules`, un rebuild per Electron fa funzionare FTS5
nell'app ma rompe i test Node; un rebuild per Node ripristina la suite ma può degradare FTS5 in
una nuova istanza Electron. Il packaging deve quindi includere un rebuild nativo Electron
dedicato, mentre lo sviluppo deve avere comandi espliciti per tornare al build Node prima dei
test. Fino a quel punto, la UI può funzionare con ricerca degradata, ma non va considerata
produzione.

## Red-team integrativo 2026-06-03 — remediation pre-produzione

Review eseguita su `main` commit `0e6c37a`, che include gia' il branch
`codex/electron-app-design` (`4611fe3`). Il branch Electron ha ridotto il rischio operativo per
utenti non tecnici: import cartelle con label opache, review locale, pending write e IPC validati.
Restano pero' gap core sul confine filesystem -> MCP e sul trust boundary Electron. Questi punti
sono **bloccanti prima della produzione legale**, salvo esplicita decisione contraria documentata.

| ID | Milestone | Severita' | Evidenza codice | Rischio concreto | Remediation richiesta | Test di accettazione |
|---|---|---:|---|---|---|---|
| RT-01 | M6 Hardening produzione | Alta | `src/util/pathGuard.ts:isInside`; `src/practice/practiceRegistry.ts:listFiles`; `src/practice/writeService.ts:resolveWriteTarget` | Symlink escape: un file `.md/.txt` o una directory symlink dentro la pratica puo' puntare fuori dalla allowlist; lo scan puo' leggere un file esterno e M-Write puo' scrivere attraverso una directory esterna. | Usare `lstat`/`realpath` nei guard; rifiutare symlink file nello scan; rifiutare symlink directory/target in M-Write salvo futura eccezione locale esplicita e auditata. | Test con symlink `.md` verso file esterno non scansionato; test M-Write verso directory symlink rifiutato; test root pratica symlink validata con `realpath`. |
| RT-02 | M6 Hardening produzione | Alta | `src/practice/practiceRegistry.ts:scan`; `src/practice/practiceRegistry.ts:exposableDocs`; `src/server.ts` resource read | Documento cancellato ancora esponibile: dopo approvazione e cancellazione dal disco, `practice.docs` puo' conservare in RAM `doc.result.text` e continuare a servire Resource/search fino al riavvio. | Durante ogni `scan()`, calcolare il set dei file correnti, ritirare i doc non piu' presenti, rimuoverli dall'indice BM25 e inviare `resources/listChanged`. | Test: approva documento, cancella file, riesegui scan, `listResources`, `readResource` e `search` non lo restituiscono. |
| RT-03 | M-Write | Alta | `src/util/pathGuard.ts:isInternalArtifact`; `src/practice/writeService.ts:WRITABLE_EXTENSIONS`; store `pratica.*.json` | M-Write consente `.json`; con `overwrite=true` puo' colpire artefatti interni come `pratica.entitydict.json`, `pratica.approvals.json`, `pratica.writes.json`, `pratica.sensitivity.json`. | Estendere il blocco artefatti interni: `pratica.*.json`, `pratica.searchindex.db`, WAL/journal, `.anonymcp`, `.anonymcp-staging` e futuri store AnonyMCP. | Test `anonymcp_write_document` su ogni artefatto interno: sempre rifiutato, anche con `overwrite=true` e anche in auto-approve. |
| RT-04 | M4/M6 Electron hardening | Alta | `src/electron/main/index.ts:isTrustedRendererUrl`; `assertTrustedSender`; `will-navigate` | In produzione qualunque `file://` e' considerato trusted; una navigazione locale imprevista potrebbe ottenere accesso agli IPC locali. | Fidarsi solo dell'esatto `renderer/index.html` pacchettizzato; in dev confrontare `URL.origin` normalizzato, non `startsWith`; bloccare ogni navigazione `file://` diversa. | Test helper su URL ammessi/rifiutati; test runtime/harness che una pagina `file:///tmp/malicious.html` non puo' invocare IPC. |
| RT-05 | M5 Import label | Media | `src/app/folderImport.ts:safeOpaqueName`; `src/config.ts:folderIdLooksIdentifying`; ADR-0004 | L'import Electron rigenera nomi chiaramente identificanti, ma puo' accettare nomi con una singola parte + numero, es. `Rossi-2026`; la config manuale resta solo warning. | Applicare la regola forte gia' descritta in `electron-app-design`: NFKC, pattern `^[A-Z0-9][A-Z0-9._-]{1,15}$`, almeno una cifra, collisione case-insensitive, nessuna parola descrittiva lunga. | Corpus positivo/negativo: `400F`, `P001`, `2026-CV-001` ammessi; `Rossi-2026`, `cliente-1`, `eredi_rossi`, `comune-di-torino` rigenerati. |
| RT-06 | M6 policy cloud | Media | `src/pipeline/riskScorer.ts:RISK_BLOCK_THRESHOLD`; `src/practice/practiceRegistry.ts:isExposable` | `residualRisk` e' calcolato ma non usato; un documento non sensibile con RG, udienza, importi o altri identificatori contestuali puo' essere esposto dopo approvazione. | Decisione di prodotto: usare `residualRisk` come warning UI o come blocco MCP oltre soglia. Se blocco, definire doppia approvazione locale e copy chiaro. | Test con documento non sensibile ma alto rischio contestuale: comportamento atteso esplicito e verificato, inclusa indicizzazione BM25. |
| RT-07 | Search hardening | Media | `src/server.ts:queryLooksLikePII`; `src/engine/regexPatterns.ts:STRUCTURED_LEGAL_PATTERNS`; `src/server.ts` search payload | `anonymcp_search` blocca CF/IBAN/email/PEC/protocollo ma non tutti gli identificatori legali o nomi reali; inoltre ritorna la query raw nel payload MCP. | Includere pattern strutturati legali rilevanti nel guard; non restituire la query raw; valutare rifiuto query `person-like` o warning fail-safe. | Test per RG, targa, indirizzo/nome persona e query rifiutata; response MCP non contiene la query raw quando non necessaria. |
| RT-08 | Electron logging | Media | `src/electron/main/index.ts` handler `console-message`; `src/electron/renderer/src/App.tsx` | Il main process inoltra gli argomenti console del renderer su stderr; oggi il renderer non logga PII, ma e' un footgun per future modifiche. | In produzione non loggare argomenti console o redigerli/troncarli; vietare PII nei log UI e negli errori renderer-forwarded. | Test/static check con fixture PII: stderr/log non contiene nomi, CF, IBAN o testo originale. |

Priorita' operativa:

1. Prima di ogni uso pilota con dati reali: RT-01, RT-02, RT-03, RT-04.
2. Prima di distribuire la UI a utenti non tecnici: RT-05 e RT-08.
3. Prima di dichiarare il canale cloud governato: RT-06 e RT-07, con decisione esplicita su
   `residualRisk` e search query.

## M-Write — scrittura LLM→cartella

L'LLM legge documenti pseudonimizzati e produce bozze (atti, contratti, ricerche). L'LLM **non
ha accesso al disco**: è l'MCP a salvare nella cartella di pratica (e a creare sottocartelle,
es. "Ricerche"). La bozza viene salvata **re-idratata** (pseudonimo→reale) con un passaggio
**locale** lato server, mai esposto via MCP (coerente con l'invariante "niente tool MCP di
de-anonimizzazione": è vietato il *tool*, non la reversibilità locale). Decisione formalizzata
in **ADR-0005**. Solo formati **testuali** (`.md/.txt/.tex/.csv/.json/.xml/.html`).

### Esito del gate test (2026-06-02) — verifica empirica

Prima di implementare è stata collegata a Claude Desktop una **sonda MCP** che registra come il
client invia gli argomenti di una richiesta di scrittura. Risultati:

- **File testuale** (`.md`): il client passa `content` come **stringa di testo pulita**.
  → ri-idratazione su testo, semplice e sicura. **M-Write parte da qui.**
- **File binario** (`.docx`): il client (Claude) **genera il file localmente** nel proprio
  sandbox di code-execution, poi lo **legge e lo converte in base64** e lo passa come stringa
  (`data` iniziava per `UEsDBA…` = `PK\x03\x04`, firma zip di un `.docx`).
  → la re-idratazione richiederebbe di operare DENTRO lo zip/XML: fragile, alto rischio leak.

**Conclusione:** i binari NON si gestiscono ricevendo i bytes e ri-idratando lo zip. La via
sicura è far passare all'LLM il **testo/markdown** e generare il binario **lato MCP** dal testo
ri-idratato → **M-Write-Binary** (milestone separata con proprio ADR).

### Guardie di sicurezza (M-Write)

- Path validato con `pathGuard` (`isInside` nella pratica, no traversal/assoluti/artefatti).
- Allowlist di estensioni testuali; niente eseguibili/config.
- Quarantena: con `requireManualApproval`, scrittura in staging + approvazione umana dalla
  UI locale AnonyMCP/Electron (TUI solo fallback tecnico/dev, non istruzione da mostrare al LLM).
- Pending write protetto da `contentHash`: se il file in staging cambia dopo la registrazione,
  la promozione viene rifiutata e la bozza va rigenerata.
- Una seconda bozza sullo stesso `relPath` non sostituisce lo staging, salvo `overwrite=true`.
- Il return MCP verso l'LLM non contiene **mai** PII reale (solo conteggi e pseudonimi).
- Pseudonimi ambigui (collisione) **non** vengono sostituiti: segnalati, mai indovinati.

Gap aperti dopo red-team RT-01/RT-03:

- il path guard deve diventare symlink-aware (`realpath`/`lstat`) prima della produzione;
- M-Write deve bloccare esplicitamente tutti gli artefatti interni AnonyMCP, anche se hanno
  estensione testuale ammessa (`.json`, `.db`, WAL/journal, staging).
