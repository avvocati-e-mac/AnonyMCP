# Changelog

Tutte le modifiche rilevanti a questo progetto sono documentate qui.

Il formato segue [Keep a Changelog](https://keepachangelog.com/it/1.1.0/)
e il progetto adotta il [versionamento semantico](https://semver.org/lang/it/).

## [Unreleased]

## [0.2.0-beta.1] - 2026-06-11

### Aggiunto — Sicurezza
- RT-01 chiuso: l'allowlist delle pratiche contiene solo percorsi canonici (`realpath` in
  `loadConfig`); l'import Electron scarta le directory symlink durante la discovery e
  canonicalizza le selezioni manuali, impedendo che un symlink dentro la root esponga
  cartelle esterne con label opaca.
- RT-06 chiuso ([ADR-0008](docs/adr/0008-residual-risk-explicit-ack.md)): oltre la soglia di
  rischio residuo contestuale l'approvazione richiede una conferma esplicita (spunta nella UI
  Electron, prompt nella TUI), persistita in `pratica.approvals.json`. Le approvazioni storiche
  senza conferma su documenti ad alto rischio decadono in review (fail-closed). Nessun blocco
  MCP duro: l'esposizione resta una decisione professionale consapevole e registrata.

### Corretto
- Rilevazione entità sintetiche rafforzata (regex, sanitizer, stop words legali): identificatori
  strutturati, indirizzi, società e intestazioni non finiscono più nel dizionario o nel testo
  esposto (red-team sintetico esteso).
- Stato config Electron onesto: la UI espone se usa `ANONYMCP_CONFIG`, segnala la divergenza con
  la config del server e non suggerisce più un client LLM verificato; label opache forzate
  all'import.
- Il segnale "importi" del rischio residuo ora rileva anche le forme `1.000,00 €` e
  `euro 9.600,00` (valuta prima della cifra, frequente negli atti): entrambe sfuggivano
  al pattern per via dei word boundary attorno a `€`.

### Build/Sviluppo
- Guard ABI `better-sqlite3`: `pretest` rileva una build Electron residua e ricompila per Node;
  gli script `app:dist*` ripristinano l'ABI Node a fine packaging; nuovi comandi
  `rebuild:node` / `rebuild:electron`.
- `rebuild:electron` usa `electron-rebuild --force` e su macOS ri-firma ad-hoc il binario
  (collaudo su app reale: `install-app-deps` era un no-op silenzioso con FTS5 degradata, e il
  binario non ri-firmato faceva uccidere Electron da dyld con "Code Signature Invalid").

### Documentazione
- Guida visuale passo-passo dell'app desktop per avvocati non tecnici
  (`docs/guida-app-avvocato.md`).
- Threat model allineato ai test esistenti (corpus label opache, trusted renderer URL e log
  renderer senza PII erano già coperti dalla suite).

## [0.1.1-beta.1] - 2026-06-04

### Modificato — Electron UI
- Dashboard riorganizzata con top nav persistente: `Dashboard`, `Review`, `Bloccati`, `Bozze`,
  `Scansione`, con badge accessibili per le cose da gestire.
- La dashboard mostra situazione MCP locale e azioni principali; le liste operative lunghe sono
  spostate nelle pagine dedicate.
- La sezione `Cosa devo fare adesso` usa card azionabili con badge numerici circolari in tono e
  CTA centrate (`Apri Review`, `Apri Bloccati`, `Apri Bozze`, `Apri Scansione`).
- La scansione usa il copy `Cerca nuovi documenti nelle pratiche`; i conteggi pratica sono badge
  compatti senza spazi vuoti inutili.
- Il badge di stato e' rinominato `Config UI pronta` per non suggerire che il client LLM collegato
  sia gia' stato verificato.

### Aggiunto — Release e aggiornamenti
- Linee guida canoniche per distinguere aggiornamenti major, feature/minor e tech/patch, con gate
  beta/pre-release e finale.
- Il workflow release distingue versioni con suffisso pre-release (`x.y.z-beta.N`) da versioni
  finali (`x.y.z`): le beta GitHub sono `pre-release`, le finali no.

## [0.1.0-beta.1] - 2026-06-03

> Beta desktop di test: non ancora deployabile in produzione legale. Serve a provare la UI
> Electron, il flusso di review locale e il packaging multipiattaforma.

### Aggiunto — Fase 2 / Electron app
- Baseline Electron/Vite/React/Tailwind/Zustand con main/preload/renderer separati,
  `contextIsolation`, `sandbox`, `nodeIntegration=false`, CSP restrittiva e IPC nominale
  validato con Zod. La prima UI mostra onboarding privacy, setup pratiche se manca la config
  e dashboard generale preliminare; non collega ancora review/import reale al motore.
- Servizio locale `LocalReviewService` per la futura UI Electron: dashboard pratiche, lista
  documenti da review, dettaglio locale originale/pseudonimizzato, entità manuali, approvazione,
  pending write e documenti sensibili bloccati per il cloud.
- Persistenza locale delle decisioni dell'avvocato sui documenti sensibili
  (`pratica.sensitivity.json`): AnonyMCP suggerisce, ma l'avvocato può forzare `Sensibile` o
  `Non sensibile`; la decisione è legata all'hash del documento e non contiene nomi/path reali.
- IPC Electron validato con Zod per dashboard, scan pratica, lista review e lista documenti
  sensibili bloccati. La dashboard ora mostra contatori reali e permette di scansionare una
  pratica dalla UI.
- Prima schermata di review grafica: dettaglio documento con testo originale locale e testo
  pseudonimizzato, checklist entità, aggiunta manuale, override sensibilità e approvazione.
- Setup cartelle dalla UI Electron con dialog di sistema e tre modalità: pratiche manuali,
  cartella principale "Pratiche" e struttura Clienti/Pratiche. Gli ID/label vengono assegnati
  automaticamente come opachi quando il nome cartella sembra identificante.
- L'inserimento manuale delle pratiche ha una schermata dedicata con drag and drop di una o
  più cartelle e scelta alternativa tramite finestra di sistema.
- Review locale delle bozze LLM in staging: la UI mostra la bozza completata localmente con dati
  reali solo in locale e consente la promozione esplicita nella cartella finale della pratica.
- I payload MCP verso Claude/Codex non suggeriscono piu' comandi Terminale/TUI per review e
  bozze in attesa: indicano invece la dashboard Electron di AnonyMCP come punto di conferma
  locale.
- La dashboard Electron mostra percorso/hash della configurazione e ID pratiche locali, cosi'
  l'avvocato puo' accorgersi se l'app e il client MCP esterno stanno leggendo configurazioni
  diverse.
- La dashboard usa una tabella attivita' compatta con filtri e ricerca per documenti da review,
  documenti sensibili bloccati e bozze LLM, riducendo spazio verticale sprecato.
- La review documento e' ora una schermata separata con evidenziazione colorata delle entita',
  preview originale/pseudonimizzata affiancate e scroll sincronizzato.

### Aggiunto — Fase 2 / M-Write (scrittura LLM→cartella)
- Strumenti MCP `anonymcp_write_document` e `anonymcp_create_folder`: l'LLM salva bozze
  testuali nella pratica senza toccare il disco. La bozza è **re-idratata** (pseudonimo→reale)
  in locale prima di scrivere; con `requireManualApproval` va in staging e attende conferma
  umana dalla UI locale AnonyMCP. Formati testuali (`.md/.txt/.tex/.csv/.json/.xml/.html`).
  Vedi **ADR-0005**.
- **Consolidamento entità (id interno)**: la co-reference ("Mario Rossi" e il successivo
  "Rossi") condivide un id-entità interno (RAM-only, mai esposto), così la re-idratazione la
  collassa correttamente e usa la forma canonica. L'omonimia di iniziali resta distinta; il
  cognome condiviso da più persone NON viene ri-idratato (fail-safe + segnalazione). Il
  `canonical` è persistito nel dizionario di pratica come campo opzionale retrocompatibile.
- **ADR-0007**: target NER Fase 2 fissato a `italian-ner-xxl-v2`, non Italian-Legal-BERT.

### Corretto — red-team 2026-06-02
- `addManualEntity` ri-pseudonimizza dal testo canonico/sanitizzato, evitando di reintrodurre
  frontmatter o metadati raw dopo una correzione manuale.
- `allowCloudForSensitive=false` è ora applicato a Resource list, read diretto e search:
  documenti sensibili approvati restano non esponibili al canale MCP cloud.
- M-Write verifica l'hash dello staging prima della promozione, blocca pending duplicati salvo
  `overwrite=true` e non sovrascrive file finali creati dopo lo staging.
- La TUI applica davvero le entità confermate/escluse dall'utente prima di approvare.
- La config avvisa anche se il `folderId`, non solo il `label`, sembra contenere nomi delle parti.
- Il contatore dei documenti sensibili bloccati conta tutti i documenti sensibili non esponibili
  al cloud, non solo quelli gia' approvati.

## [0.1.0] - 2026-06-02

Prima release pubblica — **Fase 1** (server MCP stdio standalone, beta).

> ⚠️ Stato beta: non ancora deployabile in produzione presso uno studio legale
> (vedi `docs/agent-guides/threat-model.md`). L'output resta *dato personale*
> (pseudonimizzazione, non anonimizzazione).

### Aggiunto
- **Server MCP stdio** che pseudonimizza i documenti di una pratica *prima* di esporli
  a un LLM cloud. Quattro strumenti: `list_folders`, `scan_practice`,
  `get_practice_status`, `search`. I documenti sono esposti come **MCP Resources** già
  pseudonimizzati.
- **Motore di pseudonimizzazione**: regex specializzate per documenti legali italiani
  (nomi, CF, P.IVA, IBAN, indirizzi, email, telefoni, targhe, numeri documento),
  co-reference resolution e veto-filter sui ruoli processuali. Riusa il motore di
  [`avvocati-e-mac/anonimator`](https://github.com/avvocati-e-mac/anonimator).
- **Mappa reale↔pseudonimo solo in RAM** (`SessionManager`): nessuno strumento MCP di
  de-anonimizzazione.
- **Quarantena + approvazione umana** (`requireManualApproval`): nessun documento è
  esposto senza revisione. Stato di approvazione condiviso tra TUI e server, revocabile.
- **Ricerca full-text BM25** su SQLite FTS5, con indicizzazione *dopo* la
  pseudonimizzazione e guard anti-PII sulle query (ADR-002).
- **Dizionario di pratica** in testo chiaro accanto ai documenti, applicato a ogni
  documento della pratica per coerenza anti-leak (ADR-003).
- **Cache di pratica cifrata** a riposo (AES-256-GCM): contiene solo hash (ADR-001).
- **Risk scorer**: classifica i dati sensibili (art. 9/10 GDPR — penale/salute/minori)
  per non servirli mai a un LLM cloud.
- **Label/folderId opachi** (es. `400F`), mai nomi delle parti, perché esposti via
  `list_folders` (ADR-004).
- **TUI di review** da terminale (`npm run review`): lista entità colorata, anteprima
  Originale/Anonimizzato, azioni di approvazione e aggiunta manuale.
- **Path guard** (allowlist, no traversal, docId/URI opachi via HMAC) e logger su stderr
  (mai su stdout, che è il canale JSON-RPC).
- **Documentazione**: `ARCHITETTURA.md`, 4 ADR vincolanti, guide di sicurezza
  (invarianti, threat model STRIDE), convenzioni MCP/codice/testing.
- **172 test** (unit, anti-leak, e2e, redteam).

[0.1.1-beta.1]: https://github.com/avvocati-e-mac/AnonyMCP/releases/tag/v0.1.1-beta.1
[0.1.0-beta.1]: https://github.com/avvocati-e-mac/AnonyMCP/releases/tag/v0.1.0-beta.1
[0.1.0]: https://github.com/avvocati-e-mac/AnonyMCP/releases/tag/v0.1.0
