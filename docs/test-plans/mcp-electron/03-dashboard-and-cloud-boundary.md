# Test dashboard e confine MCP/LLM cloud

La dashboard e' il punto in cui l'avvocato decide cosa richiede attenzione. Deve distinguere
chiaramente informazione locale, stato review e disponibilita' via MCP/LLM cloud.

## DASH-001 - Stato config e folder MCP visibili

Scopo:
Verificare che la dashboard mostri quale config locale sta usando e quali folder MCP opachi
risultano configurati.

Strumenti mcp-electron:
`get_body_text`, `find_elements`.

Dati:
Config sintetica.

Passi:

1. Aprire dashboard.
2. Leggere il blocco superiore.
3. Verificare la presenza di `Config UI`, `Hash config`, `Folder MCP locali`.
4. Verificare che folderId/label siano opachi, per esempio `400f`, `215s`, `400F`, `215S`.

Atteso:
La dashboard consente di capire quale configurazione locale e' caricata.

Red team:
Avviare con config diversa da quella attesa e verificare che il test lo rilevi.

Fallimento grave se:
La UI non mostra alcuna informazione sulla config locale o mostra label identificanti nel campo
MCP.

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

## DASH-003 - Badge MCP configurato non deve dare falsa sicurezza

Scopo:
Verificare che il badge `MCP configurato` non venga interpretato come garanzia che il client LLM
esterno veda la stessa config.

Strumenti mcp-electron:
`get_body_text`.

Dati:
Config sintetica.

Passi:

1. Aprire dashboard.
2. Leggere il testo vicino a `MCP configurato`.
3. Verificare se c'e' un warning sulla verifica del client LLM dopo modifiche config.
4. Valutare se il messaggio e' abbastanza visibile.

Atteso:
La dashboard avvisa che la UI puo' usare una config diversa dal server MCP collegato al client
LLM e che serve verifica.

Red team:
Chiedersi se un utente potrebbe vedere solo il badge verde e ignorare il warning.

Fallimento grave se:
La UI comunica `MCP configurato` senza alcun avviso di config drift.

## DASH-004 - Zone operative visibili

Scopo:
Verificare che la dashboard mostri subito le quattro zone operative: locale reale, review umana,
MCP/LLM e bloccato MCP.

Strumenti mcp-electron:
`get_body_text`, `find_elements`.

Dati:
Config sintetica con almeno una pratica.

Passi:

1. Aprire dashboard.
2. Verificare la presenza di `Locale reale`, `Review umana`, `MCP/LLM`, `Bloccato MCP`.
3. Verificare che la zona `MCP/LLM` dica che vengono esposti solo testi pseudonimizzati,
   approvati e consentiti dalla policy.
4. Verificare che la zona locale chiarisca che path e bozze re-idratate restano sul computer.

Atteso:
Le zone rendono leggibile il confine locale/review/MCP senza affidarsi solo ai KPI.

Red team:
Valutare se `MCP/LLM` puo' essere interpretato come garanzia di anonimizzazione o sicurezza
assoluta.

Fallimento grave se:
La dashboard mostra un badge verde generico senza distinguere locale, review e disponibilita'
MCP/LLM.

## DASH-005 - KPI coerenti con le righe

Scopo:
Verificare che i contatori alti siano coerenti con la tabella attivita'.

Strumenti mcp-electron:
`get_body_text`, `click_by_text`, `fill_input`.

Dati:
Pratiche sintetiche dopo scansione.

Passi:

1. Scansionare le pratiche sintetiche.
2. Leggere i KPI: pratiche, documenti da rivedere, bloccati MCP/LLM, bozze.
3. Applicare filtro `Da rivedere`.
4. Applicare filtro `Sensibili`.
5. Applicare filtro `Bozze` se presenti.
6. Confrontare il senso dei KPI con le righe mostrate.

Atteso:
I KPI non contraddicono la tabella e i filtri aiutano a trovare il lavoro da fare.

Red team:
Provare ricerca con una stringa non presente e verificare che il messaggio `Nessuna attivita'`
sia chiaro.

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

1. Leggere la tabella attivita'.
2. Identificare colonne `Review`, `Sensibilita'`, `MCP/LLM`.
3. Verificare che `Approvato localmente` non equivalga automaticamente a `Disponibile via MCP/LLM`.
4. Verificare che i sensibili appaiano `Bloccato MCP/LLM` o equivalente.

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
`click_by_text`, `wait_for_text`, `get_body_text`.

Dati:
Pratiche sintetiche.

Passi:

1. Cliccare `Scansiona` su una pratica.
2. Osservare se il pulsante mostra stato occupato.
3. Attendere aggiornamento dashboard.
4. Verificare che compaiano documenti da rivedere.

Atteso:
La UI comunica che la scansione e' in corso e poi mostra un risultato.

Red team:
Cliccare ripetutamente `Scansiona` e verificare che l'azione non parta in parallelo in modo
confuso.

Fallimento grave se:
La scansione avviene senza feedback o lascia la dashboard in uno stato incoerente.
