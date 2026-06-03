# Piani di test mcp-electron per AnonyMCP

Questa cartella contiene piani di test manuali assistiti da `mcp-electron` per l'app
Electron di AnonyMCP.

`mcp-electron` serve a far interagire un assistente con una finestra Electron aperta:
puo' leggere testo visibile, trovare pulsanti, cliccare, compilare campi, fare screenshot,
controllare la console renderer e verificare lo stato della pagina.

## Scopo

I test verificano due cose diverse ma collegate:

- usabilita': un avvocato non tecnico deve capire cosa sta succedendo e quale azione e'
  sicura;
- sicurezza del confine: dati reali locali possono essere visibili nella UI locale quando
  servono alla review, ma non devono arrivare al canale MCP/LLM cloud.

Questi test non sostituiscono `npm test`, i test anti-leak o i test IPC. Servono a scoprire
problemi di UI, copy, flusso operativo e falsa sicurezza che i test unitari non vedono.

## Regola non negoziabile

Usare `mcp-electron` solo con dati sintetici.

Motivo: se la review Electron mostra testo originale, l'assistente che controlla
`mcp-electron` puo' leggere quel testo. Con un assistente cloud, questo diventerebbe un canale
di uscita dei dati reali.

Consentito:

- pratiche generate da `npm run gen:test-pratiche`;
- fixture sintetici in `test/fixtures/synthetic/`;
- documenti creati apposta con nomi inventati.

Vietato:

- aprire con `mcp-electron` documenti reali di studio;
- fare screenshot di review con dati reali;
- leggere log o console se possono contenere dati reali;
- usare questi piani come collaudo su produzione legale.

## Politica path locali

La path reale della pratica puo' essere utile nella UI Electron locale per capire a quale
cartella e' associata una pratica. Non e' automaticamente un bug mostrarla localmente.

Il criterio corretto e':

- path locale nella UI Electron: ammessa se aiuta l'avvocato e se e' presentata come
  informazione locale;
- path locale nei payload MCP, in `list_folders`, in `search`, in Resource/read o nei return dei
  tool: vietata;
- path locale in screenshot/log raccolti da `mcp-electron`: solo se i dati sono sintetici.

## Indice

- `00-ui-clarity-research.md`: principi UX usati come base dei test.
- `01-safe-test-harness.md`: preparazione dell'ambiente sintetico.
- `02-onboarding-and-setup.md`: onboarding e import pratiche.
- `03-dashboard-and-cloud-boundary.md`: dashboard, path locale e confine cloud.
- `04-review-and-approval.md`: review documento, entita' e approvazione.
- `05-sensitive-documents.md`: documenti sensibili e blocco cloud.
- `06-pending-writes.md`: bozze LLM e re-idratazione locale.
- `07-errors-logs-accessibility.md`: errori, log, tastiera e chiarezza.
- `08-red-team-checklist.md`: checklist sintetica di red-team.

## Formato dei casi

Ogni caso usa questo schema:

- ID: identificativo stabile.
- Scopo: cosa si vuole verificare.
- Strumenti mcp-electron: funzioni tipiche da usare.
- Dati: solo dati sintetici.
- Passi: azioni da eseguire.
- Atteso: risultato osservabile.
- Red team: come provare a rompere il flusso.
- Fallimento grave se: condizioni che indicano rischio alto.

## Sequenza consigliata

1. Generare pratiche sintetiche.
2. Avviare l'app Electron con quella config.
3. Eseguire prima `02`, poi `03`, poi `04` e `05`.
4. Eseguire `06` solo se sono presenti bozze LLM in staging.
5. Chiudere con `07` e `08`.

Ogni difetto trovato va classificato come:

- `Alta`: puo' far arrivare PII al canale MCP/LLM cloud o dare falsa sicurezza su dati
  sensibili;
- `Media`: puo' far sbagliare un utente o nascondere uno stato importante;
- `Bassa`: problema di copy, layout o efficienza senza rischio immediato.
