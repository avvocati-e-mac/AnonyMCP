# Test documenti sensibili

Questi test verificano il principio: AnonyMCP suggerisce, l'avvocato decide localmente, ma con
`allowCloudForSensitive=false` i documenti sensibili non devono arrivare al LLM cloud.

## SEN-001 - Documento suggerito sensibile visibile in Bloccati

Scopo:
Verificare che un documento con salute, penale o minori emerga nella pagina `Bloccati` e nei
badge della top nav.

Strumenti mcp-electron:
`get_body_text`, `click_by_text`.

Dati:
Pratiche sintetiche generate da `npm run gen:test-pratiche`, che includono referti e minori.

Passi:

1. Scansionare le pratiche.
2. Aprire dashboard e verificare il badge `Bloccati` se presente.
3. Aprire `Bloccati` dalla top nav.
4. Verificare che compaiano documenti suggeriti sensibili o bloccati MCP/LLM.
5. Verificare che il copy espanda `Bloccati` in `Bloccati MCP/LLM`.

Atteso:
I documenti sensibili non sono nascosti in una lista secondaria difficile da trovare.

Red team:
Verificare se KPI dashboard, badge top nav e righe della pagina `Bloccati` sono coerenti.

Fallimento grave se:
Un documento sensibile non appare come urgente o bloccato.

## SEN-002 - Copy sulla decisione professionale

Scopo:
Verificare che la UI dica chiaramente che AnonyMCP suggerisce e l'avvocato decide.

Strumenti mcp-electron:
`click_by_text`, `get_body_text`.

Dati:
Documento sintetico sensibile.

Passi:

1. Aprire review di un documento suggerito sensibile.
2. Leggere il blocco `Sensibilita'`.
3. Verificare presenza di testo simile a `AnonyMCP suggerisce; la decisione finale e' dell'avvocato`.
4. Verificare le azioni disponibili.

Atteso:
La UI non presenta il classificatore come decisione automatica definitiva.

Red team:
Cercare parole come `certificato`, `sicuro`, `definitivo` associate alla classificazione
automatica.

Fallimento grave se:
La UI delega implicitamente al sistema una decisione che deve restare professionale.

## SEN-003 - Sensibile blocca MCP/LLM

Scopo:
Verificare che impostare un documento come sensibile lo blocchi per MCP/LLM.

Strumenti mcp-electron:
`click_by_text`, `wait_for_text`, `get_body_text`.

Dati:
Documento sintetico.

Passi:

1. Aprire review.
2. Cliccare `Sensibile - blocca MCP/LLM`.
3. Tornare o aggiornare.
4. Aprire `Bloccati`.
5. Verificare che la riga mostri `Bloccato MCP/LLM` o equivalente nella colonna `MCP/LLM`.

Atteso:
Il documento resta locale anche se puo' essere approvato localmente.

Red team:
Approvare dopo aver marcato sensibile e verificare che lo stato MCP/LLM resti bloccato.

Fallimento grave se:
Un documento marcato sensibile diventa disponibile via MCP/LLM con policy default.

## SEN-004 - Non sensibile nel contesto non deve essere troppo facile

Scopo:
Valutare se l'azione `Non sensibile nel contesto` e' abbastanza chiara e proporzionata.

Strumenti mcp-electron:
`click_by_text`, `get_body_text`.

Dati:
Documento sintetico suggerito sensibile.

Passi:

1. Aprire review di un documento suggerito sensibile.
2. Cliccare `Non sensibile nel contesto`.
3. Verificare che la UI chieda una conferma forte quando il documento era suggerito sensibile.
4. Verificare che la conferma spieghi l'effetto MCP/LLM dopo la review.
5. Non usare dati reali.

Atteso:
L'utente capisce che sta prendendo una decisione professionale e che puo' incidere sulla
disponibilita' via MCP/LLM dopo review. Un click accidentale non deve bastare.

Red team:
Valutare se un click accidentale puo' sbloccare il documento senza conferma forte.

Fallimento grave se:
Un documento suggerito sensibile puo' essere reso non sensibile con un click poco visibile e
senza spiegazione dell'effetto.

## SEN-005 - Usa suggerimento ripristina default prudente

Scopo:
Verificare che l'utente possa tornare al suggerimento di AnonyMCP.

Strumenti mcp-electron:
`click_by_text`, `wait_for_text`, `get_body_text`.

Dati:
Documento sintetico sensibile.

Passi:

1. Impostare `Non sensibile nel contesto`.
2. Cliccare `Usa suggerimento`.
3. Verificare che dashboard, top nav e pagina `Bloccati` tornino a considerare il documento suggerito sensibile.

Atteso:
Il default prudente e' recuperabile.

Red team:
Verificare che il cambio stato non lasci indice o dashboard incoerenti.

Fallimento grave se:
Il documento resta esposto dopo ripristino del suggerimento sensibile.

## SEN-006 - Controllo MCP separato dalla UI

Scopo:
Ricordare che questo test UI non basta: la disponibilita' cloud va verificata anche via test MCP.

Strumenti mcp-electron:
`get_body_text` per osservare UI. Test MCP separati per conferma tecnica.

Dati:
Documento sintetico sensibile approvato localmente.

Passi:

1. Approvare localmente un documento sensibile sintetico.
2. Verificare nella UI che sia bloccato cloud.
3. Eseguire test MCP separato o suite esistente per confermare che Resource/read e search non lo
   restituiscano.

Atteso:
UI e server sono coerenti.

Red team:
Se UI dice bloccato ma MCP espone il documento, e' un bug critico server-side.

Fallimento grave se:
La UI rassicura l'utente mentre il canale MCP espone il documento.
