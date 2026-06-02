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
| M4 | Scaffold Electron | App che avvolge il server MCP stdio (main/preload sandbox) | baseline implementata |
| M5 | UI review entità | Review grafica (sostituisce TUI); consenso cartelle; log live | pianificata |
| M6 | Hardening produzione | keychain OS, audit trail, sandbox parser, DPIA/registro | pianificata |
| M7 | Packaging 4-OS | estendere `release.yml` a installer .dmg/.exe/.AppImage | pianificata |

**Decisione M3:** il target NER è `italian-ner-xxl-v2`, **non** "Italian-Legal-BERT". Il motivo
è pratico: AnonyMCP deve ricevere entità da pseudonimizzare (`NerFn`), non solo un modello che
comprenda meglio il linguaggio legale. Vedi [ADR-0007](adr/0007-ner-model-target.md).

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
- Quarantena: con `requireManualApproval`, scrittura in staging + approvazione umana via TUI.
- Pending write protetto da `contentHash`: se il file in staging cambia dopo la registrazione,
  la promozione viene rifiutata e la bozza va rigenerata.
- Una seconda bozza sullo stesso `relPath` non sostituisce lo staging, salvo `overwrite=true`.
- Il return MCP verso l'LLM non contiene **mai** PII reale (solo conteggi e pseudonimi).
- Pseudonimi ambigui (collisione) **non** vengono sostituiti: segnalati, mai indovinati.
