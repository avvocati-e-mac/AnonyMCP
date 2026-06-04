# Design app Electron — AnonyMCP

Documento canonico per progettare l'app Electron prima dell'implementazione. La UI e'
una misura di sicurezza: deve aiutare un avvocato con poca esperienza informatica a non
esporre dati personali reali a un LLM cloud per errore.

## 1. Scopo dell'app

Tagline:

> AnonyMCP protegge i documenti dello studio prima che un LLM cloud possa leggerli.

AnonyMCP e' un filtro locale tra le cartelle delle pratiche e il client LLM. L'app
Electron non sostituisce il server MCP: lo rende governabile da una persona non tecnica.

Obiettivi:

- scegliere e configurare le pratiche senza editare JSON a mano;
- generare ID ed etichette opache per cio' che e' visibile al LLM;
- scansionare e pseudonimizzare i documenti;
- guidare la review umana delle entita' rilevate;
- distinguere sempre dati locali reali, testo pseudonimizzato e dati esposti al cloud;
- confermare le bozze prodotte dal LLM prima di salvarle nella pratica.

Non obiettivi della prima versione Electron:

- parser binari/OCR/NER worker: restano milestone successive;
- generare documenti anonimizzati come Anonimator;
- creare tool MCP di de-anonimizzazione;
- usare un LLM cloud per classificare o rilevare PII nei documenti originali.

## 2. Principi di copy e UX

La UI deve usare termini coerenti:

- "pseudonimizzato", non "anonimo";
- "approvato localmente" distinto da "disponibile al LLM cloud";
- "possibile documento sensibile" quando il suggerimento arriva da AnonyMCP;
- "decisione del professionista" per la classificazione finale di sensibilita';
- "bozze in attesa", non "staging" nel testo utente.

Messaggio ricorrente, breve:

> Il testo resta dato personale. AnonyMCP riduce il rischio di invio al cloud, non
> anonimizza il documento.

Stati obbligatori:

- `Da rivedere`;
- `Approvato localmente`;
- `Disponibile al LLM cloud`;
- `Bloccato per cloud`;
- `Da valutare dal professionista`.

Non usare un unico check verde per stati diversi.

## 3. Riferimento Anonimator

L'app si ispira alla grammatica UI di Anonimator, gia' verificata nel repo
`avvocati-e-mac/anonimator`:

- stack Electron/Vite/React/Tailwind/Zustand/lucide-react;
- header fisso, corpo scrollabile, footer azioni fisso;
- review con lista entita' e preview documento;
- badge colorati per tipo entita';
- editing inline di tipo/testo/pseudonimo quando utile;
- onboarding semplice;
- flussi batch con preview e conferma.

Differenze non negoziabili:

- AnonyMCP non genera un file anonimizzato come output principale;
- la prima schermata operativa e' la dashboard delle pratiche, non una dropzone;
- label e folderId MCP devono essere opachi;
- il confine critico e' il canale MCP/LLM cloud.

## 4. Prima apertura

La schermata iniziale appare al primo avvio. Se l'utente seleziona "Non mostrare piu'",
non appare piu' automaticamente; resta sempre accessibile da `Aiuto -> Come funziona la
privacy`.

Se non esistono pratiche configurate, l'app va comunque al setup pratiche anche se
l'onboarding e' stato dismesso.

```text
+------------------------------------------------------------------+
| AnonyMCP                                                         |
+------------------------------------------------------------------+
| AnonyMCP protegge i documenti dello studio prima che un LLM       |
| cloud possa leggerli.                                            |
|                                                                  |
| Cosa fa                                                          |
| - Sostituisce nomi, codici fiscali, indirizzi e altri dati        |
|   personali con pseudonimi.                                      |
| - Fa leggere al LLM solo i documenti gia' controllati e approvati.|
| - Mantiene sul tuo computer la corrispondenza tra dato reale e    |
|   pseudonimo.                                                    |
|                                                                  |
| Avvisi importanti                                                |
| - Pseudonimizzazione non significa anonimizzazione: in alcuni     |
|   casi l'identita' puo' essere ricostruita dal contesto.          |
| - Il riconoscimento automatico non e' perfetto: serve sempre      |
|   la revisione dell'avvocato.                                    |
| - Il controllo finale resta del professionista.                   |
| - Per documenti sensibili si intendono, per esempio, documenti    |
|   penali, sanitari, su minori, vita sessuale, origine etnica,     |
|   convinzioni religiose o politiche, appartenenza sindacale.      |
| - Un documento sensibile puo' essere approvato localmente ma      |
|   restare non disponibile per il LLM cloud.                       |
|                                                                  |
| [ ] Non mostrare piu' questa schermata                           |
|                                             [Continua]            |
+------------------------------------------------------------------+
```

## 5. Setup pratiche

La scelta cartelle appare solo:

- alla prima configurazione;
- se non ci sono cartelle condivise dal server MCP;
- quando l'utente apre `Aggiungi pratiche`.

Modalita':

- `Singola pratica`: una o piu' cartelle scelte manualmente, ciascuna e' una pratica;
- `Cartella Pratiche`: una cartella madre contiene direttamente le singole pratiche;
- `Cartelle clienti/pratiche`: una cartella madre contiene clienti, sotto ogni cliente ci
  sono le pratiche/posizioni.

```text
+------------------------------------------------------------------+
| Aggiungi pratiche                                                |
+------------------------------------------------------------------+
| Come sono organizzate le cartelle dello studio?                  |
|                                                                  |
| ( ) Singola pratica                                              |
|     Scegli o trascina una o piu' cartelle, una per ogni pratica.  |
|                                                                  |
| (x) Cartella "Pratiche"                                          |
|     Una cartella principale contiene direttamente le pratiche.    |
|                                                                  |
| ( ) Cartelle clienti                                             |
|     Una cartella principale contiene clienti, e sotto ogni        |
|     cliente ci sono le singole pratiche/posizioni.                |
|                                                                  |
|                                             [Avanti]              |
+------------------------------------------------------------------+
```

### 5.1 Inserimento manuale

Se l'utente sceglie `Singola pratica`, si apre una schermata dedicata. La selezione puo'
avvenire con drag and drop o con finestra di sistema.

```text
+------------------------------------------------------------------+
| Inserimento manuale pratica                                      |
+------------------------------------------------------------------+
| Trascina qui una o piu' cartelle pratica                         |
|                                                                  |
| +--------------------------------------------------------------+ |
| |                                                              | |
| |              Rilascia le cartelle in questa area              | |
| |                                                              | |
| +--------------------------------------------------------------+ |
|                                                                  |
| Oppure                                                          |
| [Scegli cartelle dal computer]                                  |
|                                                                  |
| Cartelle selezionate                                             |
|  - /Studio/Pratiche/400F                                        |
|  - /Studio/Pratiche/Rossi c Bianchi                             |
|                                                                  |
| [Indietro]                                      [Continua]       |
+------------------------------------------------------------------+
```

Requisiti Electron:

- drag and drop: il renderer non legge path da Node; il preload usa `webUtils.getPathForFile`;
- dialog: il main process usa `dialog.showOpenDialog` con `openDirectory` e, quando serve,
  `multiSelections`;
- su Windows/Linux non combinare file e directory nello stesso dialog;
- il main process canonicalizza i path e valida la root prima di salvare la config.

## 6. ID e label opache

`folderId` e `label` MCP sono visibili al LLM tramite `list_folders`: devono essere opachi.

Regola forte per import batch:

- non usare denylist di nomi come garanzia di sicurezza;
- usare una allowlist stretta per nomi gia' opachi;
- se il nome non e' chiaramente opaco, generare un codice automatico;
- conservare eventuali nomi reali solo come alias locale UI, mai nel payload MCP.

Pattern opaco default:

```text
^[A-Z0-9][A-Z0-9._-]{1,15}$
```

Condizioni aggiuntive:

- almeno una cifra;
- nessuna parola lunga chiaramente descrittiva;
- normalizzazione Unicode NFKC e collision check case-insensitive.

Stato implementativo dopo red-team 2026-06-03:

- l'import Electron gia' evita i casi chiaramente identificanti (`Mario Rossi`, `Rossi c Bianchi`)
  e assegna `label = id`, quindi riduce il leak piu' probabile verso `list_folders`;
- resta un gap rispetto alla regola forte: nomi con singola parte identificante e numero
  (`Rossi-2026`, `eredi_rossi_1`, `cliente-1`) possono sembrare opachi all'euristica ma non lo
  sono abbastanza per il canale MCP;
- prima della produzione, `safeOpaqueName` deve diventare allowlist stretta, non denylist:
  pattern `^[A-Z0-9][A-Z0-9._-]{1,15}$`, NFKC, almeno una cifra, collisione case-insensitive,
  rifiuto di parole descrittive lunghe e fallback a codice numerico automatico;
- la config manuale resta coperta da ADR-0004: warning su stderr. Se si vuole bloccare l'avvio
  o sostituire server-side label identificanti, serve nuova decisione ADR o superseding ADR.

Esempi ammessi:

- `400F`;
- `P001`;
- `2026-CV-001`.

Esempi da rigenerare:

- `Rossi`;
- `Mario Rossi`;
- `Rossi c Bianchi`;
- `cliente-a`;
- `causa-test`;
- `comune-di-torino`;
- `eredi_rossi`.

La numerazione automatica usa l'ordine di creazione delle cartelle quando affidabile. Al
primo import viene scritto un manifest locale persistente con mapping stabile:

- fingerprint path reale;
- ID opaco assegnato;
- `assignedAt`;
- timestamp filesystem usato, se disponibile;
- sorgente di discovery.

Gli ID gia' assegnati non si rinumerano mai. Se `birthtime` non e' affidabile, la UI
segnala il fallback e chiede conferma dell'ordine.

```text
+------------------------------------------------------------------+
| Etichette sicure automatiche                                     |
+------------------------------------------------------------------+
| Le etichette delle pratiche possono essere visibili al LLM.       |
| Per questo AnonyMCP evita nomi come "Rossi c. Bianchi".           |
|                                                                  |
| Cartella reale                         Etichetta proposta         |
| /Pratiche/400F                         400F                       |
| /Pratiche/Rossi c Bianchi              2                          |
| /Pratiche/Mario Rossi                  3                          |
|                                                                  |
| [x] Usa etichette automatiche sicure                             |
| [ ] Voglio scegliere manualmente ID ed etichette                  |
|                                                                  |
|                                             [Conferma]            |
+------------------------------------------------------------------+
```

Override manuale:

- l'utente puo' assegnare un alias locale descrittivo;
- `folderId` e `label` MCP restano opachi;
- se l'utente tenta di forzare un label MCP identificante, la UI blocca o impone
  conferma forte, ma il default resta codice opaco.

## 7. Dashboard generale e coerenza MCP

Dopo onboarding e setup, questa e' la schermata iniziale. La dashboard non deve essere una
pagina di liste lunghe: deve essere un cruscotto operativo compatto, con righe azionabili.

### 7.1 Stato MCP/config

Problema emerso nel test manuale: la UI Electron puo' leggere una configurazione diversa da
quella del server MCP gia' collegato al client LLM. Questo e' un rischio di sicurezza, perche'
l'avvocato puo' credere di governare le pratiche esposte al cloud mentre il client LLM vede
altro.

Requisiti:

- mostrare sempre il path della config usata dalla UI, in forma compatta;
- mostrare hash breve della config e lista `folderId` opachi configurati;
- mostrare un avviso se il client MCP esterno non e' stato verificato dopo una modifica config;
- aggiungere una procedura "Verifica collegamento MCP" che confronta, quando possibile,
  `folderId`/`configHash` della UI con quelli del server MCP;
- non mostrare path reali o alias locali nel canale MCP; path e nomi reali restano solo UI locale.

Target futuro lato server MCP: un tool/status non sensibile, per esempio
`anonymcp_get_runtime_status`, che restituisce solo:

- versione;
- `configHash`;
- `folderIds`;
- `allowCloudForSensitive`;
- `requireManualApproval`.

```text
+--------------------------------------------------------------------------------+
| AnonyMCP  Dashboard | Review 13 | Bloccati 4 | Bozze | Scansione              |
| Dashboard generale                                      Config UI pronta        |
| Config UI: anonymcp.config.json  Hash: 91ab42  Folders: 1, 100F                |
| Ultima verifica client MCP: non eseguita dopo modifica config [Verifica MCP]    |
+--------------------------------------------------------------------------------+
```

Se la verifica fallisce:

```text
+--------------------------------------------------------------------------------+
| ATTENZIONE: il client LLM non vede le stesse pratiche mostrate dalla UI.         |
| UI: 1, 100F                         MCP: 400f, 215s                             |
| Finche' non correggi il collegamento, l'app non puo' garantire cosa vede l'LLM. |
| [Apri istruzioni collegamento] [Ho riavviato il client LLM, verifica di nuovo]  |
+--------------------------------------------------------------------------------+
```

### 7.2 Dashboard compatta e top nav

La dashboard deve rispondere subito a:

- quali pratiche sono configurate;
- quali documenti richiedono lavoro;
- quali documenti sono bloccati per il cloud;
- quali bozze LLM attendono conferma;
- quali azioni posso fare ora.

Le metriche alte restano, ma le liste operative sono spostate in pagine dedicate raggiungibili
dalla top nav. La dashboard non deve contenere liste lunghe: mostra situazione MCP locale,
confine locale/review/MCP e card di azione. Le pagine dedicate contengono le code lunghe.

Top nav operativa:

- `Dashboard` = situazione attuale MCP + cosa fare adesso;
- `Review` = coda locale documenti da controllare;
- `Bloccati` = documenti bloccati MCP/LLM;
- `Bozze` = bozze LLM da confermare;
- `Scansione` = ricerca locale di nuovi documenti nelle pratiche.

I badge di nav sono orientamento globale: visibili solo se c'e' lavoro o stato in corso, con
testo/aria-label che esplicita `Bloccati MCP/LLM`, `Bozze locali` e `Scansione locale`.
Nella sezione `Cosa devo fare adesso`, i conteggi usano badge circolari in tono con la scheda
e le CTA (`Apri Review`, `Apri Bloccati`, `Apri Bozze`, `Apri Scansione`) sono centrate e
visivamente simili a pulsanti, senza creare bottoni annidati.

```text
+--------------------------------------------------------------------------------+
| Dashboard | Review 13 | Bloccati 4 | Bozze 1 | Scansione                     |
+--------------------------------------------------------------------------------+
| Locale reale 12 | Review umana 13 | MCP/LLM 8 | Bloccati MCP/LLM 4 | Bozze 1 |
+--------------------------------------------------------------------------------+
| Cosa devo fare adesso?                                                        |
| [Review umana   (13)]      Apri Review                                        |
| [Bloccati MCP/LLM (4)]     Apri Bloccati                                      |
| [Bozze LLM da confermare (1)] Apri Bozze                                      |
| [Scansione locale]         Apri Scansione                                     |
+--------------------------------------------------------------------------------+
| Config UI | Hash config | Folder MCP locali | warning verifica client LLM      |
+--------------------------------------------------------------------------------+
```

Regole UI:

- ogni riga deve avere un solo comando primario vicino allo stato: `Apri`, `Valuta`,
  `Conferma bozza`;
- i documenti sensibili devono emergere nella pagina `Bloccati`, non restare nascosti nella
  dashboard;
- mostrare massimo 20-30 righe per pagina o usare virtualizzazione;
- la tabella non deve mostrare path completi per default: mostra pratica/label opaca e nome
  file; il path reale puo' comparire in tooltip/detail locale;
- i contatori devono essere coerenti con le righe: se la lista mostra quattro bloccati, il KPI
  non puo' essere zero.

Schermata `Scansione`:

```text
+--------------------------------------------------------------------------------+
| Dashboard | Review 13 | Bloccati 4 | Bozze 1 | Scansione                     |
+--------------------------------------------------------------------------------+
| Scansione locale                                                              |
| Cerca nuovi documenti nelle pratiche. Nulla e' esposto via MCP/LLM senza       |
| review.                         [Mostra tutte] [Cerca nuovi documenti...]     |
+--------------------------------------------------------------------------------+
| Scansione locale 1 di 12: pratica 300F. I conteggi si aggiornano al termine.   |
|                                                   [Ferma dopo questa pratica]  |
+--------------------------------------------------------------------------------+
| 300F | Path locale: .../300F | 2 da rivedere | 0 bloccati | [Scansione...]    |
| 400F | Path locale: .../400F | 1 da rivedere | 1 bloccato | [Cerca nuovi...]  |
+--------------------------------------------------------------------------------+
```

## 8. Review documenti

La review e' una schermata locale dedicata, non un pannello dentro la dashboard. Puo' mostrare
testo originale e nomi file reali, ma questi valori non devono uscire via MCP.

```text
+--------------------------------------------------------------------------------+
| Dashboard | Review 13 | Bloccati 4 | Bozze 1 | Scansione                     |
| < Torna senza approvare | Review documento                       contratto.md   |
| Pratica 1 | Da review | Non sensibile | Cloud: non disponibile finche' approvi  |
+--------------------------------------------------------------------------------+
| Originale locale                         | Pseudonimizzato                      |
|------------------------------------------+--------------------------------------|
| LOCATORE                                 | LOCATORE                             |
| [PERSONA Giovanni Bianchi Esposito]      | [PERSONA L. G. B. E.]                |
| nato a [LUOGO Napoli] ...                | nato a [LUOGO NASCLUGO_001] ...      |
| CF [CF BNCGNN...]                        | CF [CF CF_001]                       |
| IBAN [IBAN IT89...]                      | IBAN [IBAN IBAN_001]                 |
+--------------------------------------------------------------------------------+
| Entita' 62  [Tutte] [Persone] [Codici] [Contatti] [Banche] [Altro] Cerca [...] |
| [x] CF     BNCGNN...              -> CF_001       regex 1 occ.                 |
| [x] IBAN   IT89...                -> IBAN_001     regex 1 occ.                 |
| [x] Email  g.bianchi@example...   -> EMAIL_001    regex 1 occ.                 |
|                                                                                |
| + Aggiungi entita' mancante                                                     |
|   Testo esatto [____________________] Tipo [PERSONA v] [Aggiungi]              |
+--------------------------------------------------------------------------------+
| Sensibilita': [Non sensibile] [Sensibile/blocca cloud] [Usa suggerimento]       |
|                                              [Annulla] [Applica e approva]      |
+--------------------------------------------------------------------------------+
```

Requisiti visuali ispirati ad Anonimator:

- evidenziare le entita' nel testo originale e pseudonimizzato con colori per tipo;
- usare lo stesso colore nella lista entita', nel testo e nella legenda;
- click su entita' nella lista = evidenzia/scorre alla prima occorrenza;
- click nel testo = seleziona la riga entita' corrispondente;
- scroll sincronizzato tra originale e pseudonimizzato. Sync preferito: per blocchi/paragrafi
  normalizzati; fallback: percentuale di scroll;
- pannelli testo con altezza stabile e font monospace leggibile;
- pannello entita' ampio, filtrabile e raggruppabile, non una lista di poche righe;
- `Aggiungi entita'` graficamente separato dal riepilogo sensibilita';
- footer azioni sticky per evitare che l'utente perda il comando finale.

Palette entita':

```text
PERSONA=#2563eb  ORGANIZZAZIONE=#7c3aed  LUOGO=#16a34a  CF/PIVA=#dc2626
IBAN=#0891b2     EMAIL/PEC/TEL=#ea580c   INDIRIZZO=#4f46e5  ALTRO=#64748b
```

Checklist guidata:

- Persone;
- Codici fiscali / P. IVA / documenti;
- Indirizzi;
- Dati bancari;
- Email / PEC / telefoni;
- Numeri di ruolo, protocolli, riferimenti ad atti;
- altri dati identificativi non riconosciuti.

## 9. Documenti sensibili

Principio:

> AnonyMCP segnala possibili documenti sensibili. La decisione finale resta sempre
> dell'avvocato.

AnonyMCP non "decide" in modo definitivo. Suggerisce in base a lessico prudenziale e,
in futuro, eventuali classificatori locali validati. La UI deve parlare di suggerimento,
valutazione e decisione del professionista.

Categorie suggerite:

- penale;
- salute;
- minori;
- vita sessuale;
- origine etnica o razziale;
- convinzioni religiose o politiche;
- appartenenza sindacale.

Stati:

- `Suggerito sensibile`;
- `Sensibile deciso dall'avvocato`;
- `Non sensibile deciso dall'avvocato`;
- `Sensibile autorizzato al cloud dall'avvocato`;
- `Da rivalutare`;
- `Bloccato per cloud`;
- `Disponibile al cloud dopo review`.

```text
+------------------------------------------------------------------+
| Valutazione sensibilita' documento                               |
+------------------------------------------------------------------+
| Documento: memoria.md                                            |
| Pratica: 400F                                                    |
|                                                                  |
| AnonyMCP segnala questo documento come potenzialmente sensibile. |
| Motivo del suggerimento: penale                                  |
| Termini rilevati: imputato, reato                                |
|                                                                  |
| La decisione finale spetta al professionista.                    |
|                                                                  |
| Come vuoi classificare questo documento?                         |
|                                                                  |
| (x) Sensibile - blocca cloud                                     |
|     Il documento resta approvabile localmente, ma non viene       |
|     esposto al LLM cloud.                                        |
|                                                                  |
| ( ) Non sensibile                                                |
|     Dopo la review potra' essere esposto al LLM cloud in forma    |
|     pseudonimizzata.                                             |
|                                                                  |
| ( ) Sensibile ma autorizzo uso cloud                             |
|     Scelta eccezionale: il documento resta sensibile, ma puo'     |
|     essere esposto al LLM solo in forma pseudonimizzata e dopo    |
|     conferma forte dell'avvocato.                                |
|                                                                  |
| ( ) Da rivalutare piu' tardi                                     |
|     Il documento resta bloccato finche' non decidi.               |
|                                                                  |
| Motivazione / nota locale opzionale                              |
| [____________________________________________________________]   |
|                                                                  |
| [Annulla]                                      [Conferma scelta] |
+------------------------------------------------------------------+
```

Regole operative:

- se AnonyMCP segnala sensibilita', il documento resta `Da valutare / bloccato cloud`
  finche' l'avvocato decide;
- se l'avvocato classifica `Sensibile`, il documento puo' essere approvato localmente ma
  non viene esposto al cloud;
- se l'avvocato classifica `Non sensibile`, il documento puo' diventare esponibile solo
  dopo normale review di pseudonimizzazione;
- se l'avvocato classifica `Sensibile ma autorizzato al cloud`, il documento puo' diventare
  esponibile solo dopo conferma forte, nota locale obbligatoria e review completata;
- se l'avvocato lascia `Da rivalutare`, nessuna esposizione cloud;
- ogni decisione e' legata all'hash del documento; se il file cambia, la decisione decade.

Esempio concreto emerso nel test: una perizia medico-legale puo' essere indispensabile per una
causa di risarcimento danni o colpa medica. AnonyMCP deve segnalarla come possibile dato
sensibile, ma non puo' decidere da solo che sia inutilizzabile. L'avvocato deve poter scegliere:

- bloccare il documento per il cloud;
- considerarlo non sensibile nel contesto concreto;
- autorizzarne l'uso cloud pur riconoscendone la sensibilita', con conferma forte.

Questa terza opzione modifica la policy attuale "dati art. 9/10 mai a LLM cloud" e richiede
un ADR dedicato prima dell'implementazione piena nel canale MCP. Fino al nuovo ADR, la UI puo'
registrare la decisione locale ma il server MCP deve continuare a rispettare
`allowCloudForSensitive=false`.

Implementazione locale prevista/avviata:

- `pratica.sensitivity.json` salva solo `sourceHash`, decisione e timestamp;
- nessuna motivazione testuale viene persistita di default, per evitare note identificanti;
- `LocalReviewService` aggrega dashboard, review, pending write e lista dei documenti bloccati
  per il cloud; e' una facciata locale, non un tool MCP.
- il main Electron espone alla UI solo canali IPC nominali validati con Zod: dashboard, scan,
  lista review e lista documenti sensibili bloccati.
- il dettaglio review espone testo originale e nomi file solo alla UI locale; gli schemi lista
  restano separati e rifiutano campi come `originalText`.
- la top nav separa `Review` e `Bloccati`: un documento sensibile ancora da rivedere compare in
  `Review`, mentre la pagina `Bloccati` mostra tutto cio' che resta non disponibile via MCP/LLM.
- il setup cartelle usa il dialog di sistema e supporta import manuale, cartella "Pratiche"
  e struttura Clienti/Pratiche; l'import manuale supporta anche drag and drop di una o piu'
  cartelle tramite `webUtils.getPathForFile`; i nomi identificanti vengono sostituiti da
  numeri opachi ordinati per data di creazione.
- le bozze LLM in staging hanno pagina `Bozze` e dettaglio locale separato; il testo completato
  con dati reali compare solo nella UI locale prima della promozione finale.

```text
+------------------------------------------------------------------+
| Dashboard | Review 13 | Bloccati 4 | Bozze 1 | Scansione        |
| Bloccati MCP/LLM                                                 |
+------------------------------------------------------------------+
| Documenti approvati o da valutare che restano bloccati al canale |
| MCP/LLM per sensibilita' o policy. Restano nella UI locale.      |
+------------------------------------------------------------------+
| Pratica | Documento      | Review        | Sensibilita' | Azione |
| 400F    | memoria.md     | Da rivedere   | penale       | Valuta |
| 215S    | relazione.md   | Approvato     | sensibile    | Valuta |
| 88A     | ricorso.md     | Approvato     | sensibile    | Valuta |
+------------------------------------------------------------------+
```

Ogni cambio di valutazione deve:

- rimuovere prima il documento dall'indice BM25;
- reindicizzare solo se la decisione finale consente esposizione cloud, la policy server lo
  permette e il documento e' approvato;
- restare locale e non esporre via MCP nomi file, motivazioni o path reali;
- produrre un record audit locale con hash sorgente, azione, stato prima/dopo, timestamp e
  motivazione eventuale.

Red team della soluzione:

- rischio: sblocco sensibili troppo facile. Mitigazione: default bloccato, conferma forte,
  nota obbligatoria per `Sensibile ma autorizzato cloud`, audit locale, niente bulk unlock;
- rischio: falsa sicurezza da highlight colorato. Mitigazione: copy esplicito che il sistema
  non riconosce tutto, checklist manuale, comando `Aggiungi entita'` sempre visibile;
- rischio: config drift tra UI e MCP. Mitigazione: `configHash`, verifica runtime MCP,
  avviso bloccante se UI e client LLM divergono;
- rischio: la dashboard compatta nasconde urgenze. Mitigazione: pagine dedicate, badge distinti,
  badge circolari in tono nella sezione azioni, KPI coerenti e riga azionabile unica;
- rischio: path reali visibili per abitudine. Mitigazione: path completi solo in dettaglio
  locale/tooltip, mai in liste MCP-facing o ritorni IPC non necessari;
- rischio: scroll sincronizzato impreciso. Mitigazione: sync per blocchi quando possibile,
  fallback percentuale, nessuna decisione automatica basata sul sync visuale.

Italian-Legal-BERT:

- non e' il target NER, come da ADR-0007;
- puo' essere valutato solo in futuro come classificatore locale fine-tuned per sensibilita';
- non deve mai sbloccare da solo un documento suggerito sensibile;
- eventuale adozione richiede nuovo ADR, benchmark e dataset etichettato.

## 10. Uso con LLM

Il client LLM non legge i file originali. Usa MCP:

```text
+-------------------+       MCP       +---------------------------+
| Claude / ChatGPT  |  ----------->   | AnonyMCP locale           |
|                   |                 |                           |
| "Cerca nella      |                 | controlla:                |
| pratica 400F"     |                 | - pratica esiste          |
|                   |                 | - documenti approvati     |
|                   |                 | - decisione sensibilita'  |
|                   |                 | - policy cloud            |
+-------------------+                 +-------------+-------------+
                                                    |
                                                    v
                                      restituisce solo pseudonimi
```

Il LLM puo' vedere:

- folderId/label opachi;
- testi pseudonimizzati;
- estratti BM25 pseudonimizzati;
- conteggi non identificativi.

Il LLM non deve vedere:

- nomi reali;
- path reali;
- nomi file reali;
- alias locali;
- mapping reale-pseudonimo;
- motivazioni locali di override che possono identificare persone o fatti.

## 11. Bozze LLM da confermare

Il LLM scrive usando pseudonimi. AnonyMCP completa la bozza localmente con i dati reali e la
lascia in attesa di conferma prima del salvataggio nella pratica.

```text
+-------------------+       MCP write_document       +-------------+
| Claude / ChatGPT  | -----------------------------> | AnonyMCP    |
|                   |                                | locale      |
| "Prepara una      |                                |             |
| bozza per         |                                |             |
| Persona 1..."     |                                |             |
+-------------------+                                +------+------+
                                                           |
                                                           v
                                           completa localmente
                                           Persona 1 -> Mario Rossi
                                                           |
                                                           v
                                           salva in bozze in attesa
```

Schermata:

```text
+------------------------------------------------------------------+
| Dashboard | Review 13 | Bloccati 4 | Bozze 1 | Scansione        |
| Bozze LLM da confermare                                          |
+------------------------------------------------------------------+
| Generate sui pseudonimi, poi completate localmente con i dati    |
| reali. Controllale prima di salvarle nella pratica.              |
|                                                                  |
| Percorso richiesto: Ricerche/bozza_parere.md                     |
| Stato: in attesa di conferma                                     |
|                                                                  |
| Catena locale: LLM -> AnonyMCP locale -> Cartella pratica        |
| Attenzione: questa bozza puo' contenere dati reali nella UI       |
| locale. Non e' ancora nella cartella finale.                      |
|                                                                  |
|                       [Lascia in attesa] [Apri anteprima]        |
+------------------------------------------------------------------+
```

Conferma:

```text
+------------------------------------------------------------------+
| Conferma salvataggio bozza                                       |
+------------------------------------------------------------------+
| File finale                                                      |
| /Pratiche/400F/Ricerche/bozza_parere.md                          |
|                                                                  |
| Controlli                                                        |
| [x] path dentro la pratica                                       |
| [x] estensione consentita                                        |
| [x] bozza non modificata dopo la scrittura                       |
| [x] nessun overwrite non autorizzato                             |
|                                                                  |
| La bozza puo' contenere dati reali perche' e' destinata alla      |
| locale della pratica, non al LLM.                                |
|                                                                  |
|                            [Annulla] [Salva nella pratica]       |
+------------------------------------------------------------------+
```

Se restano pseudonimi ambigui, l'app non deve nasconderlo:

- bloccare la promozione oppure mostrare warning forte;
- azioni possibili: `Scegli persona`, `Lascia pseudonimo e marca da correggere`,
  `Annulla promozione`.

## 12. Security baseline Electron/React

Requisiti bloccanti:

- `nodeIntegration: false`;
- `contextIsolation: true`;
- `sandbox: true`;
- CSP restrittiva; in produzione `connect-src 'none'` salvo eccezioni motivate;
- nessun remote content nella UI;
- nessun `webview`;
- blocco di navigazione esterna e nuove finestre;
- in produzione il main process deve fidarsi solo dell'esatto `renderer/index.html` pacchettizzato,
  non di qualunque URL `file://`;
- in sviluppo il trust del renderer deve confrontare l'`origin` normalizzato del dev server, non
  usare un semplice `startsWith` sulla stringa URL;
- preload con funzioni nominali, mai `ipcRenderer` raw;
- API preload chiusa e congelata con `Object.freeze`;
- Zod su input e output IPC;
- main process tratta sempre il renderer come non fidato;
- preview documenti come testo; niente `dangerouslySetInnerHTML` salvo wrapper auditato;
- niente telemetria o crash upload;
- DevTools disabilitati in produzione;
- niente PII in log, clipboard o errori; in produzione non inoltrare gli argomenti completi dei
  `console-message` renderer su stderr, oppure redigerli/troncarli;
- stdout riservato al protocollo JSON-RPC del server MCP.

Payload IPC:

- il renderer conserva stato UI minimo: `folderId`, `docId`, filtri, tab, selezione;
- testi originali, bozze completate localmente con dati reali e mapping non sono persistiti in Zustand/localStorage;
- raw text e preview originali sono effimeri e cancellati al cambio schermata;
- DTO di risposta/eventi separati dai modelli interni.

## 13. Red-team requirements accettati

### Anti-leak verso LLM cloud

- Final gate sui payload MCP: `list_folders`, `status`, `resources/read`, `search`,
  `write_document` return non contengono PII reale.
- `reviewList`, nomi file reali, alias locali e path reali sono solo UI locale.

### Import pratiche

- import come generatore di config opaca con manifest persistente;
- discovery passiva delle nuove cartelle;
- symlink/junction validati con `realpath`;
- cloud/network dirs segnalati;
- collisioni Unicode/case-insensitive gestite;
- gruppi cliente solo UI locale, mai label MCP.

### Filesystem e stato documenti

- `scan()` deve essere symlink-aware: un file symlink che punta fuori dalla pratica non deve
  essere processato ne' indicizzato;
- un documento approvato cancellato dal disco deve essere ritirato dalla RAM, dalle Resource e
  dall'indice BM25 al successivo scan;
- ogni ritiro deve inviare `resources/listChanged`, cosi' il client MCP non conserva una lista
  apparentemente valida.

### Sensibilita'

- AnonyMCP suggerisce, l'avvocato decide;
- default fail-closed finche' non c'e' decisione professionale;
- cambio decisione invalida/reindicizza in modo sicuro;
- audit locale non esposto via MCP.

### Pending write

- spiegare chiaramente che i nomi reali sono reinseriti solo sul Mac;
- evidenziare pseudonimi ambigui;
- verificare hash della bozza prima della promozione;
- niente file temporanei con nomi reali fuori dalla pratica.
- M-Write deve rifiutare ogni scrittura verso artefatti interni AnonyMCP (`pratica.*.json`,
  `pratica.searchindex.db`, `.anonymcp`, `.anonymcp-staging`, WAL/journal), anche con
  `overwrite=true`.

### Electron/IPC runtime

- `assertTrustedSender` deve accettare solo il renderer previsto, non ogni `file://` locale;
- i canali IPC che restituiscono PII locale (`review:detail`, `write:detail`) sono ammessi solo
  per la UI locale fidata; una navigazione a pagina locale diversa deve renderli inaccessibili;
- gli errori e i log renderer-forwarded non devono contenere testo originale, nomi reali, CF,
  IBAN o bozze completate localmente con dati reali.

## 14. Test bloccanti prima dell'implementazione completa

Onboarding:

- flag persistente;
- ritorno alla privacy guide da dashboard;
- setup forzato se non ci sono pratiche.

Import e label:

- corpus positivo/negativo per label opache;
- collisioni `400F`/`400f`, duplicati, Unicode composto/decomposto;
- casi negativi obbligatori: `Rossi-2026`, `eredi_rossi`, `cliente-1`, `comune-di-torino`,
  `Mario_Rossi_1`;
- directory create/copy/touch: ID stabili;
- nuove cartelle sotto root monitorata non entrano in `list_folders` senza conferma;
- albero `Clienti/Mario Rossi/Sinistro Auto`: MCP espone solo codice opaco.

Path:

- root symlink verso altra cartella rifiutata salvo override locale;
- file symlink che esce dalla root non scansionato;
- directory symlink dentro la pratica non utilizzabile come target M-Write;
- placeholder cloud/temp esclusi o segnalati.

Review:

- aggiunta entita' manuale;
- falso positivo escluso;
- documento approvato indicizzato solo se esponibile;
- documento approvato cancellato dal disco ritirato da Resource/read/search dopo rescan;
- testo originale mai nei tool MCP.

Sensibilita':

- suggerito sensibile resta bloccato finche' l'avvocato decide;
- decisione `Sensibile` blocca Resource/read/search;
- decisione `Non sensibile` espone solo dopo review;
- documento non suggerito ma marcato sensibile resta bloccato;
- modifica file invalida la decisione;
- flip indicizzato -> sensibile rimuove chunk BM25;
- status MCP mostra solo conteggi.

IPC/Electron:

- `window.anonymcp` non espone `send`, `invoke`, `on` grezzi;
- fuzz canali sconosciuti e payload malformati;
- payload con PII inattesa rifiutato;
- sender URL: `file:///tmp/malicious.html` e altri `file://` non-packaged non possono invocare IPC;
- dev URL: host/origin diverso dal dev server configurato viene rifiutato anche se ha prefisso
  simile;
- CSP blocca script/link malevoli in preview;
- clipboard non contiene PII salvo azione locale esplicita e protetta;
- log UI/stderr non contengono fixture PII o stack trace;
- nessuna richiesta di rete in produzione durante review/crash simulato.

Pending write:

- staging valido promosso;
- staging modificato rifiutato;
- file finale esistente rifiutato senza overwrite;
- scrittura verso `pratica.entitydict.json`, `pratica.approvals.json`, `pratica.writes.json`,
  `pratica.sensitivity.json`, `pratica.searchindex.db` sempre rifiutata;
- pseudonimo ambiguo segnalato/bloccato;
- return MCP privo di PII.

Usabilita':

- con documenti misti, l'avvocato deve indicare correttamente quali puo' leggere Claude;
- dato un testo con nome non rilevato, deve riuscire ad aggiungerlo senza conoscere il NER;
- data una bozza completata localmente con dati reali, deve capire che Claude non ha ricevuto i nomi reali.

## 15. Fonti e decisioni collegate

Decisioni vincolanti:

- ADR-0004: label/folderId pratiche opachi;
- ADR-0005: M-Write con re-idratazione locale e quarantena;
- ADR-0007: target NER Fase 2 = `italian-ner-xxl-v2`, non Italian-Legal-BERT.

Fonti tecniche verificate:

- Electron Security: https://electronjs.org/docs/latest/tutorial/security
- Electron Context Isolation: https://electronjs.org/docs/latest/tutorial/context-isolation
- Electron IPC: https://electronjs.org/docs/latest/tutorial/ipc
- Electron Dialog: https://electronjs.org/docs/latest/api/dialog
- React Thinking in React: https://react.dev/learn/thinking-in-react
- React You Might Not Need an Effect: https://react.dev/learn/you-might-not-need-an-effect

Red-team usati per questo documento:

- Gemini Pro Thinking via Perplexity;
- Claude Sonnet Thinking via Perplexity;
- Kimi K2.6 Thinking via Perplexity;
- subagenti interni su Electron/IPC, UX, import cartelle, sensibilita'.
