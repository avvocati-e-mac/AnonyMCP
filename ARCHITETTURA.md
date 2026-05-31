# Architettura di AnonyMCP

> Documento di architettura puntuale dell'app e del server MCP. Frutto di ricerca
> (spec MCP 2025-11-25, antirez, Garante/EDPB) e di tre consigli LLM di red teaming.

## 1. Scopo e principio

AnonyMCP è un **server MCP locale** che **pseudonimizza** i documenti di una pratica
*prima* di esporli a un LLM (Claude/GPT/Gemini, o un LLM locale). È l'utente a scegliere
quali cartelle esporre. Nulla di sensibile lascia la macchina in chiaro.

> ⚠️ **Pseudonimizzazione, non anonimizzazione.** Ai sensi del Garante e dell'EDPB
> (linee guida gen 2025), il testo prodotto resta **dato personale**: i 3 test del Garante
> — *single-out*, *linkability*, *inference* — possono comunque fallire per
> re-identificazione da contesto. Vedi §7.

## 2. Le due fasi

- **Fase 1 (questo repo)** — server MCP stdio standalone. Le cartelle sono configurate a
  mano in `anonymcp.config.json`. Gestisce documenti testuali (`.txt`, `.md`).
- **Fase 2** — app desktop **Electron** (evoluzione di `avvocati-e-mac/anonimator`): UI di
  consenso cartelle, log live, gestione pratiche, parser binari (PDF/DOCX/OCR), NER
  Italian-Legal-BERT in worker, generatori DPIA/registro.

## 3. Perché Electron (e non Tauri)

Il motore di anonimizzazione è già Node/TS con dipendenze native pesanti
(`@huggingface/transformers`, onnxruntime, tesseract, pdfjs). Electron include Node →
riuso 1:1 e MCP server in-process. Tauri (Rust) imporrebbe un sidecar Node che annulla il
vantaggio di peso (dominato comunque dai modelli ONNX). Confermato dal consiglio LLM.

## 4. Pipeline di un documento

```
file → [strip metadati] → [sanitize Markdown] → [PSEUDONIMIZZA] → [classifica sensibilità]
     → [rischio residuo] → quarantena → (approvazione umana) → Resource MCP
                                                                    ↓
                                            LLM (locale, o cloud se NON sensibile)
```

Ordine **non negoziabile**: l'anonimizzazione precede qualsiasi artefatto persistente
(chunk/indice/embedding). Motivo: gli **embedding sono invertibili** (attacchi GEIA),
quindi indicizzare testo non anonimizzato = leak a riposo.

Moduli (Fase 1): `pipeline/metadataStripper.ts`, `pipeline/toMarkdown.ts`,
`engine/anonymizer.ts`, `pipeline/riskScorer.ts`, `pipeline/documentService.ts`.

### Sanitizzazione (anti prompt-injection / anti evasione)
`sanitizeMarkdown` rimuove frontmatter, commenti HTML, tag HTML, link/immagini esterni
(SSRF/esfiltrazione) e **de-frammenta l'enfasi inline** (`M**ari**o` → `Mario`) così che il
NER non venga evaso. L'anonimizzazione avviene sul testo de-frammentato, non sul Markdown.

## 5. Il motore di pseudonimizzazione

Portato da Anonimator, senza dipendenze Electron:
- `engine/regexPatterns.ts` — pattern legali italiani (CF, P.IVA, IBAN, email, **PEC**,
  telefono, indirizzi, targhe, date nascita, header sentenza, parti, difensori, **R.G.**,
  **protocollo**).
- `engine/legalStopWords.ts` — veto filter: ruoli processuali e intestazioni di sezione che
  il BERT scambia per nomi.
- `engine/sessionManager.ts` — dizionario `originale → pseudonimo` **solo in RAM**, coerente
  (stesso testo → stesso pseudonimo), iniziali + fallback numerico. Mai su disco in chiaro.
- `engine/anonymizer.ts` — regex + co-reference (il cognome eredita lo pseudonimo del nome
  completo) + veto filter + **NER iniettabile** (`NerFn`). In Fase 1 il default è solo-regex;
  in Fase 2 si inietta Italian-Legal-BERT (ONNX, in worker).

## 6. Il server MCP (spec 2025-11-25)

- **Trasporto**: stdio. Log **solo su stderr** (stdout è il canale JSON-RPC).
- **Documenti = Resources** `anonymcp://practice/{folderId}/{docId}` (text/markdown), con
  `resources/list` e capability **`listChanged`** (notifica quando cambia l'elenco). I
  documenti sono passivi → Resources, non tool di lettura.
- **URI opachi**: il `docId` è un hash del path (i nomi file reali non sono esposti).
- **Solo documenti APPROVATI** sono esposti; quelli in quarantena no.

### I 4 tool (solo *azioni*)
| Tool | Annotation | Funzione |
|---|---|---|
| `anonymcp_list_folders` | readOnly | elenca le pratiche esposte |
| `anonymcp_scan_practice` | idempotent | (ri)scansiona e pseudonimizza; quarantena |
| `anonymcp_get_practice_status` | readOnly | conteggi (mai valori reali) |
| `anonymcp_search` | readOnly | cerca placeholder/testo nei doc approvati → estratti + URI |

**Assenti by design** (bocciati dal red teaming): `get_mapping`, `deanonymize`. La mappa
reversibile vive solo in RAM lato server; la de-anonimizzazione, se serve, è fatta da un
**proxy locale** sulla risposta dell'LLM verso l'utente — mai come tool MCP (eviterebbe il
leak del dato reale via prompt-injection).

## 7. Sicurezza e privacy

- **Quarantena + approvazione umana** (`requireManualApproval`, default on): un documento
  appena scansionato non è esposto finché un umano non lo approva.
- **Cache pratica cifrata** (`practice/practiceStore.ts`): blob `.anonymcp` AES-256-GCM,
  accanto ai documenti, **senza PII in chiaro** (solo `sha256(originale)`), invalidata se
  `sourceHash`/`engineVersion` cambiano, sempre esclusa dalle Resources.
- **pathGuard** (`util/pathGuard.ts`): no directory traversal, allowlist cartelle, blocco
  artefatti interni.
- **Dati sensibili (art. 9/10 GDPR) → mai a LLM cloud**: `riskScorer.classifySensitivity`
  marca penale/salute/minori/vita sessuale/convinzioni; tali documenti vanno serviti solo a
  LLM locale (Fase 2 applica il blocco verso endpoint cloud).
- **Rischio residuo** (`riskScorer.residualRisk`): segnali di linkability ancora presenti
  (R.G., udienza, importi, IBAN) alzano il punteggio; sopra soglia → blocco/doppia approvazione.

### Obblighi legali (studio legale italiano)
- Cifratura fascicoli (art. 32 GDPR) → cache/indice cifrati.
- Segreto professionale (art. 13 C.D.F.; base art. 9(3) GDPR) → nulla esce non pseudonimizzato.
- Oscuramento obbligatorio categorie protette (vittime, minori — art. 52 D.Lgs. 196/2003) →
  modalità "safe export" (Fase 2).
- DPIA + registro dei trattamenti per dati penali/sanitari massivi (Fase 2: template).

## 8. Token-minimization (Fase 2)

Invece di interi documenti, si espongono **chunk rilevanti** già pseudonimizzati, indicizzati
con **BM25 cifrato** (SQLite FTS5 + SQLCipher; non vettori, over-engineering senza GPU). La
ricerca per nome reale passa per un **query-translator locale** (reale→placeholder via vault
cifrato), mai dal server MCP. Vettori solo come fase 3 se il recall lo richiede.

## 9. Limiti noti / non-deployabile "as-is"

Il consiglio LLM ha dato verdetto **non deployabile in produzione legale senza remediation**.
Vedi la checklist Go/No-Go nel piano. In sintesi mancano (per la produzione): NER
specializzato legale validato, generalizzazione contestuale completa, audit trail immutabile +
RBAC, DPIA/registro, e i parser binari sandboxati (Fase 2).
