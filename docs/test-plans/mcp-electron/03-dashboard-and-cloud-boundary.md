# Test dashboard e confine MCP/LLM cloud

La dashboard e' il punto in cui l'avvocato decide cosa richiede attenzione. Deve distinguere
chiaramente informazione locale, stato review e disponibilita' via MCP/LLM cloud.

## DASH-001 - Stato config e folder MCP visibili

Scopo:
Verificare che la dashboard mostri quale config locale sta usando e quali folder MCP opachi
risultano configurati.

Strumenti mcp-electron:
`get_body_text`, `find_elements`, `eval` per misure di overflow se necessario.

Dati:
Config sintetica.

Passi:

1. Aprire dashboard.
2. Verificare che la top nav abbia `Dashboard` come pagina corrente e che non sia icon-only.
3. Leggere il blocco superiore.
4. Verificare la presenza di `Config UI`, `Hash config`, `Folder MCP locali`.
5. Verificare che folderId/label siano opachi, per esempio `400f`, `215s`, `400F`, `215S`.
6. Con config sintetica estesa, verificare che una lista di almeno 13 folder resti leggibile.
7. Verificare che i badge della top nav non sostituiscano le informazioni su config e folder.

Atteso:
La dashboard consente di capire quale configurazione locale e' caricata.

Red team:
Avviare con config diversa da quella attesa e verificare che il test lo rilevi.
Con molte pratiche verificare che la lista folder non spinga la dashboard fuori viewport o in
overflow orizzontale.

Fallimento grave se:
La UI non mostra alcuna informazione sulla config locale o mostra label identificanti nel campo
MCP.

Accessibilita':
`Dashboard` deve esporre lo stato corrente con `aria-current="page"` o equivalente; i badge nav
devono avere un significato accessibile, non solo un numero colorato.

## DASH-002 - Path locale utile ma marcata come locale

Scopo:
Verificare che la path reale della pratica, se mostrata, sia comprensibile come informazione
locale per l'avvocato e non come dato destinato al canale MCP/LLM.

Strumenti mcp-electron:
`get_body_text`, `query_text_by_selector` se serve.

Dati:
Pratiche sintetiche.

Passi:

1. Aprire dashboard.
2. Leggere le righe nella sezione `Pratiche`.
3. Verificare che la path punti alle cartelle sintetiche.
4. Verificare che il blocco distingua `folderId` o label MCP dalla path locale.

Atteso:
La path locale aiuta a capire l'associazione cartella-pratica. Il contesto della schermata deve
far capire che e' informazione locale.

Red team:
Controllare se una path identificante viene presentata accanto a parole come `MCP/LLM`,
`disponibile via MCP` o `visibile al LLM` in modo ambiguo.

Fallimento grave se:
La UI fa pensare che la path reale sia esposta al LLM oppure se la stessa path compare in un
payload MCP durante test separati.

## DASH-003 - Badge Config UI pronta non deve dare falsa sicurezza

Scopo:
Verificare che il badge `Config UI pronta` non venga interpretato come garanzia che il client LLM
esterno veda la stessa config.

Strumenti mcp-electron:
`get_body_text`.

Dati:
Config sintetica.

Passi:

1. Aprire dashboard.
2. Leggere il testo vicino a `Config UI pronta`.
3. Verificare se c'e' un warning sulla verifica del client LLM dopo modifiche config.
4. Valutare se il messaggio e' abbastanza visibile.

Atteso:
La dashboard avvisa che la UI puo' usare una config diversa dal server MCP collegato al client
LLM e che serve verifica.

Red team:
Chiedersi se un utente potrebbe vedere solo il badge di stato UI e ignorare il warning.

Fallimento grave se:
La UI comunica stato pronto/configurato senza alcun avviso di config drift, o se il badge fa
pensare che il client LLM sia stato verificato.

## DASH-004 - Griglia operativa senza KPI duplicati

Scopo:
Verificare che la dashboard mostri subito il confine locale/review/MCP in una sola griglia, senza
una seconda riga di KPI che ripete gli stessi conteggi.

Strumenti mcp-electron:
`get_body_text`, `find_elements`.

Dati:
Config sintetica con almeno una pratica.

Passi:

1. Aprire dashboard.
2. Verificare la presenza di `Locale reale`, `Review umana`, `MCP/LLM`, `Bloccati MCP/LLM` e
   `Bozze locali`.
3. Verificare che `Locale reale` usi il conteggio delle pratiche configurate e che non compaia
   anche una card separata `Pratiche configurate`.
4. Verificare che `Review umana` usi il conteggio dei documenti da rivedere e che non compaia
   anche una card separata `Documenti da rivedere`.
5. Verificare che `Bloccati MCP/LLM` compaia una sola volta nella griglia alta.
6. Verificare che la zona `MCP/LLM` dica che vengono esposti solo testi pseudonimizzati,
   approvati e consentiti dalla policy.
7. Verificare che la zona locale chiarisca che path e originali restano sul computer.
8. Verificare che le card `Cosa devo fare adesso` usino badge numerici circolari in tono con la
   scheda, non un colore unico che confonde stati diversi.
9. Verificare che le CTA delle card siano centrate e leggibili come pulsanti, pur restando parte
   della card cliccabile.
10. Verificare che la card `Scansione locale` non mostri uno stato inutile come `pronta` e usi una
   CTA di navigazione (`Apri Scansione`) se non avvia subito la scansione.
11. Verificare che i badge della top nav siano orientamento di navigazione, non una seconda riga KPI
   rassicurante.
12. Verificare che `Bloccati`, `Bozze` e `Scansione` siano espansi nel copy o aria-label come
   `Bloccati MCP/LLM`, `Bozze locali` e `Scansione locale`.

Atteso:
Le card rendono leggibile il confine locale/review/MCP con un solo numero per concetto.

Red team:
Valutare se `MCP/LLM` puo' essere interpretato come garanzia di anonimizzazione o sicurezza
assoluta.

Fallimento grave se:
La dashboard mostra due righe di KPI con gli stessi conteggi, un badge verde generico senza
distinguere locale/review/MCP, o nav badge che sembrano indicare approvazione cloud.

## DASH-005 - KPI coerenti con le righe

Scopo:
Verificare che i contatori alti siano coerenti con la lista attivita'.

Strumenti mcp-electron:
`get_body_text`, `click_by_text`, `fill_input`.

Dati:
Pratiche sintetiche dopo scansione.

Passi:

1. Scansionare le pratiche sintetiche.
2. Leggere la griglia alta: locale reale/pratiche, review, MCP/LLM, bloccati e bozze locali.
3. Aprire `Review` e verificare che badge/conteggio siano coerenti con le righe da rivedere.
4. Aprire `Bloccati` e verificare che badge/conteggio siano coerenti con le righe `Bloccato MCP/LLM`.
5. Aprire `Bozze` se presenti e verificare che badge/conteggio siano coerenti con le bozze LLM da confermare.
6. Tornare a `Dashboard` e confrontare il senso dei KPI con le righe viste nelle pagine dedicate.

Atteso:
I KPI non contraddicono le pagine dedicate e la navigazione aiuta a trovare il lavoro da fare.

Red team:
Provare ricerca con una stringa non presente in ciascuna pagina dedicata e verificare che il
messaggio `Nessun risultato` o equivalente sia chiaro.

Fallimento grave se:
La dashboard nasconde documenti sensibili o mostra KPI rassicuranti mentre esistono righe
bloccate.

## DASH-006 - Stati MCP/LLM distinti dagli stati review

Scopo:
Verificare che `Approvato localmente`, `Da rivedere`, `Disponibile via MCP/LLM`, `Bloccato
MCP/LLM`, `Non disponibile prima della review` non siano confusi.

Strumenti mcp-electron:
`get_body_text`.

Dati:
Pratiche sintetiche con documenti da review e sensibili.

Passi:

1. Aprire `Review`, `Bloccati` e `Bozze`.
2. Identificare colonne `Review`, `Sensibilita'`, `MCP/LLM` nelle pagine operative.
3. Verificare che `Approvato localmente` non equivalga automaticamente a `Disponibile via MCP/LLM`.
4. Verificare che i sensibili appaiano `Bloccato MCP/LLM` o equivalente nella pagina `Bloccati`.
5. Verificare che la pagina `Review` non implichi disponibilita' MCP/LLM prima dell'approvazione.
6. Verificare che i badge `Da rivedere`, `Sensibile`, `Bozza` e `Approvato localmente` siano
   testuali e non solo cromatici.

Atteso:
La dashboard separa lo stato locale dallo stato di esposizione MCP/LLM.

Red team:
Verificare se colori o badge simili rendono indistinguibili `approvato localmente` e
`disponibile via MCP/LLM`.

Fallimento grave se:
Un documento sensibile approvato localmente sembra disponibile via MCP/LLM senza conferma policy.

## DASH-007 - Scansione pratica con feedback

Scopo:
Verificare che l'utente riceva feedback quando avvia la scansione.

Strumenti mcp-electron:
`click_by_text`, `wait_for_text`, `get_body_text`, `debug_elements`.

Dati:
Pratiche sintetiche.

Passi:

1. Aprire la pagina `Scansione` dalla top nav.
2. Cliccare `Cerca nuovi documenti` su una pratica.
3. Osservare se il pulsante mostra stato occupato.
4. Attendere aggiornamento dashboard/nav.
5. Verificare che i documenti nuovi compaiano in `Review` come `Da rivedere`.
6. Con molte pratiche, usare `debug_elements` e verificare che ogni pulsante abbia un label
   specifico, per esempio `Cerca nuovi documenti nella pratica 300F`.
7. Durante una scansione, verificare che gli altri pulsanti scansione siano disabilitati.

Atteso:
La UI comunica che la scansione e' in corso e poi mostra un risultato.

Red team:
Cliccare ripetutamente `Scansiona` e verificare che l'azione non parta in parallelo in modo
confuso.

Fallimento grave se:
La scansione avviene senza feedback o lascia la dashboard in uno stato incoerente.

## DASH-008 - Molte pratiche e nomi documento lunghi

Scopo:
Verificare che la dashboard resti leggibile quando ci sono molte pratiche e nomi documento lunghi.

Strumenti mcp-electron:
`get_body_text`, `eval`, `take_screenshot` solo su sintetico.

Dati:
Config sintetica con almeno 13 pratiche, un documento con nome lungo e una pratica `P1300` con
`folderId` `1300F`.

Passi:

1. Aprire dashboard con config sintetica estesa.
2. Verificare che la top nav resti utilizzabile a finestra stretta/media/larga senza overflow.
3. Aprire `Scansione` e verificare che le pratiche da gestire siano in griglia multi-colonna quando lo spazio lo consente.
4. Verificare che il contenitore resti scrollabile e che la lettura segua l'ordine DOM/visivo.
5. Scansionare le pratiche extra.
6. Aprire `Review` e verificare che la lista mostri i documenti delle pratiche extra.
7. Verificare che un nome lungo, per esempio `Tizio vs Caio Comparsa...`, vada a capo senza
   nascondere il pulsante `Apri`.
8. Verificare con `document.documentElement.scrollWidth <= document.documentElement.clientWidth`
   che non ci sia overflow orizzontale.
9. Verificare che le pratiche con `label === folderId`, per esempio `300F`, non duplicano lo stesso
   codice nella card.
10. Verificare che la pratica `P1300` mostri anche il badge `1300F`, perche' `label` e `folderId`
    sono diversi ma entrambi opachi.
11. Ridimensionare: finestra stretta = 1 colonna, media = 2 colonne, larga = 3 colonne.

Atteso:
Molte pratiche e nomi lunghi non rompono dashboard, top nav o pagine dedicate; le azioni restano visibili.

Red team:
Ridimensionare la finestra e controllare se il nome documento invade le colonne stato o azione.
Verificare anche che le card multi-colonna non rendano ambiguo il rapporto tra path locale,
conteggi review e stato MCP/LLM.

Fallimento grave se:
Il pulsante `Apri` sparisce, la pagina richiede scroll orizzontale o una pratica configurata non e'
raggiungibile dalla UI.

## DASH-009 - Cerca nuovi documenti sequenziale

Scopo:
Verificare che la scansione di tutte le pratiche riduca lavoro ripetitivo senza cambiare il confine
locale/review/MCP.

Strumenti mcp-electron:
`click_by_text`, `wait_for_text`, `get_body_text`, `debug_elements`.

Dati:
Config sintetica con almeno 13 pratiche.

Passi:

1. Aprire `Scansione` con molte pratiche configurate.
2. Cliccare `Cerca nuovi documenti nelle pratiche`.
3. Verificare la presenza di un messaggio di avanzamento, per esempio `Scansione locale 1 di 13`.
4. Verificare che i pulsanti di scansione singola siano disabilitati durante la scansione.
5. Verificare che il testo dica che la scansione e' locale e non espone nulla via MCP/LLM.
6. Se la scansione dura abbastanza, cliccare `Ferma dopo questa pratica` e verificare che il copy
   prometta stop dopo la pratica corrente, non interruzione immediata.
7. Attendere la fine e verificare che i conteggi di dashboard e top nav vengano aggiornati.

Atteso:
La scansione bulk usa le stesse regole della scansione singola, procede in modo sequenziale e lascia
i documenti nuovi in review.

Red team:
Provare doppi click su `Cerca nuovi documenti nelle pratiche` e su `Cerca nuovi documenti` durante la scansione; non devono partire
scansioni parallele. Verificare che il copy non suggerisca approvazione o esposizione automatica.

Fallimento grave se:
`Cerca nuovi documenti nelle pratiche` rende disponibili documenti via MCP/LLM senza review, avvia scansioni parallele o
mostra un successo generico che fa pensare a pubblicazione verso il cloud.

## DASH-010 - Pratiche gia' gestite nascoste di default

Scopo:
Ridurre rumore nella dashboard senza far sparire le pratiche configurate.

Strumenti mcp-electron:
`get_body_text`, `click_by_text`, `debug_elements`.

Dati:
Config sintetica con almeno una pratica senza documenti da rivedere, senza bloccati MCP/LLM e senza
bozze pendenti.

Passi:

1. Aprire `Scansione`.
2. Verificare che la sezione pratiche mostri un conteggio tipo `X visibili / Y configurate`.
3. Verificare che le pratiche con review, bloccati MCP/LLM o bozze restino visibili.
4. Verificare che pratiche gia' gestite siano nascoste di default.
5. Cliccare `Mostra tutte`.
6. Verificare che le pratiche gia' gestite riappaiano.
7. Cliccare `Nascondi gia' gestite` e verificare che il filtro torni attivo.

Atteso:
Il filtro riduce rumore ma rende sempre evidente il totale delle pratiche configurate.

Red team:
Verificare che una pratica con documenti sensibili bloccati non venga nascosta. Verificare che
`Cerca nuovi documenti nelle pratiche` continui a riferirsi a tutte le pratiche configurate, non solo a quelle visibili.

Fallimento grave se:
Il filtro fa credere che pratiche configurate siano state rimosse o nasconde pratiche con documenti
bloccati MCP/LLM.

## DASH-011 - Auto-scan iniziale locale

Scopo:
Verificare che all'avvio l'app cerchi nuovi documenti locali da autorizzare senza confondere scan e
approvazione.

Strumenti mcp-electron:
`wait_for_text`, `get_body_text`, `debug_elements`.

Dati:
Config sintetica; opzionale: aggiungere un nuovo `.txt` sintetico prima di avviare l'app.

Passi:

1. Avviare app con config valida.
2. Attendere la dashboard.
3. Verificare se la top nav mostra `Scansione` in corso oppure aprire `Scansione`.
4. Verificare la comparsa di `Scansione iniziale locale` o del riepilogo finale della scansione.
5. Verificare che il copy dica che nulla viene esposto via MCP/LLM senza review.
6. Verificare che i pulsanti di scansione siano disabilitati durante l'auto-scan.
7. Se esiste un nuovo documento sintetico, verificare che appaia in `Review` come `Da rivedere` e non come
   `Disponibile via MCP/LLM`.

Atteso:
L'auto-scan aggiorna la dashboard e lascia i nuovi documenti in review/quarantena.

Red team:
Cliccare `Cerca nuovi documenti nelle pratiche` durante auto-scan: non devono partire scansioni parallele. Verificare che
il messaggio non usi parole come pubblicato, sincronizzato col cloud o approvato automaticamente.

Fallimento grave se:
Un nuovo documento diventa disponibile via MCP/LLM senza review o l'auto-scan blocca la UI senza
spiegazione.
