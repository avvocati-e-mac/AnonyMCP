# CLAUDE.md — Guida di sviluppo per AnonyMCP

Istruzioni per chiunque (umano o LLM) sviluppi questo progetto. Leggi anche
`ARCHITETTURA.md` e il piano in `~/.claude/plans/`.

## Cos'è

Server MCP locale che **pseudonimizza** documenti legali italiani prima di esporli a un LLM.
Fase 1: server stdio standalone. Fase 2: app Electron. Open-source (AGPL-3.0).

## Comandi

```bash
npm install
npm run build          # compila in dist/
npm test               # vitest (tutta la suite)
npm run test:watch
npm run typecheck      # tsc --noEmit
npm run gen:fixtures   # rigenera i documenti sintetici di test
npm run inspector      # MCP Inspector sul server compilato
npm start              # avvia il server (richiede anonymcp.config.json)
```

## Regole di sicurezza NON negoziabili

Questo è uno strumento di privacy: la sicurezza viene prima dell'ergonomia.

1. **Mai loggare su stdout.** stdout è il canale JSON-RPC. Usa `util/logger.ts` (stderr).
2. **Mai persistere PII in chiaro.** La mappa reale↔pseudonimo vive **solo in RAM**
   (`SessionManager`). La cache su disco contiene solo hash (`practiceStore`), cifrata.
3. **Niente tool di de-anonimizzazione/get_mapping** esposti via MCP. La reversibilità è
   solo nel proxy locale, fuori dal protocollo.
4. **Anonimizza PRIMA di chunking/indice/embedding.** Gli embedding sono invertibili.
5. **Sanitizza il Markdown prima di anonimizzare** (de-frammenta `M**ari**o`, togli
   HTML/link/frontmatter).
6. **Dati art. 9/10 (penale/salute/minori) → mai a LLM cloud.** Classifica con `riskScorer`.
7. **Valida ogni path** con `util/pathGuard.ts`; esponi solo le cartelle in allowlist; i
   documenti vanno in **quarantena** finché non approvati.
8. **Errori azionabili, mai stack trace ai client.** Nei tool usa `isError` + messaggio con
   il prossimo passo.

## Standard MCP (2025-11-25)

- Documenti = **Resources** (dati passivi), non tool di lettura.
- Tool = solo **azioni**, snake_case con prefisso `anonymcp_`, con `inputSchema` Zod e
  `annotations` (`readOnlyHint`/`idempotentHint`/`openWorldHint`).
- Capability `resources.listChanged`; chiama `sendResourceListChanged()` quando l'elenco cambia.
- Aggiungi `structuredContent` oltre al `content` testuale.

## Convenzioni di codice

- TypeScript ESM, `Node16` module resolution → **gli import relativi finiscono in `.js`**
  (es. `import { log } from './util/logger.js'`).
- `strict` + `noUncheckedIndexedAccess`. Niente `any` non giustificato.
- Riusa il motore di Anonimator: prima di aggiungere un pattern/entità, controlla
  `engine/regexPatterns.ts` e `engine/legalStopWords.ts`.
- I pattern regex sono globali e condivisi: **clona** (`new RegExp(p.source, p.flags)`) prima
  di usarli con `exec`/`test` per evitare bug di `lastIndex`.

## Testing (requisito: ≥1 test per funzione)

- Ogni funzione esportata ha almeno un test in `test/`.
- **Test anti-leak**: per ogni fixture, asserisci che le entità reali (`manifest.mustNotLeak`)
  NON compaiano nell'output. È il test più importante.
- I fixture sintetici usano **dati finti** (mai reali) e coprono le 4 materie.
- L'e2e (`server.e2e.test.ts`) parla col server via `InMemoryTransport` + `Client` MCP.
- Il NER reale non è in Fase 1: nei test si inietta uno **stub `NerFn`** per simulare il
  layer BERT/Italian-Legal-BERT.

## Metodo (antirez)

Human-in-the-loop, niente vibe coding cieco: comprendi ogni riga, mantieni il codice minimale,
fornisci contesto ampio all'LLM. Per decisioni di design importanti, usa più modelli in
back-and-forth (qui: consigli GPT/Gemini/Kimi documentati nel piano).

## Struttura

```
src/
  index.ts            entrypoint stdio
  server.ts           McpServer: tool + resources
  config.ts           load/validate config (Zod)
  types.ts            tipi condivisi
  engine/             motore pseudonimizzazione (da Anonimator)
  pipeline/           toMarkdown, metadataStripper, riskScorer, documentService
  practice/           practiceStore (cache cifrata), practiceRegistry (stato)
  util/               logger (stderr), crypto (AES-GCM), pathGuard
test/                 vitest (unit + anti-leak + e2e)
scripts/              generateFixtures
```

## Prima di committare

- `npm run typecheck` e `npm test` verdi.
- Nessun dato reale nei fixture o nei commit (vedi `.gitignore`: `*.anonymcp`,
  `anonymcp.config.json`, indici).
- Messaggi di commit con `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
