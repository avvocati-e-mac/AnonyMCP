# Test errori, log e accessibilita' minima

Questi test cercano problemi di chiarezza e rischi di leak indiretti.

## ERR-001 - Errore azionabile su config non pronta

Scopo:
Verificare che un errore di config sia comprensibile e indichi il passo successivo.

Strumenti mcp-electron:
`get_body_text`, `click_by_text`.

Dati:
Config sintetica volutamente mancante o non valida.

Passi:

1. Avviare app con config mancante o invalida in ambiente sintetico.
2. Leggere il messaggio.
3. Verificare che non ci siano stack trace.
4. Verificare che ci sia un'azione come importare cartelle o riprovare.

Atteso:
Messaggio breve, comprensibile e senza PII.

Red team:
Controllare se il messaggio include path completi. In UI locale puo' essere accettabile, ma deve
essere utile e non inviato al cloud.

Fallimento grave se:
Compare stack trace o contenuto di documenti.

## ERR-002 - Errore aggiunta entita' inesistente

Scopo:
Verificare che l'errore su entita' manuale non presente sia chiaro.

Strumenti mcp-electron:
`fill_input`, `click_by_text`, `wait_for_text`, `get_body_text`.

Dati:
Review sintetica.

Passi:

1. Aprire review.
2. Inserire testo inesistente in `Testo esatto nel documento`.
3. Cliccare `Aggiungi`.
4. Leggere il messaggio.

Atteso:
Il messaggio spiega di verificare che il testo compaia nel documento.

Red team:
Verificare che l'input non venga cancellato se l'utente deve correggerlo.

Fallimento grave se:
Errore generico, tecnico o senza prossima azione.

## LOG-001 - Console renderer non inoltra PII

Scopo:
Verificare che gli argomenti console del renderer non finiscano nei log main.

Strumenti mcp-electron:
`read_electron_logs`.

Dati:
Solo sintetici.

Passi:

1. Aprire dashboard e review sintetica.
2. Navigare anche in `Dashboard`, `Review`, `Bloccati`, `Bozze`, `Scansione`.
3. Leggere log Electron recenti.
4. Verificare che i log non contengano testo originale del documento.
5. Verificare che eventuali log console riportino solo conteggi o messaggi redatti.
6. Verificare che aggiornamenti badge/nav non logghino nomi file reali o testo originale.

Atteso:
Nessun contenuto originale nei log.

Red team:
Provocare un errore UI e controllare se viene loggato il payload intero.

Fallimento grave se:
Log contengono nomi, CF, IBAN o testo originale non sintetico.

## A11Y-001 - Pulsanti e input riconoscibili

Scopo:
Verificare che elementi interattivi abbiano testo, label o aria-label utili.

Strumenti mcp-electron:
`find_elements`, `debug_elements`.

Dati:
Qualsiasi schermata sintetica.

Passi:

1. Eseguire `find_elements` sulla schermata.
2. Controllare pulsanti senza testo o aria-label.
3. Controllare input senza placeholder o label.
4. Verificare che top nav esponga `Dashboard`, `Review`, `Bloccati`, `Bozze`, `Scansione` con nomi accessibili.
5. Verificare che i badge nav abbiano significato accessibile, per esempio `Bloccati MCP/LLM, 2 documenti` e `Bozze locali, 1 bozza`.
6. Verificare che la pagina corrente usi `aria-current="page"` o equivalente.
7. In `Scansione`, verificare che `Cerca nuovi documenti` abbia aria-label contestuale alla pratica;
   in `Review` e `Bloccati`, verificare che `Apri` e `Valuta` abbiano aria-label contestuali al documento.
8. Verificare che `Cerca nuovi documenti nelle pratiche` abbia aria-label esplicito, per esempio
   `Cerca nuovi documenti in tutte le pratiche configurate localmente`.
9. Verificare che `Mostra tutte` / `Nascondi gia' gestite` usi `aria-pressed`.
10. Verificare che la ricerca in `Review`, `Bloccati` e `Bozze` abbia aria-label, non solo placeholder.
11. Durante scansione bulk o auto-scan iniziale, verificare che l'avanzamento abbia `role="status"`
    e `aria-live`.
12. Segnalare elementi critici poco comprensibili.

Atteso:
Le azioni principali sono riconoscibili anche senza interpretare icone.

Red team:
Concentrarsi su icone header, top nav, refresh e impostazioni.
Controllare anche azioni ripetute con lo stesso testo visibile, come piu' pulsanti `Cerca nuovi documenti`.
Controllare che `Ferma dopo questa pratica` sia chiaro e non prometta cancellazione immediata.
Controllare che i pulsanti scansione risultino disabilitati durante l'auto-scan iniziale.

Fallimento grave se:
Un'azione con effetto privacy e' accessibile solo tramite icona non spiegata.

## A11Y-002 - Navigazione tastiera base

Scopo:
Verificare che un utente possa muoversi tra azioni principali con tastiera.

Strumenti mcp-electron:
`press_key`, `get_body_text`, `click_by_text` come fallback.

Dati:
Schermate sintetiche.

Passi:

1. Premere Tab ripetutamente.
2. Verificare se il focus attraversa top nav, pulsanti e input in ordine prevedibile.
3. Premere Enter/Space su una voce nav e verificare che cambi solo pagina.
4. Premere Enter su un'azione non distruttiva.
5. Verificare che non si attivino azioni pericolose in modo inatteso.

Atteso:
Focus prevedibile e azioni chiare.

Red team:
Provare Tab nella review vicino a `Applica selezione e approva localmente` e nelle opzioni sensibilita'.
Verificare che la navigazione top nav non attivi scansione, approvazione o salvataggio bozze.

Fallimento grave se:
La tastiera attiva approvazione o cambio sensibilita' senza controllo visibile.

## A11Y-003 - Non solo colore

Scopo:
Verificare che stati importanti non siano comunicati solo con colore.

Strumenti mcp-electron:
`get_body_text`, `take_screenshot` solo su sintetico.

Dati:
Dashboard e review sintetiche.

Passi:

1. Leggere dashboard.
2. Verificare che badge colorati abbiano testo: `Bloccato MCP/LLM`, `Da rivedere`, `Disponibile via MCP/LLM`.
3. Aprire review e controllare entita'.
4. Verificare che il tipo entita' sia scritto, non solo colorato.
5. Verificare che le pagine operative e le relative ricerche abbiano testo esplicito, non solo colore.
6. Verificare che le card pratica mostrino testi per `da rivedere`, `approvati`, `via MCP/LLM` e
   `bloccati`, non solo badge cromatici.
7. Verificare che la griglia alta usi label testuali distinte (`Locale reale`, `Review umana`,
    `MCP/LLM`, `Bloccati MCP/LLM`, `Bozze locali`) e non comunichi i conteggi solo con colore.
8. Verificare che i badge top nav non siano solo pallini/colori e che `Bloccati`, `Bozze`,
   `Scansione` abbiano significato testuale o accessibile completo.
9. Verificare che i badge numerici circolari nelle card dashboard siano in tono con la scheda e
   accompagnati da titolo/testo, non solo colore.

Atteso:
Il colore aiuta ma non e' l'unico canale informativo.

Red team:
Immaginare uno screenshot in bianco e nero: gli stati restano comprensibili?
Verificare anche i badge `Sensibile`, `Bozze` e `Approvati localmente` nelle pagine dedicate.
Verificare anche che la pagina corrente in top nav non sia indicata solo dal colore.

Fallimento grave se:
Lo stato MCP/LLM o sensibilita' dipende solo dal colore.

## ERR-003 - Errori non colpevolizzanti

Scopo:
Valutare il tono dei messaggi.

Strumenti mcp-electron:
`get_body_text`.

Dati:
Errori sintetici.

Passi:

1. Provocare errore configurazione o input.
2. Leggere il copy.
3. Cercare parole come `errore irreversibile`, `input illegale`, `hai sbagliato`.
4. Verificare se il messaggio suggerisce una soluzione.

Atteso:
Tono neutro, preciso, orientato alla soluzione.

Red team:
Valutare se un avvocato sotto pressione capirebbe subito cosa fare.

Fallimento grave se:
Errore tecnico blocca il flusso senza istruzioni.
