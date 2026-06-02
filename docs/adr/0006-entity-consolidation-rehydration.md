---
id: ADR-0006
title: Consolidamento entità (id-entità interno) per la re-idratazione
status: accepted
date: 2026-06-02
binding: true
domain: security
supersedes: []
superseded_by: null
security_impact: high
legal_impact: high
code_refs:
  - src/engine/sessionManager.ts
  - src/engine/anonymizer.ts
  - src/practice/entityDictionary.ts
---

# Contesto

La re-idratazione di M-Write (pseudonimo→reale, [ADR-0005](0005-mcp-write-rehydration.md)) deve
ricostruire il nome reale di un'entità a partire dal suo pseudonimo. Un **red-team test reale**
ha rivelato un problema: il motore fa già co-reference ("Mario Rossi" e il successivo "Rossi"
ricevono lo stesso pseudonimo "M. R."), ma la mappa inversa li vedeva come **2 originali
distinti** → marcava "M. R." come ambiguo e **non lo sostituiva**, anche se sono la **stessa
persona**. La re-idratazione falliva nel caso più comune.

Va distinto da un caso opposto e **pericoloso**: due persone *diverse* con stesse iniziali
("Mario Rossi" vs "Marco Russo" → "M. R.") — lì NON si deve collassare, pena scrivere il nome
sbagliato su un atto.

# Ricerca (letteratura NLP)

Ricerca svolta con SearXNG + Perplexity (focus accademico). Sintesi:
- Lo standard per l'anonimizzazione **reversibile** è: **coreference resolution** (raggruppa i
  mention nella stessa entità) + **entity resolution** che assegna un **id interno stabile** per
  entità → si mappa `id → pseudonimo` e `id → forma reale` in una tabella; la reversibilità sta
  nella tabella, **non** nel pseudonimo.
- La **canonicalizzazione "longest mention"** (scegliere la forma più completa del cluster, es.
  "Mario Rossi" per {"Mario Rossi","Rossi"}) è prassi comune e ragionevole, con failure case
  noti (espansioni rumorose, forme tabellari, titoli/ruoli) mitigabili.
- Aggiungere un hash/suffisso al pseudonimo è un pattern noto, **ma** il vero disambiguatore è
  l'id interno: il suffisso è arbitrario, e un hash *derivato dal nome ed esposto* sarebbe
  attaccabile (dizionario di nomi) e correlabile tra documenti.

# Decisione

**ID entità interno (RAM-only) + forma canonica (longest mention), re-idratazione id-driven con
fail-safe.**
- Ogni PERSONA riceve un `entityId` interno (`ENT_n`), che vive **solo in RAM** e non è mai
  serializzato nello pseudonimo né esposto via MCP. Le occorrenze co-referenziate (cognome
  isolato legato al nome completo) ereditano lo **stesso `entityId`** (`linkCoreference`).
- La mappa inversa collassa per pseudonimo usando l'**id-entità**: un solo `entityId` = stessa
  entità → si ri-idrata con la **forma canonica**; più `entityId` sotto lo stesso pseudonimo =
  omonimia → **ambiguo** (non sostituito, segnalato).
- Il `canonical` è persistito nel dizionario di pratica come **campo opzionale**
  retrocompatibile, così la co-reference si ricostruisce tra sessioni.

# Alternative considerate

- **(opzione utente 1) Consolidamento "super-entità" senza id stabile** — corretta come idea,
  ma da sola non distingue in modo deterministico co-reference da omonimia. È la metà giusta:
  l'id-entità la rende deterministica e auditabile.
- **(opzione utente 2) Hash/suffisso disambiguante sullo pseudonimo** ("M. R. xyz1" vs
  "M. R. zyx2") — **rifiutata**: lo pseudonimo è ESPOSTO all'LLM (cfr. ADR-0004), quindi un
  suffisso derivato dal contenuto è un canale di correlazione tra documenti e un hash sul nome è
  attaccabile con un dizionario. Il suffisso, inoltre, non è il vero disambiguatore (lo è l'id
  interno). Risolverebbe l'omonimia ma non la co-reference, e aggiungerebbe un rischio di leak.
- **Re-idratazione sempre col primo originale visto** — rifiutata: scriverebbe il nome sbagliato
  in caso di omonimia (viola il principio fail-safe).

# Conseguenze

- `SessionEntry` acquisisce `entityId?` e `canonical?` (RAM); `linkCoreference` e
  `buildInverseMap` id-aware in `sessionManager.ts`.
- **Guard anti-falso-merge** in `findCoreferences` (`anonymizer.ts`): se un cognome è suffisso di
  >1 persona distinta, NON si emette la co-reference → resta pseudonimizzato (fail-safe), mai
  ri-idratato a un nome a caso. Decisione utente: lasciare lo pseudonimo + segnalazione.
- Rischio residuo: forma canonica imperfetta (rumore nella longest mention) → errore di resa su
  disco, NON un leak verso l'LLM. La co-reference errata a monte è mitigata dal guard + dal
  fail-safe della mappa inversa.
- Validato end-to-end su Claude Desktop (co-reference, omonimia, falso-merge) e da test
  automatici (`test/rehydration.test.ts`, `test/anonymizer.test.ts`).
