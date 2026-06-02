# Architecture Decision Records — Indice

> **Per LLM e sviluppatori**: prima di proporre qualsiasi funzionalità che tocca uno dei domini
> sotto, leggi l'ADR corrispondente. Le decisioni `accepted` sono **vincolanti**: non si
> contraddicono senza creare un nuovo ADR che le sostituisce (`supersedes`).

Un ADR = una decisione architetturale, una per file. Formato: frontmatter YAML (machine-readable)
+ corpo Markdown (human-readable). Le decisioni accettate non si riscrivono nel merito: se cambia
la direzione, si crea un nuovo ADR che fa `supersedes` del precedente.

## Decisioni correnti

| ID | Titolo | Dominio | Stato | Vincolante |
|---|---|---|---|---|
| [0001](0001-encryption-at-rest-optional.md) | Cifratura a riposo opzionale, non requisito primario | security | accepted | sì |
| [0002](0002-search-bm25.md) | Ricerca full-text con BM25 + SQLite FTS5 | search | accepted | sì |
| [0003](0003-dictionary-plaintext.md) | Dizionario di pratica in testo chiaro (formato Anonimator) | storage | accepted | sì |
| [0004](0004-practice-label-opaque.md) | Label/folderId pratica = numero opaco, mai nomi delle parti | security | accepted | sì |
| [0005](0005-mcp-write-rehydration.md) | Scrittura MCP con re-idratazione locale e quarantena | security | accepted | sì |
| [0006](0006-entity-consolidation-rehydration.md) | Consolidamento entità (id-entità interno) per la re-idratazione | security | accepted | sì |
| [0007](0007-ner-model-target.md) | Target NER Fase 2 = italian-ner-xxl-v2, non Italian-Legal-BERT | pipeline | accepted | sì |

## Come si legge un ADR

- `status: accepted` → decisione attiva e vincolante
- `status: superseded` → sostituita da un ADR più recente (vedi `superseded_by`)
- `binding: true` → non rinegoziabile senza nuovo ADR
- `domain` → l'area toccata (search, security, storage, …): usalo per il lookup rapido
