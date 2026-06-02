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

## 7. Dashboard generale

Dopo onboarding e setup, questa e' la schermata iniziale.

```text
+------------------------------------------------------------------+
| AnonyMCP                                      [Impostazioni] [Log]|
+-----------------------------+------------------------------------+
| Attivita' da svolgere       | Stato generale                     |
|                             |                                    |
| [!] 12 documenti da scan    | Pratiche configurate: 48           |
| [!] 8 documenti da review   | Documenti approvati: 132           |
| [!] 2 bozze LLM in attesa   | Disponibili al LLM cloud: 118      |
| [S] 5 da valutare/sensibili | Bloccati per cloud: 14             |
| [+] 3 nuove cartelle        |                                    |
|                             | [Scansiona tutto]                  |
|                             | [Vai alla review]                  |
|                             | [Bozze da confermare]              |
|                             | [Documenti sensibili]              |
|                             | [Aggiungi pratiche]                |
+-----------------------------+------------------------------------+
```

La dashboard e' orientata ad azioni, non a metriche decorative. Deve rispondere subito a:

- posso chiedere al LLM di lavorare su questa pratica?
- quali documenti bloccano l'uso cloud?
- quali bozze LLM devo confermare?
- ci sono nuove cartelle da importare?
- esistono label MCP non opache?

## 8. Review documenti

La review e' locale. Puo' mostrare testo originale e nomi file reali, ma questi valori non
devono uscire via MCP.

```text
+------------------------------------------------------------------+
| Review / citazione.md                    [Originale] [Pseudonimo]|
+-------------------------------------+----------------------------+
| DOCUMENTO                           | ENTITA' RILEVATE           |
|                                     |                            |
| Il Sig. [Mario Rossi] nato a        | [x] Persona                |
| [Milano], CF [RSSMRA...]            |     Mario Rossi -> Persona 1|
| residente in [Via Roma 10] ...      |                            |
|                                     | [x] Luogo                  |
|                                     |     Milano -> Luogo 1       |
|                                     |                            |
|                                     | [x] Cod. fiscale           |
|                                     |     RSSMRA... -> CF 1       |
|                                     |                            |
|                                     | [+ Aggiungi entita' mancata]|
+-------------------------------------+----------------------------+
| [Annulla]                         [Applica selezione e approva] |
+------------------------------------------------------------------+
```

Checklist guidata:

- Persone;
- Codici fiscali / P. IVA / documenti;
- Indirizzi;
- Dati bancari;
- Email / PEC / telefoni;
- Numeri di ruolo, protocolli, riferimenti ad atti;
- altri dati identificativi non riconosciuti.

```text
+------------------------------------------------------------------+
| Aggiungi entita' mancata                                         |
+------------------------------------------------------------------+
| Testo da proteggere                                              |
| [ Studio Medico San Luca                                      ]  |
|                                                                  |
| Tipo                                                             |
| ( ) Persona                                                      |
| (x) Organizzazione                                               |
| ( ) Luogo                                                        |
| ( ) Indirizzo                                                    |
| ( ) Altro dato identificativo                                    |
|                                                                  |
| AnonyMCP cerchera' questo testo nel documento e lo sostituira'   |
| con uno pseudonimo coerente.                                     |
|                                                                  |
|                              [Annulla] [Aggiungi]                |
+------------------------------------------------------------------+
```

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
| (x) Sensibile                                                    |
|     Il documento resta approvabile localmente, ma non viene       |
|     esposto al LLM cloud.                                        |
|                                                                  |
| ( ) Non sensibile                                                |
|     Dopo la review potra' essere esposto al LLM cloud in forma    |
|     pseudonimizzata.                                             |
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
- se l'avvocato lascia `Da rivalutare`, nessuna esposizione cloud;
- ogni decisione e' legata all'hash del documento; se il file cambia, la decisione decade.

```text
+------------------------------------------------------------------+
| Documenti da valutare / sensibili                                |
+------------------------------------------------------------------+
| Pratica | Documento      | Suggerimento AnonyMCP | Decisione     |
| 400F    | memoria.md     | penale                | da valutare   |
| 215S    | relazione.md   | salute                | sensibile     |
| 88A     | ricorso.md     | nessuno               | sensibile     |
|                                                                  |
| [Apri review] [Valuta sensibilita']                              |
+------------------------------------------------------------------+
```

Ogni cambio di valutazione deve:

- rimuovere prima il documento dall'indice BM25;
- reindicizzare solo se la decisione finale consente esposizione cloud e il documento e'
  approvato;
- restare locale e non esporre via MCP nomi file, motivazioni o path reali;
- produrre un record audit locale con hash sorgente, azione, stato prima/dopo, timestamp e
  motivazione eventuale.

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

## 11. Bozze LLM e re-idratazione locale

Il LLM scrive usando pseudonimi. AnonyMCP re-idrata localmente e salva in bozze in attesa.

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
                                           re-idrata localmente
                                           Persona 1 -> Mario Rossi
                                                           |
                                                           v
                                           salva in bozze in attesa
```

Schermata:

```text
+------------------------------------------------------------------+
| Bozze create dal LLM                                             |
+------------------------------------------------------------------+
| Testo ricevuto dal LLM      Re-idratazione locale    File finale |
| con pseudonimi              nomi veri solo su Mac    pratica     |
|                                                                  |
| Percorso richiesto: Ricerche/bozza_parere.md                     |
| Stato: in attesa di conferma                                     |
|                                                                  |
| Re-idratazione locale                                            |
| - 8 pseudonimi sostituiti con valori reali                       |
| - 0 pseudonimi ambigui                                           |
|                                                                  |
| Attenzione: questa bozza ora contiene dati reali. E' salvata in   |
| bozze in attesa e non e' ancora nella cartella finale.            |
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
| La bozza contiene dati reali perche' e' destinata alla cartella   |
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
- preload con funzioni nominali, mai `ipcRenderer` raw;
- API preload chiusa e congelata con `Object.freeze`;
- Zod su input e output IPC;
- main process tratta sempre il renderer come non fidato;
- preview documenti come testo; niente `dangerouslySetInnerHTML` salvo wrapper auditato;
- niente telemetria o crash upload;
- DevTools disabilitati in produzione;
- niente PII in log, clipboard o errori;
- stdout riservato al protocollo JSON-RPC del server MCP.

Payload IPC:

- il renderer conserva stato UI minimo: `folderId`, `docId`, filtri, tab, selezione;
- testi originali, bozze re-idratate e mapping non sono persistiti in Zustand/localStorage;
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

## 14. Test bloccanti prima dell'implementazione completa

Onboarding:

- flag persistente;
- ritorno alla privacy guide da dashboard;
- setup forzato se non ci sono pratiche.

Import e label:

- corpus positivo/negativo per label opache;
- collisioni `400F`/`400f`, duplicati, Unicode composto/decomposto;
- directory create/copy/touch: ID stabili;
- nuove cartelle sotto root monitorata non entrano in `list_folders` senza conferma;
- albero `Clienti/Mario Rossi/Sinistro Auto`: MCP espone solo codice opaco.

Path:

- root symlink verso altra cartella rifiutata salvo override locale;
- file symlink che esce dalla root non scansionato;
- placeholder cloud/temp esclusi o segnalati.

Review:

- aggiunta entita' manuale;
- falso positivo escluso;
- documento approvato indicizzato solo se esponibile;
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
- CSP blocca script/link malevoli in preview;
- clipboard non contiene PII salvo azione locale esplicita e protetta;
- log UI/stderr non contengono fixture PII o stack trace;
- nessuna richiesta di rete in produzione durante review/crash simulato.

Pending write:

- staging valido promosso;
- staging modificato rifiutato;
- file finale esistente rifiutato senza overwrite;
- pseudonimo ambiguo segnalato/bloccato;
- return MCP privo di PII.

Usabilita':

- con documenti misti, l'avvocato deve indicare correttamente quali puo' leggere Claude;
- dato un testo con nome non rilevato, deve riuscire ad aggiungerlo senza conoscere il NER;
- data una bozza re-idratata, deve capire che Claude non ha ricevuto i nomi reali.

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
