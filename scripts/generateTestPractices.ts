// ============================================================
// generateTestPractices — genera 2 PRATICHE sintetiche realistiche (dati TUTTI
// inventati) come cartelle .md + config, per il TEST MANUALE end-to-end del flusso
// di review/MCP prima della produzione. NON sono fixture di CI: sono dati di prova
// locali (non committati). Servono soprattutto a misurare i FALSI NEGATIVI del
// rilevamento (un nome mancato = PII verso l'LLM) e a testare review, aggiunta
// manuale, memoria del dizionario, hard gate e dati art.9/10.
//
// Pratica A (400F): sfratto per morosità (civile), 8 documenti.
// Pratica B (215S): sinistro stradale / risarcimento (stragiudiziale), 8 documenti.
//
// Etichette OPACHE (ADR-004): mai nomi delle parti, solo numeri di pratica.
// Le parti ricorrono tra i documenti della stessa pratica (testa il dizionario);
// nessuna parte è condivisa tra A e B (anti-collisione dei dizionari).
//
// Uso:
//   npm run gen:test-pratiche            → in ~/anonymcp-test-pratiche
//   npm run gen:test-pratiche -- <dir>   → in <dir>
// ============================================================

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

interface Doc {
  name: string
  content: string
}
interface Practice {
  id: string
  label: string
  matter: string
  docs: Doc[]
}

// ---------------------------------------------------------------------------
// PRATICA A — 400F — Sfratto per morosità (civile)
// ---------------------------------------------------------------------------

const A_DOCS: Doc[] = [
  {
    name: '400F_atto_citazione.md',
    content: `ATTO DI CITAZIONE
Tribunale Civile di Salerno — R.G. 1487/2026

Il sottoscritto Avv. Lucia Ferro Marchetti, del Foro di Salerno,
PEC lucia.ferromarchetti@pec.ordineavvocatisa.it, in nome e per conto di

Giovanni Bianchi Esposito, nato a Salerno il 23 luglio 1968,
codice fiscale BNCGNN68L23H703K, residente in Via Roma 14, 84121 Salerno,
tel. +39 089 221144, email g.bianchiesposito@gmail.com

CITA

il Sig. Karim El Mansouri, conduttore dell'immobile sito in
Via Indipendenza 22, interno 5, 84122 Salerno, a comparire dinanzi
al Tribunale di Salerno per sentir pronunciare la risoluzione del
contratto di locazione per morosità.

L'attore chiede la condanna al pagamento dei canoni scaduti pari a
euro 9.600,00, da accreditare sull'IBAN IT89 H030 6909 6061 0000 0123 456.
`
  },
  {
    name: '400F_comparsa_risposta.md',
    content: `COMPARSA DI COSTITUZIONE E RISPOSTA
Tribunale Civile di Salerno — R.G. 1487/2026

Per il convenuto Sig. Karim El
Mansouri, codice fiscale LMNKRM85B04Z330U, rappresentato e difeso
dall'Avv. Stefano Riva, si deposita la presente comparsa.

Il convenuto contesta la domanda attorea proposta da Giovanni Bianchi
Esposito ed eccepisce di aver corrisposto parte dei canoni. Chiede il
rigetto della domanda di risoluzione del contratto di locazione.

Si producono ricevute di pagamento e documentazione bancaria.
`
  },
  {
    name: '400F_contratto_locazione.md',
    content: `CONTRATTO DI LOCAZIONE AD USO ABITATIVO
(Legge 9 dicembre 1998, n. 431)

Salerno, 1 febbraio 2024

LOCATORE
Giovanni Bianchi Esposito, nato a Salerno il 23 luglio 1968,
codice fiscale BNCGNN68L23H703K, residente in Via Roma 14, 84121 Salerno,
tel. +39 089 221144, e-mail g.bianchiesposito@gmail.com

CONDUTTORE
Karim El Mansouri, nato a Casablanca il 4 febbraio 1985,
codice fiscale LMNKRM85B04Z330U,
documento di identità: Carta d'identità n. CA 5528847
rilasciata dal Comune di Salerno il 10 marzo 2021,
tel. 333 7654321, e-mail k.elmansouri@libero.it

PREMESSO CHE il Locatore è proprietario dell'immobile sito in
Via Indipendenza 22, interno 5, 84122 Salerno, identificato al Catasto
Fabbricati del Comune di Salerno al foglio 18, particella 442, sub. 7;

SI CONVIENE E SI STIPULA QUANTO SEGUE

Art. 1 — Oggetto. Il Locatore concede in locazione alla Conduttrice
l'immobile sopra descritto.

Art. 3 — Canone. Il canone mensile è fissato in euro 1.200,00, da
corrispondere mediante bonifico sull'IBAN IT89 H030 6909 6061 0000 0123 456.

Letto, confermato e sottoscritto.

Testimoni:
- Rosa Iannone, nata a Salerno il 2 maggio 1970
- Pietro Coppola D'Avena, nato a Eboli il 14 novembre 1965
`
  },
  {
    name: '400F_perizia_tecnica.md',
    content: `RELAZIONE TECNICA DI STIMA E STATO DELL'IMMOBILE
Protocollo n. 2207/2026

CTU: Geom. Antonio Greco, iscritto all'Albo dei Geometri di Salerno.

Oggetto: immobile sito in Via Indipendenza 22, interno 5, 84122 Salerno,
identificato al Catasto Fabbricati al foglio 18, particella 442, sub. 7,
attualmente occupato dal conduttore Karim El Mansouri.

Lo scrivente, esaminato lo stato dei luoghi, riferisce che l'immobile
presenta normale stato di manutenzione. Il valore locativo di mercato è
stimato in euro 1.200,00 mensili, congruo con il canone pattuito.

Salerno, 12 marzo 2026
Il CTU — Geom. Antonio Greco
`
  },
  {
    name: '400F_diffida_messa_in_mora.md',
    content: `DIFFIDA E MESSA IN MORA
Raccomandata A/R — PEC lucia.ferromarchetti@pec.ordineavvocatisa.it

Mittente: Giovanni Bianchi Esposito
Destinatario: Karim El Mansouri, codice fiscale LMNK RM85 B04Z 330U

Con la presente, il sottoscritto Giovanni Bianchi Esposito, in qualità di
locatore, DIFFIDA E COSTITUISCE IN MORA la S.V. al pagamento dei canoni di
locazione insoluti, ammontanti ad euro 9.600,00, relativi all'immobile di
Via Indipendenza 22, Salerno.

Il pagamento dovrà avvenire entro 15 giorni sull'IBAN
IT89 H030 6909 6061 0000 0123 456, in difetto si adirà l'Autorità
Giudiziaria.

Salerno, 5 gennaio 2026
`
  },
  {
    name: '400F_procura_alle_liti.md',
    content: `PROCURA ALLE LITI
Tribunale di Salerno — R.G. 1487/2026

Io sottoscritto Giovanni Bianchi Esposito, codice fiscale
BNCGNN68L23H703K, nomino mio difensore l'Avv. Lucia Ferro Marchetti,
PEC lucia.ferromarchetti@pec.ordineavvocatisa.it, conferendole ogni più
ampia facoltà di legge nel giudizio di risoluzione del contratto di
locazione e sfratto per morosità.

Firmato Da: GIOVANNI BIANCHI ESPOSITO Emesso Da: ARUBAPEC S.P.A. NG CA 3
Serie: 4a8f2c1099bb7733

Per autentica della firma — Avv. Lucia Ferro Marchetti
`
  },
  {
    name: '400F_estratto_conto_canoni.md',
    content: `ESTRATTO CONTO MOROSITÀ — RIEPILOGO CANONI
Pratica interna n. 400F-2026-08812

Locatore: Giovanni Bianchi Esposito
IBAN di accredito: IT89 H030 6909 6061 0000 0123 456

Dati gestione immobile:
- Società di gestione: Immobiliare Tirrena S.r.l.
- P.IVA gestione: 03991210655
- Immobile: Via Indipendenza 22, int. 5, Salerno

Canoni insoluti (8 mensilità da euro 1.200,00):
- giugno 2025 — euro 1.200,00 — NON PAGATO
- luglio 2025 — euro 1.200,00 — NON PAGATO
- agosto 2025 — euro 1.200,00 — NON PAGATO
- ... (totale euro 9.600,00)

Totale dovuto: euro 9.600,00
`
  },
  {
    name: '400F_istanza_sospensione_minore.md',
    content: `ISTANZA DI SOSPENSIONE DELL'ESECUZIONE
Tribunale di Salerno — R.G. 1487/2026

Il convenuto Karim El Mansouri rappresenta la propria situazione di
disagio familiare, avendo a carico il figlio minore Yousef El Mansouri,
nato il 12 settembre 2014, iscritto presso l'Istituto Comprensivo
"Salerno Est".

Si chiede, in considerazione della presenza del minore nel nucleo
familiare, la concessione di un termine di grazia per il rilascio
dell'immobile, ai sensi della normativa vigente a tutela dei minori.

Salerno, 20 marzo 2026
Avv. Stefano Riva
`
  }
]

// ---------------------------------------------------------------------------
// PRATICA B — 215S — Sinistro stradale / risarcimento (stragiudiziale)
// ---------------------------------------------------------------------------

const B_DOCS: Doc[] = [
  {
    name: '215S_diffida_messa_in_mora.md',
    content: `LETTERA DI DIFFIDA E MESSA IN MORA
PEC sinistri@pec.adriatica-assicurazioni.it

Mittente: Chiara Lombardi Sgarbi, nata a Bologna il 9 novembre 1990,
codice fiscale LMBCHR90S49A944T, residente in Via Zamboni 38, 40126 Bologna,
tel. 347 1122334, email chiara.lombardi@hotmail.it

Destinataria: Adriatica Assicurazioni S.p.A.

Oggetto: sinistro n. 2026/ADRSX/44521 — veicolo targa EG 472 KH

Con la presente la sottoscritta DIFFIDA E METTE IN MORA codesta Compagnia
al risarcimento dei danni subiti nel sinistro in oggetto, quantificati in
euro 18.450,00, da accreditare sull'IBAN IT60 X054 2811 1010 0000 0123 456.
`
  },
  {
    name: '215S_relazione_sinistro.md',
    content: `RELAZIONE DESCRITTIVA DEL SINISTRO

In data 14 aprile 2026, all'incrocio tra Via Mazzini e Viale Carducci in
Bologna, si verificava un sinistro stradale tra i seguenti veicoli:

Veicoli coinvolti:
- autovettura targa EG 472 KH, condotta da Chiara Lombardi Sgarbi
- autovettura targa FH 905 PL, condotta da Đorđe Petrović,
  nato a Novi Sad il 17 marzo 1979, codice fiscale PTRDRD79C17Z158B

La responsabilità del sinistro è ascrivibile al conducente del secondo
veicolo, che ometteva di dare la precedenza. La Sig.ra Lombardi Sgarbi
riportava lesioni personali, come da referto allegato.
`
  },
  {
    name: '215S_referto_medico.md',
    content: `REFERTO MEDICO — CERTIFICATO DI LESIONI
Pronto Soccorso, Ospedale Maggiore di Bologna
Protocollo n. 8841/2026

Paziente: Chiara Lombardi Sgarbi, nata a Bologna il 9 novembre 1990,
codice fiscale LMBCHR90S49A944T.

Anamnesi: accesso a seguito di sinistro stradale del 14 aprile 2026.
Diagnosi: trauma distorsivo del rachide cervicale (colpo di frusta),
contusione del torace. Si riscontrano postumi permanenti stimati al 4%.
Prognosi: giorni 30 (trenta) salvo complicazioni.

Il medico — Dott.ssa Elena Russo, specialista in medicina legale.
`
  },
  {
    name: '215S_preventivo_riparazione.md',
    content: `PREVENTIVO DI RIPARAZIONE

Autofficina San Donato di Bruno Galli
Elenco dati fiscali:
• P.IVA: 02567890371
• Sede: Via San Donato 90, 40127 Bologna

Veicolo: autovettura targa EG 472 KH
Intestataria: Chiara Lombardi Sgarbi

Dettaglio interventi:
- ricambi (paraurti, fanale, portiera): euro 6.200,00
- manodopera: euro 1.300,00

Totale preventivo: euro 7.500,00
`
  },
  {
    name: '215S_corrispondenza_legali.md',
    content: `CORRISPONDENZA TRA LEGALI

Gli avvocati Marco D'Alessandro, per la danneggiata, e Federica Conti
Bianchini, per la Compagnia, in relazione al sinistro n. 2026/ADRSX/44521,
convengono di tentare una definizione bonaria.

L'Avv. Marco D'Alessandro (PEC marco.dalessandro@pec.ordineavvocatibo.it)
ribadisce la richiesta di euro 18.450,00. L'Avv. Federica Conti Bianchini
riserva di formulare proposta. In caso di mancato accordo, R.G. da
iscriversi presso il Tribunale di Bologna.
`
  },
  {
    name: '215S_referto_minore.md',
    content: `REFERTO MEDICO — SECONDO TRASPORTATO (MINORE)
Pronto Soccorso, Ospedale Maggiore di Bologna

Paziente minore: Sofia Lombardi
Sgarbi, nata il 2 giugno 2017, trasportata sul veicolo targa EG 472 KH
al momento del sinistro del 14 aprile 2026.

Diagnosi: contusione della spalla destra. Prognosi: giorni 7 (sette).
Si raccomanda controllo pediatrico.

Il medico — Dott.ssa Elena Russo.
`
  },
  {
    name: '215S_proposta_transazione.md',
    content: `PROPOSTA DI TRANSAZIONE

Adriatica Assicurazioni S.p.A. formula alla Sig.ra Chiara Lombardi Sgarbi,
in relazione al sinistro n. 2026/ADRSX/44521, la seguente proposta
transattiva a tacitazione di ogni pretesa.

Importo richiesto dalla danneggiata: euro 18.450,00
Importo offerto dalla Compagnia: euro 14.000,00

In caso di accettazione, l'importo sarà accreditato sull'IBAN
IT60 X054 2811 1010 0000 0123 456 intestato alla danneggiata.
`
  },
  {
    name: '215S_verbale_negoziazione_assistita.md',
    content: `VERBALE DI NEGOZIAZIONE ASSISTITA
(art. 2, D.L. 132/2014, conv. L. 162/2014)

Le parti, Chiara Lombardi Sgarbi e Đorđe Petrović, assistite
rispettivamente dall'Avv. Marco D'Alessandro e dall'Avv. Federica Conti
Bianchini, in relazione al sinistro n. 2026/ADRSX/44521 e alle lesioni
refertate dalla Dott.ssa Elena Russo (invalidità permanente 4%),

CONVENGONO

la definizione bonaria della controversia per l'importo di euro 16.500,00,
a tacitazione di ogni pretesa risarcitoria per danni e postumi permanenti.

Firmato Da: CHIARA LOMBARDI SGARBI Emesso Da: ARUBAPEC S.P.A. NG CA 3
Firmato Da: ĐORĐE PETROVIĆ Emesso Da: ARUBAPEC S.P.A. NG CA 3
`
  }
]

const PRACTICES: Practice[] = [
  { id: '400f', label: '400F', matter: 'civile', docs: A_DOCS },
  // La fase stragiudiziale del sinistro resta materia "civile" (il config accetta
  // civile|penale|tributario|amministrativo|altro: "stragiudiziale" è il tipo di
  // procedura, non la materia).
  { id: '215s', label: '215S', matter: 'civile', docs: B_DOCS }
]

function main(): void {
  const baseDir = process.argv[2] ?? join(homedir(), 'anonymcp-test-pratiche')
  mkdirSync(baseDir, { recursive: true })

  for (const p of PRACTICES) {
    const dir = join(baseDir, p.label)
    mkdirSync(dir, { recursive: true })
    for (const doc of p.docs) {
      writeFileSync(join(dir, doc.name), doc.content, 'utf8')
    }
  }

  const config = {
    version: 1,
    folders: PRACTICES.map((p) => ({
      id: p.id,
      label: p.label,
      path: join(baseDir, p.label),
      matter: p.matter
    })),
    requireManualApproval: true,
    allowCloudForSensitive: false,
    logLevel: 'info'
  }
  const configPath = join(baseDir, 'anonymcp.config.json')
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8')

  const total = PRACTICES.reduce((n, p) => n + p.docs.length, 0)
  process.stdout.write(
    `\n✓ Generate ${PRACTICES.length} pratiche (${total} documenti) in:\n  ${baseDir}\n\n` +
      `Config: ${configPath}\n\n` +
      `Avvia la review con:\n` +
      `  npm run review -- --practice 400f --config ${configPath}\n` +
      `  npm run review -- --practice 215s --config ${configPath}\n\n` +
      `Per Claude Desktop, punta il server a questa config.\n` +
      `⚠ Dati TUTTI inventati. Cartella non committata (dati di prova locali).\n`
  )
}

main()
