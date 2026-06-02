---
id: ADR-0004
title: Label/folderId pratica = numero opaco, mai nomi delle parti
status: accepted
date: 2026-06-01
binding: true
domain: security
supersedes: []
superseded_by: null
security_impact: high
legal_impact: high
code_refs:
  - src/config.ts
  - src/server.ts
---

# Contesto

Il tool MCP `anonymcp_list_folders` espone all'LLM il `label` e l'`id` di ogni pratica. Se il
label contiene i nomi delle parti (es. "Rossi c. Bianchi", "causa_mario_rossi"), quei nomi reali
finiscono nel contesto dell'LLM **prima ancora di aprire un documento** — un leak diretto che
vanifica tutta la pseudonimizzazione a valle.

# Decisione

Il `label` e l'`id` di una pratica devono essere **numeri/codici opachi** (es. "400F",
"2026-CV-001"), MAI nomi delle parti o riferimenti identificabili.

`src/config.ts` deve emettere un **warning** se un label o un folderId contengono pattern che
sembrano nomi di persona o nomi delle parti (es. due parole capitalizzate, "c." tra due nomi,
`rossi-c-bianchi`).

Questo è critico, a differenza della cifratura at-rest (ADR-0001): il label è l'UNICO campo che
attraversa il confine verso l'LLM tra i metadati di pratica.

# Alternative considerate

- **Label libero**: rifiutata — rischio diretto di leak verso l'LLM.
- **Bloccare l'avvio se il label/id sembra un nome**: troppo rigido; un warning chiaro è
  sufficiente perché l'avvocato resta responsabile della configurazione.

# Conseguenze

- Documentare nella configurazione che label e id vanno usati come numero/codice di pratica.
- `config.ts`: funzioni di validazione con warning su stderr (mai stdout — invariante #1).
- Il path della cartella sul disco può avere qualsiasi nome: non è mai esposto (docId opachi via HMAC).
