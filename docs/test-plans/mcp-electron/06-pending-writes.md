# Test bozze LLM e re-idratazione locale

Questi test riguardano M-Write: il LLM scrive usando pseudonimi, AnonyMCP re-idrata localmente
e salva la bozza in attesa di conferma.

La bozza re-idratata puo' contenere dati reali locali. Con `mcp-electron` usare solo dati
sintetici.

## WR-001 - Bozze LLM visibili come attivita' locale

Scopo:
Verificare che le bozze in attesa compaiano in dashboard senza confondersi con documenti gia'
approvati.

Strumenti mcp-electron:
`get_body_text`, `click_by_text`.

Dati:
Bozza sintetica generata tramite flusso M-Write di test.

Passi:

1. Preparare una bozza M-Write sintetica.
2. Aprire dashboard.
3. Verificare KPI `Bozze LLM in attesa`.
4. Cliccare filtro `Bozze`.
5. Verificare che la riga mostri `Bozza LLM` e azione `Conferma bozza`.

Atteso:
La bozza e' trattata come attivita' locale da confermare, non come output gia' salvato nella
pratica.

Red team:
Verificare che la bozza non appaia come documento disponibile al cloud.

Fallimento grave se:
Una bozza re-idratata sembra gia' salvata o disponibile senza conferma.

## WR-002 - Apertura dettaglio bozza

Scopo:
Verificare che il dettaglio bozza avvisi che il contenuto e' locale e puo' contenere dati reali.

Strumenti mcp-electron:
`click_by_text`, `wait_for_text`, `get_body_text`.

Dati:
Bozza sintetica.

Passi:

1. Cliccare `Conferma bozza`.
2. Leggere il pannello dettaglio.
3. Verificare path relativa, file name, hashMatches e contenuto.
4. Verificare se il copy chiarisce che la bozza e' locale e re-idratata.
5. Verificare che compaia un warning esplicito: il testo puo' contenere dati reali reinseriti
   localmente e il LLM ha lavorato sui pseudonimi.

Atteso:
L'utente capisce che sta vedendo una bozza locale destinata alla cartella pratica e che il testo
puo' contenere dati reali sul computer, non ricevuti dal LLM.

Red team:
Cercare ambiguita' tra `testo ricevuto dal LLM` e `testo re-idratato locale`.

Fallimento grave se:
Il pannello non chiarisce che il contenuto puo' contenere dati reali locali.

## WR-003 - Hash staging non valido blocca promozione

Scopo:
Verificare che una bozza modificata dopo la registrazione non sia promossa.

Strumenti mcp-electron:
`get_body_text`, `query_enabled_by_selector` se possibile.

Dati:
Bozza sintetica alterata manualmente nello staging.

Passi:

1. Preparare una bozza sintetica in staging.
2. Alterare il file staged in modo controllato.
3. Aprire dettaglio bozza.
4. Verificare messaggio `bozza in staging e' cambiata` o equivalente.
5. Verificare che `Conferma salvataggio` sia disabilitato.

Atteso:
La UI blocca la promozione se `hashMatches=false`.

Red team:
Provare a cliccare comunque il pulsante o inviare Enter.

Fallimento grave se:
Una bozza modificata viene promossa.

## WR-004 - Conferma salvataggio

Scopo:
Verificare che confermare una bozza valida la rimuova dalla lista e salvi nella pratica locale.

Strumenti mcp-electron:
`click_by_text`, `wait_for_text`, `get_body_text`.

Dati:
Bozza sintetica valida.

Passi:

1. Aprire dettaglio bozza.
2. Cliccare `Conferma salvataggio`.
3. Attendere aggiornamento dashboard.
4. Verificare che la bozza non sia piu' in attesa.

Atteso:
La bozza viene promossa localmente e sparisce dalle attivita' pendenti.

Red team:
Verificare che il return UI non confonda salvataggio locale con esposizione cloud.

Fallimento grave se:
Una bozza viene salvata senza conferma o resta in lista dopo promozione riuscita.

## WR-005 - Ambiguita' pseudonimi non nascosta

Scopo:
Verificare che eventuali pseudonimi ambigui siano visibili all'utente e non risolti a indovinare.

Strumenti mcp-electron:
`get_body_text`.

Dati:
Bozza sintetica costruita per creare ambiguita' se disponibile.

Passi:

1. Preparare bozza con pseudonimo ambiguo.
2. Aprire dettaglio.
3. Verificare presenza di warning su pseudonimi ambigui.
4. Verificare che la UI non presenti la bozza come completamente sicura.

Atteso:
Ambiguita' segnalata, non nascosta.

Red team:
Verificare se la promozione e' bloccata o richiede scelta esplicita.

Fallimento grave se:
Il sistema indovina una re-idratazione ambigua senza segnalazione.
