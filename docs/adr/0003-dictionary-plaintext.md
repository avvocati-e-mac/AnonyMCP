---
id: ADR-0003
title: Dizionario di pratica in testo chiaro (formato Anonimator)
status: accepted
date: 2026-06-01
binding: true
domain: storage
supersedes: []
superseded_by: null
security_impact: low
legal_impact: low
code_refs:
  - src/practice/entityDictionary.ts
---

# Contesto

In una pratica legale tutti i documenti condividono le stesse parti. Serve un "dizionario di
pratica" che salvi le entità revisionate per ricaricarle nella sessione successiva, evitando di
rilevare da zero le stesse entità ogni volta. Anonimator (da cui AnonyMCP deriva) usa già un file
JSON con `{ originalText, pseudonym, type }`.

Un council aveva proposto di salvare solo gli hash delle entità (non il testo originale) per
sicurezza. Ma questo è un falso problema (vedi ADR-0001): se l'attaccante ha accesso al
dizionario, ha già accesso ai documenti originali nelle stesse cartelle.

# Decisione

Il dizionario di pratica contiene il **testo originale in chiaro**, nel formato di Anonimator:

```json
{
  "version": 1,
  "practiceId": "400f",
  "exportedAt": "2026-06-01T...",
  "entries": [
    { "original": "Mario Rossi", "pseudonym": "M. R.", "type": "PERSONA" }
  ]
}
```

Salvato accanto ai documenti della pratica. Leggibile e modificabile a mano se serve. Cifratura
opzionale (ADR-0001), non obbligatoria.

Il dizionario **non è mai esposto via MCP** — non viola lo scopo (nessun leak verso l'LLM).

# Alternative considerate

- **Hash-only**: rifiutata — non aggiunge protezione reale (vedi ADR-0001) e impedisce la
  rilettura/correzione manuale del dizionario.
- **Testo cifrato**: opzionale, non obbligatorio.

# Conseguenze

- `SessionManager.importFromDictionary()` precarica il mapping testo→pseudonimo dal dizionario.
- Riuso 1:1 del formato Anonimator → facilita import/export tra i due strumenti.
- Il dizionario è un file locale: non introduce esposizione rispetto ai documenti già presenti.
