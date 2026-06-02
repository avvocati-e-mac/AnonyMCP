# Changelog

Tutte le modifiche rilevanti a questo progetto sono documentate qui.

Il formato segue [Keep a Changelog](https://keepachangelog.com/it/1.1.0/)
e il progetto adotta il [versionamento semantico](https://semver.org/lang/it/).

## [0.1.0] - 2026-06-02

Prima release pubblica — **Fase 1** (server MCP stdio standalone, beta).

> ⚠️ Stato beta: non ancora deployabile in produzione presso uno studio legale
> (vedi `docs/agent-guides/threat-model.md`). L'output resta *dato personale*
> (pseudonimizzazione, non anonimizzazione).

### Aggiunto
- **Server MCP stdio** che pseudonimizza i documenti di una pratica *prima* di esporli
  a un LLM cloud. Quattro strumenti: `list_folders`, `scan_practice`,
  `get_practice_status`, `search`. I documenti sono esposti come **MCP Resources** già
  pseudonimizzati.
- **Motore di pseudonimizzazione**: regex specializzate per documenti legali italiani
  (nomi, CF, P.IVA, IBAN, indirizzi, email, telefoni, targhe, numeri documento),
  co-reference resolution e veto-filter sui ruoli processuali. Riusa il motore di
  [`avvocati-e-mac/anonimator`](https://github.com/avvocati-e-mac/anonimator).
- **Mappa reale↔pseudonimo solo in RAM** (`SessionManager`): nessuno strumento MCP di
  de-anonimizzazione.
- **Quarantena + approvazione umana** (`requireManualApproval`): nessun documento è
  esposto senza revisione. Stato di approvazione condiviso tra TUI e server, revocabile.
- **Ricerca full-text BM25** su SQLite FTS5, con indicizzazione *dopo* la
  pseudonimizzazione e guard anti-PII sulle query (ADR-002).
- **Dizionario di pratica** in testo chiaro accanto ai documenti, applicato a ogni
  documento della pratica per coerenza anti-leak (ADR-003).
- **Cache di pratica cifrata** a riposo (AES-256-GCM): contiene solo hash (ADR-001).
- **Risk scorer**: classifica i dati sensibili (art. 9/10 GDPR — penale/salute/minori)
  per non servirli mai a un LLM cloud.
- **Label/folderId opachi** (es. `400F`), mai nomi delle parti, perché esposti via
  `list_folders` (ADR-004).
- **TUI di review** da terminale (`npm run review`): lista entità colorata, anteprima
  Originale/Anonimizzato, azioni di approvazione e aggiunta manuale.
- **Path guard** (allowlist, no traversal, docId/URI opachi via HMAC) e logger su stderr
  (mai su stdout, che è il canale JSON-RPC).
- **Documentazione**: `ARCHITETTURA.md`, 4 ADR vincolanti, guide di sicurezza
  (invarianti, threat model STRIDE), convenzioni MCP/codice/testing.
- **172 test** (unit, anti-leak, e2e, redteam).

[0.1.0]: https://github.com/avvocati-e-mac/AnonyMCP/releases/tag/v0.1.0
