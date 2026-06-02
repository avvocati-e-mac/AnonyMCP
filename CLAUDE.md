# CLAUDE.md — AnonyMCP

Server MCP locale che **pseudonimizza** documenti legali italiani prima di esporli a un LLM.
Fase 1: server stdio standalone (gestisce `.txt`/`.md`). Fase 2: app Electron. Open-source
(AGPL-3.0). Riusa il motore di `avvocati-e-mac/anonimator`.

> ⚠️ **Pseudonimizzazione, non anonimizzazione**: l'output resta dato personale (Garante/EDPB).

## Sincronizzazione istruzioni agenti

`AGENTS.md` e `CLAUDE.md` devono restare sincronizzati. Ogni modifica apportata a uno dei due
file va replicata anche nell'altro, nella stessa forma, prima di considerare concluso il lavoro.

## 🎯 SCOPO — la stella polare di ogni decisione

**AnonyMCP esiste per UN solo motivo: impedire che dati personali in chiaro finiscano in un
LLM cloud.** È un filtro tra i documenti dell'avvocato e l'LLM online (Claude, GPT, ecc.).

Cosa è **DENTRO** lo scopo (priorità assoluta):
- Nessun dato reale (nomi, CF, IBAN, indirizzi…) deve MAI uscire dal server verso l'LLM.
- Il testo esposto via MCP è sempre pseudonimizzato e approvato da un umano.

Cosa è **FUORI** dallo scopo (NON è compito dell'MCP):
- Proteggere i documenti dal furto fisico del PC → è compito del sistema operativo (FileVault).
- Se l'SSD non è cifrato, i dati originali sono già accessibili a prescindere da AnonyMCP.
- Quindi: **non sovra-ingegnerizzare la sicurezza at-rest** (cache/dizionario/indice locali).
  La cifratura locale è buona pratica, NON il requisito primario. Il dato originale è già nelle
  cartelle delle pratiche, che l'utente gestisce: una copia locale in più non cambia il rischio.

**Test mentale per ogni proposta**: «Questa scelta riduce il rischio di leak verso l'LLM cloud?»
Se la risposta è no, non è una priorità. Se introduce un leak, va respinta a prescindere
dall'ergonomia.

## Invarianti di sicurezza — NON negoziabili
La sicurezza viene prima dell'ergonomia. Ogni modifica va verificata contro queste regole
(versione estesa + dove sono nel codice: [security-invariants](docs/agent-guides/security-invariants.md)).

1. **Mai loggare su stdout** (è il canale JSON-RPC) → usa `src/util/logger.ts` (stderr).
2. **Mai PII in chiaro nell'OUTPUT verso l'LLM** (il vincolo primario è sul canale MCP, non sul
   disco locale — vedi §SCOPO): mappa reale↔pseudonimo solo in RAM (`SessionManager`); la cache
   `.anonymcp` contiene solo hash, cifrata AES-256-GCM. Il dizionario di pratica locale può
   contenere testo in chiaro (non è mai esposto via MCP).
3. **Niente tool MCP di de-anonimizzazione/get_mapping**. La reversibilità è un proxy locale,
   fuori dal protocollo.
4. **Anonimizza PRIMA di chunking/indice/embedding** (gli embedding sono invertibili).
5. **Sanitizza il Markdown prima di anonimizzare** (zero-width/entità HTML/NFKC/sillabazione):
   `src/pipeline/toMarkdown.ts`.
6. **Dati art. 9/10 (penale/salute/minori) mai a LLM cloud** → classifica con `riskScorer`;
   con `allowCloudForSensitive=false` il documento sensibile approvato resta non esponibile
   come Resource/read/search.
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

## ⛔ PRIMA DI PROPORRE QUALSIASI FUNZIONALITÀ

**OBBLIGATORIO**: Leggi `ARCHITETTURA.md` (spec. §8-§9) e `docs/adr/INDEX.md`
prima di suggerire qualsiasi implementazione. Proporre una soluzione che duplica
una decisione ADR esistente è un errore critico.

**Checklist pre-proposta:**
1. Cerca keyword nel codebase (`grep -r "search\|index\|crypto\|..."`)
2. Leggi ARCHITETTURA.md sezione rilevante
3. Leggi `docs/adr/INDEX.md` per decisioni vincolanti nel dominio
4. Controlla se esiste già in `avvocati-e-mac/anonimator` (AnonyMCP è una derivazione)
5. Solo se non trovato → proponi nuova implementazione citando la ricerca eseguita

**Decisioni architetturali vincolanti (non rinegoziabili senza nuovo ADR):**
- **Ricerca**: BM25 + SQLite FTS5 (ADR-002). NO a Elasticsearch/Qdrant/vettori.
- **Cifratura a riposo**: AES-256-GCM dove usata (ADR-001) — buona pratica, NON requisito
  primario (vedi §SCOPO: la protezione at-rest esula dallo scopo dell'MCP).
- **Dizionario entità di pratica**: può contenere testo originale (come Anonimator), salvato
  accanto ai documenti della pratica (ADR-003). Non aggiunge rischio rispetto ai file originali
  già presenti. La cifratura è opzionale, non obbligatoria.
- **Label/folderId pratiche**: solo numeri opachi (es. "400F"), mai nomi delle parti — QUESTO
  sì è critico perché il label è esposto all'LLM via `list_folders` (ADR-004).
- **Scrittura LLM→cartella (M-Write)**: l'LLM non tocca il disco; l'MCP salva le bozze
  **re-idratate** (pseudonimo→reale) con un passaggio LOCALE, mai un tool di de-anon; pathGuard
  + quarantena/staging; return senza PII; co-reference risolta via id-entità interno, ambiguità
  fail-safe (ADR-005, consolidamento entità in ADR-006). Solo formati testuali (binari = futura).
- **NER Fase 2**: target `italian-ner-xxl-v2`, non Italian-Legal-BERT (ADR-007). Il motivo è
  pratico: serve una `NerFn` che restituisca entità da pseudonimizzare; un Legal-BERT generico
  richiederebbe fine-tuning/dataset/validazione prima di diventare NER.

## Sviluppo con assistenti CLI + commit atomici
- **Capisci lo SCOPO prima di modificare.** Prima di riscrivere/semplificare qualcosa,
  articola esplicitamente *a cosa serve per l'utente* e verifica che la modifica preservi
  quello scopo. Semplificare non deve mai buttare via la funzione reale. **Se lo scopo non
  è chiaro, CHIEDI esplicitamente** (AskUserQuestion) invece di assumere.
- **Plan mode** prima di scrivere; task atomici (5–10 min); review del diff prima del commit.
- **Branch dedicato prima delle modifiche**: non lavorare direttamente su `main`/branch stabile,
  salvo richiesta esplicita dell'utente. Crea o usa un branch descrittivo per il task prima di
  editare e committare (es. `codex/<ambito>`).
- **Commit atomico = una decisione**, reversibile con `git revert`. Test + doc nello **stesso
  commit** del codice. Messaggio che spiega il *perché* + `Co-Authored-By: Claude Opus 4.8
  <noreply@anthropic.com>`.
- Per decisioni di sicurezza/architettura usa la **formula consiglio LLM** e il **council
  multi-modello** → [development-process](docs/agent-guides/development-process.md).
- Prima di committare: `npm run typecheck` e `npm test` verdi; nessun dato reale nei
  fixture/commit (`.gitignore`: `*.anonymcp`, `anonymcp.config.json`, indici).
- **Done = worktree pulito o eccezione esplicita**: prima della risposta finale, se sono state
  fatte modifiche al repository, il worktree deve essere pulito con commit atomici già creati.
  Se non si committa, spiegare esplicitamente il motivo e indicare quali file restano modificati.

## Mappa della documentazione (progressive disclosure)
Apri solo ciò che serve al task:
- **Decisioni architetturali (ADR)** → [docs/adr/INDEX.md](docs/adr/INDEX.md) ← leggi PRIMA di proporre
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
  practice/     practiceStore (cache cifrata), practiceRegistry (stato/review), entityDictionary,
                writeService + writeApprovalStore (M-Write: scrittura LLM→cartella, ADR-0005)
  search/       chunkIndex (BM25 su SQLite FTS5)
  tui/          review TUI Ink (Fase 1): entityColors, highlight, reviewApp
  util/         logger (stderr), crypto (AES-GCM/HMAC), pathGuard
test/           vitest (unit + anti-leak + e2e + redteam)
docs/adr/       Architecture Decision Records (decisioni vincolanti)
docs/agent-guides/  guide di dettaglio (Tier-3)
```

> Stato: Fase 1 + M-Write implementati (suite test verde). Inizio Fase 2 (vedi
> [docs/ROADMAP-fase2.md](docs/ROADMAP-fase2.md); prossima milestone = app Electron). **Non**
> ancora deployabile in produzione legale: vedi checklist Go/No-Go nel piano e i gap in
> [threat-model](docs/agent-guides/threat-model.md).
