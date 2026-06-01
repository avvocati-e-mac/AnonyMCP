---
id: ADR-0002
title: Ricerca full-text con BM25 + SQLite FTS5
status: accepted
date: 2026-06-01
binding: true
domain: search
supersedes: []
superseded_by: null
security_impact: low
legal_impact: low
code_refs:
  - src/search/chunkIndex.ts
  - src/server.ts
---

# Contesto

La ricerca attuale (`anonymcp_search`) usa un `indexOf` grezzo sul testo pseudonimizzato intero.
Non rankea i risultati e obbliga l'LLM a caricare documenti interi nel contesto. ARCHITETTURA.md
§8 documentava già la scelta di BM25 + SQLite FTS5 (decisa da un council precedente), ma non era
ancora implementata.

# Decisione

La ricerca full-text usa **BM25 con SQLite FTS5**. I documenti pseudonimizzati vengono spezzati
in chunk (~500 token), indicizzati in una tabella FTS5. `anonymcp_search` restituisce i chunk
ranked per rilevanza, non il documento intero.

**NO** a Elasticsearch, Qdrant, o database vettoriali: over-engineering senza GPU per un tool
locale. La ricerca semantica (embedding) è materiale di Fase 2 (vedi piano), non Fase 1.

In Fase 1: FTS5 con tokenizer `unicode61`, **senza stemming**. Lo stemming italiano (Snowball)
e la ricerca ibrida sono opzioni di Fase 2.

# Alternative considerate

- **Qdrant / vettori**: rifiutata — richiede modelli embedding e idealmente GPU; over-engineering.
- **Solo contesto ampio dell'LLM**: rifiutata come default — spreca token e non scala con molti documenti.
- **indexOf attuale**: insufficiente — nessun ranking, carica documenti interi.

# Conseguenze

- L'indice FTS5 contiene SOLO testo pseudonimizzato (indicizzato dopo la pseudonimizzazione,
  invariante #4). Mai testo originale.
- L'indice si crea solo per documenti `approved` (post review umana).
- Vincolo: chi propone un motore di ricerca diverso deve creare un ADR che superseda questo.
