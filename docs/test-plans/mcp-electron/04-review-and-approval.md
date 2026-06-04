# Test review documento e approvazione

La review e' locale e puo' mostrare testo originale. Per questo questi test sono ammessi solo
con dati sintetici.

## REV-001 - Apertura review documento

Scopo:
Verificare che la review mostri chiaramente originale locale, pseudonimizzato, stato e azioni.

Strumenti mcp-electron:
`click_by_text`, `wait_for_text`, `get_body_text`, `find_elements`.

Dati:
Pratiche sintetiche scansionate.

Passi:

1. Dalla dashboard aprire una riga con azione `Apri` o `Valuta`.
2. Attendere la schermata review.
3. Verificare la presenza di `Originale locale`, `Pseudonimizzato` e `Decisioni` come zone distinte.
4. Verificare che su desktop testi e colonna decisioni/entita' siano visibili nello stesso workspace, con scroll interni e senza una pagina verticale infinita.
5. Verificare che `Decisioni`, `Prima di approvare` e `Sensibilita` abbiano icone riconoscibili.
6. Verificare che il riquadro `Decisioni` mostri il flusso `Entita` -> `Anteprima` -> `Approva` -> `MCP/LLM`.
7. Verificare che la spiegazione `Come viene calcolato` sia dentro il riquadro `Rischio residuo`, non in un blocco separato.
8. Verificare la presenza di lista entita' laterale e pulsante `Applica selezione e approva localmente`.
9. Ridimensionare la finestra desktop, tablet e stretta: i blocchi devono riordinarsi senza sovrapporsi e senza sprecare spazio evidente.

Atteso:
La schermata chiarisce che il testo originale e' locale, che il testo pseudonimizzato e' solo
candidato al canale MCP/LLM e che l'approvazione resta una decisione locale.

Red team:
Controllare se il titolo o il copy fanno sembrare il testo originale gia' sicuro per MCP/LLM.
Controllare anche che il layout compatto non nasconda avvisi o decisioni importanti.
Controllare se il diagramma a flussi suggerisce erroneamente che l'approvazione basti sempre per esporre a MCP/LLM.

Fallimento grave se:
La review non distingue originale locale e pseudonimizzato.

## REV-002 - Entita' evidenziate e lista coerente

Scopo:
Verificare che le entita' rilevate siano visibili nel testo e nella lista.

Strumenti mcp-electron:
`get_body_text`, `scroll_to_element`, `take_screenshot` solo su sintetico.

Dati:
Pratiche sintetiche.

Passi:

1. Aprire un documento con molte entita'.
2. Verificare che la lista laterale mostri tipo, testo originale, pseudonimo, fonte e occorrenze.
3. Cliccare una entita' nella lista e verificare che le anteprime si spostino verso l'occorrenza corrispondente.
4. Verificare che nel testo ci siano evidenziazioni per le entita' attive.
5. Verificare che i colori non siano l'unica informazione disponibile.

Atteso:
L'utente puo' capire quali entita' sono state rilevate senza dover interpretare solo colori.

Red team:
Aprire un documento lungo e verificare se la lista entita' resta utilizzabile e se il click su una voce aiuta a trovare il punto nel testo.

Fallimento grave se:
L'utente non puo' capire quali dati personali sono stati rilevati o esclusi.

## REV-003 - Aggiunta manuale entita' mancante

Scopo:
Verificare che l'avvocato possa aggiungere una PII non rilevata automaticamente.

Strumenti mcp-electron:
`fill_input`, `select_option`, `click_by_text`, `wait_for_text`, `get_body_text`.

Dati:
Pratiche sintetiche. Scegliere un testo presente nel documento.

Passi:

1. Aprire review.
2. Nel campo `Testo esatto nel documento`, inserire una stringa sintetica presente.
3. Scegliere un tipo entita'.
4. Cliccare `Aggiungi`.
5. Verificare che la nuova entita' compaia nella lista.

Atteso:
La UI aggiunge l'entita' e aggiorna review senza perdere il contesto.

Red team:
Inserire una stringa non presente e verificare che il messaggio dica cosa fare.

Fallimento grave se:
La UI accetta un'entita' inesistente o non segnala chiaramente il problema.

## REV-004 - Selezione entita' prima di approvare

Scopo:
Verificare che la selezione delle entita' da applicare sia comprensibile e non venga ignorata.

Strumenti mcp-electron:
`click_by_selector`, `get_body_text`.

Dati:
Pratiche sintetiche.

Passi:

1. Aprire review.
2. Deselezionare una entita' sintetica.
3. Verificare che la voce risulti esclusa nella lista.
4. Verificare che l'evidenziazione sparisca dall'originale locale.
5. Verificare che l'anteprima `Pseudonimizzato` mostri di nuovo il testo originale per quella entita'.
6. Non approvare se il comportamento non e' chiaro.

Atteso:
La selezione e' esplicita e l'utente capisce che deselezionare puo' influire sulla
pseudonimizzazione.

Red team:
Deselezionare una PII importante e verificare se la UI avvisa abbastanza prima di approvare e se l'anteprima rende evidente il rischio.

Fallimento grave se:
Un utente puo' togliere una PII dalla pseudonimizzazione senza rendersene conto.

## REV-005 - Applica selezione e approva localmente

Scopo:
Verificare che approvare aggiorni lo stato e riporti l'utente alla dashboard.

Strumenti mcp-electron:
`click_by_text`, `wait_for_text`, `get_body_text`.

Dati:
Pratiche sintetiche.

Passi:

1. Aprire review.
2. Lasciare selezionate le entita' rilevate.
3. Leggere il riquadro `Prima di approvare`.
4. Cliccare `Applica selezione e approva localmente`.
5. Attendere ritorno o aggiornamento dashboard.
6. Verificare che il documento cambi stato.

Atteso:
Il documento non e' piu' da review. La disponibilita' MCP/LLM dipende comunque dalla sensibilita'
e dalla policy.

Red team:
Approvare un documento sensibile e verificare che non diventi automaticamente disponibile via
MCP/LLM se `allowCloudForSensitive=false`.

Fallimento grave se:
Approvazione locale equivale automaticamente a esposizione MCP/LLM per documenti sensibili.

## REV-006 - Chiusura senza approvare

Scopo:
Verificare che l'utente possa uscire dalla review senza applicare modifiche.

Strumenti mcp-electron:
`click_by_text`, `get_body_text`.

Dati:
Pratiche sintetiche.

Passi:

1. Aprire review.
2. Cliccare `Torna alla dashboard`.
3. Verificare il ritorno alla dashboard.
4. Verificare che lo stato del documento non sia approvato per errore.

Atteso:
La chiusura non approva e non cambia esposizione MCP/LLM.

Red team:
Modificare campi manuali e chiudere; verificare se l'utente capisce che le modifiche non sono
state applicate.

Fallimento grave se:
Chiudere la review cambia lo stato del documento.
