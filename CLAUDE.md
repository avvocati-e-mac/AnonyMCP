# CLAUDE.md — AnonyMCP

Server MCP locale che **pseudonimizza** documenti legali italiani prima di esporli a un LLM.
Fase 1: server stdio standalone (gestisce `.txt`/`.md`). Fase 2: app Electron. Open-source
(AGPL-3.0). Riusa il motore di `avvocati-e-mac/anonimator`.

> ⚠️ **Pseudonimizzazione, non anonimizzazione**: l'output resta dato personale (Garante/EDPB).

## Invarianti di sicurezza — NON negoziabili
La sicurezza viene prima dell'ergonomia. Ogni modifica va verificata contro queste regole
(versione estesa + dove sono nel codice: [security-invariants](docs/agent-guides/security-invariants.md)).

1. **Mai loggare su stdout** (è il canale JSON-RPC) → usa `src/util/logger.ts` (stderr).
2. **Mai PII in chiaro su disco**: mappa reale↔pseudonimo solo in RAM (`SessionManager`); la
   cache `.anonymcp` contiene solo hash, cifrata AES-256-GCM.
3. **Niente tool MCP di de-anonimizzazione/get_mapping**. La reversibilità è un proxy locale,
   fuori dal protocollo.
4. **Anonimizza PRIMA di chunking/indice/embedding** (gli embedding sono invertibili).
5. **Sanitizza il Markdown prima di anonimizzare** (zero-width/entità HTML/NFKC/sillabazione):
   `src/pipeline/toMarkdown.ts`.
6. **Dati art. 9/10 (penale/salute/minori) mai a LLM cloud** → classifica con `riskScorer`.
7. **Valida ogni path** (`src/util/pathGuard.ts`): allowlist, no traversal, docId/URI opachi (HMAC).
8. **Quarantena di default** (`requireManualApproval`): niente esposizione senza approvazione umana.
9. **Errori azionabili**, mai stack trace ai client (`isError` + prossimo passo).

## Comandi
```bash
npm install
npm run build        # tsc → dist/
npm test             # vitest (tutta la suite)
npm run typecheck    # tsc --noEmit
npm run gen:fixtures # rigenera i documenti sintetici di test
npm run inspector    # MCP Inspector sul server compilato
npm start            # avvia (richiede anonymcp.config.json)
```

## Sviluppo con assistenti CLI + commit atomici
- **Plan mode** prima di scrivere; task atomici (5–10 min); review del diff prima del commit.
- **Commit atomico = una decisione**, reversibile con `git revert`. Test + doc nello **stesso
  commit** del codice. Messaggio che spiega il *perché* + `Co-Authored-By: Claude Opus 4.8
  <noreply@anthropic.com>`.
- Per decisioni di sicurezza/architettura usa la **formula consiglio LLM** e il **council
  multi-modello** → [development-process](docs/agent-guides/development-process.md).
- Prima di committare: `npm run typecheck` e `npm test` verdi; nessun dato reale nei
  fixture/commit (`.gitignore`: `*.anonymcp`, `anonymcp.config.json`, indici).

## Mappa della documentazione (progressive disclosure)
Apri solo ciò che serve al task:
- **Architettura, diagrammi, processo** → [ARCHITETTURA.md](ARCHITETTURA.md)
- **Invarianti di sicurezza (estese)** → [security-invariants](docs/agent-guides/security-invariants.md)
- **Threat model (STRIDE)** → [threat-model](docs/agent-guides/threat-model.md)
- **Convenzioni MCP** → [mcp-conventions](docs/agent-guides/mcp-conventions.md)
- **Convenzioni di codice** (ESM `.js`, regex globali, hash) → [code-conventions](docs/agent-guides/code-conventions.md)
- **Testing** (≥1 test/funzione, anti-leak, fuzzing) → [testing](docs/agent-guides/testing.md)
- **Processo di sviluppo + formula LLM** → [development-process](docs/agent-guides/development-process.md)

## Struttura
```
src/
  index.ts      entrypoint stdio        server.ts   McpServer: tool + resources
  config.ts     load/validate (Zod)     types.ts    tipi condivisi
  engine/       pseudonimizzazione (regex, sessionManager, anonymizer, legalStopWords)
  pipeline/     toMarkdown, metadataStripper, riskScorer, documentService
  practice/     practiceStore (cache cifrata), practiceRegistry (stato/quarantena)
  util/         logger (stderr), crypto (AES-GCM/HMAC), pathGuard
test/           vitest (unit + anti-leak + e2e + redteam)
docs/agent-guides/  guide di dettaglio (Tier-3)
```

> Stato: Fase 1 implementata (94 test verdi). **Non** ancora deployabile in produzione legale:
> vedi checklist Go/No-Go nel piano e i gap in [threat-model](docs/agent-guides/threat-model.md).
