# Principi UX per testare la chiarezza della UI

Questi principi derivano da fonti pubbliche consultate per progettare test semplici e utili
per utenti non tecnici. Non sono decisioni ADR; sono criteri operativi per valutare la UI.

Fonti consultate:

- Nielsen Norman Group, `10 Usability Heuristics for User Interface Design`:
  https://www.nngroup.com/articles/ten-usability-heuristics/
- Nielsen Norman Group, `Error-Message Guidelines`:
  https://www.nngroup.com/articles/error-message-guidelines/
- GOV.UK Service Manual, `Writing for user interfaces`:
  https://www.gov.uk/service-manual/design/writing-for-user-interfaces
- W3C WAI, `Understanding WCAG 2.2`:
  https://www.w3.org/WAI/WCAG22/Understanding/

## Principi tradotti per AnonyMCP

### Stato sempre visibile

L'utente deve capire subito:

- quali pratiche sono configurate;
- quali documenti sono da rivedere;
- quali documenti sono approvati solo localmente;
- quali documenti sono disponibili al LLM cloud;
- quali documenti sono bloccati per sensibilita';
- quali bozze LLM aspettano conferma locale.

Test mcp-electron:

- leggere il body text della dashboard;
- verificare che gli stati compaiano con parole diverse;
- verificare che un singolo badge verde non copra stati diversi.

### Linguaggio dell'utente

La UI deve parlare come parlerebbe un avvocato che vuole evitare invii al cloud per errore.

Parole preferite:

- `pseudonimizzato`, non `anonimo`;
- `locale`, quando il dato resta nel computer;
- `LLM cloud`, quando si parla del canale esterno;
- `approvato localmente`, diverso da `disponibile al LLM cloud`;
- `bozze in attesa`, non `staging` nel testo utente;
- `decisione del professionista`, quando riguarda la sensibilita'.

Test mcp-electron:

- leggere onboarding e dashboard;
- cercare parole tecniche non spiegate;
- verificare che `MCP`, `LLM cloud`, `review` e `pseudonimizzazione` siano contestualizzati.

### Prevenzione degli errori ad alto costo

Il costo piu' alto e' esporre dati personali reali al canale MCP/LLM cloud.

La UI deve prevenire prima questi errori:

- approvare senza review;
- scambiare approvazione locale per esposizione cloud;
- sbloccare documenti sensibili con un click inconsapevole;
- confermare una bozza re-idratata senza capire che contiene dati reali;
- credere che la UI e il client LLM stiano usando la stessa config quando non e' verificato.

Test mcp-electron:

- cercare pulsanti primari troppo facili;
- controllare conferme, warning e stati;
- simulare click rapidi e verificare che non avvenga uno sblocco ambiguo.

### Riconoscimento, non memoria

L'utente non deve ricordare cosa significa un colore o uno stato visto in un'altra schermata.

Test mcp-electron:

- aprire una review e verificare che la schermata ripeta pratica, documento, stato review,
  stato cloud e sensibilita';
- verificare che i filtri della dashboard siano leggibili senza conoscere il codice.

### Errori comprensibili e azionabili

Gli errori devono dire:

- cosa e' successo;
- cosa puo' fare l'utente;
- senza stack trace;
- senza PII reale;
- senza colpevolizzare l'utente.

Test mcp-electron:

- provocare input vuoti o non validi dove possibile;
- leggere il messaggio;
- verificare che il messaggio sia vicino all'azione e suggerisca il passo successivo.

### Accessibilita' minima utile

Per questa prima suite non si certifica WCAG. Si controllano pero' aspetti pratici:

- pulsanti con testo o aria-label comprensibile;
- focus da tastiera visibile;
- nessuna informazione comunicata solo con colore;
- testi importanti leggibili senza screenshot ingrandito;
- campi input con placeholder o label chiara.

Test mcp-electron:

- usare `find_elements` per vedere pulsanti e input;
- usare Tab/Enter con `press_key`;
- verificare il testo visibile dopo ogni passaggio.
