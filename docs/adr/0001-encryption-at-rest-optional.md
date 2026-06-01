---
id: ADR-0001
title: Cifratura a riposo opzionale, non requisito primario
status: accepted
date: 2026-06-01
binding: true
domain: security
supersedes: []
superseded_by: null
security_impact: medium
legal_impact: low
---

# Contesto

Lo scopo di AnonyMCP è **impedire che dati personali in chiaro finiscano in un LLM cloud**
(vedi CLAUDE.md §SCOPO). Non è un sistema di protezione dei documenti dal furto fisico della
macchina: se l'SSD dell'avvocato non è cifrato (FileVault), i documenti originali sono già
accessibili a chiunque abbia accesso fisico, **a prescindere da AnonyMCP**.

Un council di red teaming aveva segnalato la cifratura del dizionario/cache come "rischio
massimo" citando memory dump e key extraction. Ma questi scenari presuppongono già un accesso
alla macchina che espone i documenti originali — quindi sono fuori dallo scopo dell'MCP.

# Decisione

La cifratura a riposo (AES-256-GCM) di artefatti locali (cache `.anonymcp`, indice di ricerca,
dizionario di pratica) è una **buona pratica opzionale**, NON il requisito di sicurezza primario.

Il requisito primario è e resta: **nessun dato reale deve uscire dal server verso l'LLM** (canale MCP).

La cache `.anonymcp` esistente resta cifrata (già implementata, non si tocca). Per i nuovi
artefatti (dizionario, indice FTS5) la cifratura è facoltativa e va decisa caso per caso in base
all'ergonomia, non imposta come dogma.

# Alternative considerate

- **Cifrare tutto obbligatoriamente**: rifiutata — sovra-ingegnerizzazione che non riduce il
  rischio reale (i dati originali sono già in chiaro nelle cartelle delle pratiche).
- **Non cifrare nulla**: accettabile per gli artefatti che non aggiungono esposizione, ma la
  cache esistente resta cifrata per coerenza.

# Conseguenze

- Non si valuta la sicurezza at-rest come argomento contro scelte architetturali (es. dizionario
  in chiaro): vedi ADR-0003.
- Ogni domanda a un council LLM deve includere lo scopo dell'MCP per evitare risposte fuori bersaglio.
