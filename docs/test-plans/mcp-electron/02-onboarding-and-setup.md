# Test onboarding e setup pratiche

Questi test verificano che un utente non tecnico capisca cosa fa AnonyMCP e riesca ad
aggiungere pratiche senza toccare JSON a mano.

## ONB-001 - Messaggio iniziale chiaro

Scopo:
Verificare che l'onboarding spieghi il confine fondamentale: AnonyMCP protegge il passaggio
verso il LLM cloud, ma non rende il documento anonimo in senso assoluto.

Strumenti mcp-electron:
`get_body_text`, `find_elements`, `click_by_text`.

Dati:
Nessun documento reale. Config sintetica o vuota.

Passi:

1. Aprire l'app con onboarding visibile.
2. Leggere il testo della schermata.
3. Verificare la presenza di `LLM cloud`, `pseudonimizzazione` o equivalente, e `review` umana.
4. Verificare che non prometta anonimizzazione assoluta.
5. Cliccare `Continua`.

Atteso:
La schermata comunica che il testo resta dato personale e che il controllo finale resta umano.

Red team:
Cercare parole ingannevoli come `anonimo`, `sicuro al 100%`, `automatico` senza avviso.

Fallimento grave se:
La UI lascia intendere che non serva review umana o che il documento sia anonimizzato in modo
definitivo.

## ONB-002 - Onboarding recuperabile

Scopo:
Verificare che l'utente possa rivedere la spiegazione privacy dopo averla chiusa.

Strumenti mcp-electron:
`click_by_text`, `wait_for_text`, `get_body_text`.

Dati:
Config sintetica.

Passi:

1. Entrare nella dashboard o setup.
2. Cliccare `Come funziona la privacy`.
3. Verificare che torni la spiegazione iniziale.
4. Cliccare `Continua`.

Atteso:
La spiegazione resta accessibile e non richiede conoscenze tecniche.

Red team:
Verificare che non sia nascosta dietro impostazioni tecniche o icone senza testo.

Fallimento grave se:
L'utente non puo' recuperare l'informazione sul confine privacy.

## SET-001 - Setup senza config pronta

Scopo:
Verificare che l'app guidi l'utente quando non ci sono pratiche configurate.

Strumenti mcp-electron:
`get_body_text`, `find_elements`.

Dati:
Config vuota o mancante in ambiente sintetico.

Passi:

1. Avviare l'app con config vuota o senza config.
2. Leggere la schermata di setup.
3. Verificare che siano presenti le opzioni `Singola pratica`, `Cartella Pratiche`,
   `Clienti / pratiche`.
4. Verificare che la UI non chieda di modificare JSON a mano.

Atteso:
La UI propone una scelta comprensibile di organizzazione cartelle.

Red team:
Controllare se il messaggio `Config non pronta` e' tecnico o azionabile.

Fallimento grave se:
L'utente resta bloccato senza una prossima azione chiara.

## SET-002 - Import manuale cartelle

Scopo:
Verificare il flusso di import manuale di cartelle pratica.

Strumenti mcp-electron:
`click_by_text`, `wait_for_text`, `get_body_text`.

Dati:
Cartelle sintetiche generate con `npm run gen:test-pratiche`.

Passi:

1. Aprire setup.
2. Cliccare `Singola pratica`.
3. Verificare che compaia `Inserimento manuale pratica`.
4. Verificare che la dropzone spieghi che le etichette MCP saranno opache.
5. Se si usa il dialog di sistema, selezionare solo cartelle sintetiche.

Atteso:
Il flusso spiega che ogni cartella e' trattata come pratica distinta e che le etichette MCP sono
rese opache.

Red team:
Usare una cartella sintetica con nome identificante, per esempio `Mario Rossi contro Beta`, e
verificare che il label MCP proposto non conservi il nome.

Fallimento grave se:
Un nome cartella identificante diventa `label` o `folderId` visibile al canale MCP.

## SET-003 - Stato post-import comprensibile

Scopo:
Verificare che dopo l'import l'utente capisca quante pratiche sono state aggiunte.

Strumenti mcp-electron:
`wait_for_text`, `get_body_text`.

Dati:
Pratiche sintetiche.

Passi:

1. Eseguire import.
2. Leggere il messaggio di risultato.
3. Verificare che siano indicati aggiunti e saltati.
4. Verificare che la dashboard si aggiorni.

Atteso:
Il risultato e' breve e comprensibile: pratiche aggiunte, gia' presenti o non valide.

Red team:
Ripetere import delle stesse cartelle e verificare che il messaggio non sembri errore grave.

Fallimento grave se:
La UI fa credere che pratiche duplicate siano state aggiunte di nuovo o non mostra il risultato.
