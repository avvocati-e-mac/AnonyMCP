// ============================================================
// Genera documenti sintetici con DATI FINTI (mai reali) per i test di
// pseudonimizzazione, uno per ciascuna materia del diritto italiano.
// Output: test/fixtures/synthetic/*.md  (+ un manifest con le entità attese).
//
// I dati sono inventati e deterministici (nessun seed RNG): i test possono
// asserire che entità note NON compaiano mai nell'output pseudonimizzato.
// ============================================================

import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const OUT = join(here, '..', 'test', 'fixtures', 'synthetic')

interface Fixture {
  name: string
  matter: string
  content: string
  /** Stringhe che NON devono mai comparire nell'output pseudonimizzato. */
  mustNotLeak: string[]
  /** True se atteso come "sensibile" (art. 9/10 GDPR). */
  sensitive: boolean
}

const fixtures: Fixture[] = [
  {
    name: 'civile_citazione.md',
    matter: 'civile',
    sensitive: false,
    mustNotLeak: ['Mario Rossi', 'BNCLRA75M41F205Z', 'mario.rossi@example.com', 'IT60X0542811101000000123456'],
    content: `# Atto di citazione

Il Sig. Mario Rossi, nato a Milano il 12 marzo 1975, codice fiscale BNCLRA75M41F205Z,
residente in Via Giuseppe Verdi 10, 20100, email mario.rossi@example.com,
elettivamente domiciliato presso lo studio dell'Avv. Anna Bianchi.

CITA

la società Beta S.r.l. (P.IVA 12345678901) a comparire dinanzi al Tribunale di Milano.
Pagamento richiesto sull'IBAN IT60X0542811101000000123456.
Rossi chiede la condanna al pagamento di euro 15.000,00.
`
  },
  {
    name: 'penale_memoria.md',
    matter: 'penale',
    sensitive: true,
    mustNotLeak: ['Luca Verdi', 'VRDLCU82T10G273K', '3331234567'],
    content: `# Memoria difensiva

L'imputato Luca Verdi, nato il 10 dicembre 1982, C.F. VRDLCU82T10G273K,
è accusato del reato di cui all'art. 624 c.p. Il difensore Avv. Paolo Neri
deposita memoria. Recapito: 3331234567. Iscritto al R.G. 4567/2026.
`
  },
  {
    name: 'tributario_ricorso.md',
    matter: 'tributario',
    sensitive: false,
    mustNotLeak: ['Gamma S.p.A.', '98765432109'],
    content: `# Ricorso tributario

La Gamma S.p.A., P.IVA 98765432109, con sede in Corso Italia 5, 00100,
ricorre avverso l'avviso di accertamento prot. n. 55512/2026 dinanzi alla
Corte di Giustizia Tributaria. Importo contestato euro 230.000,00.
`
  },
  {
    name: 'amministrativo_ricorso_tar.md',
    matter: 'amministrativo',
    sensitive: false,
    mustNotLeak: ['Giulia Ferrari', 'giulia.ferrari@pec.comune.example.it'],
    content: `# Ricorso al TAR

La Dott.ssa Giulia Ferrari, dirigente, PEC giulia.ferrari@pec.comune.example.it,
impugna il provvedimento prot. n. 12345/2026 del Comune di Roma.
Targa veicolo di servizio AB123CD.
`
  }
]

function main(): void {
  mkdirSync(OUT, { recursive: true })
  const manifest: Record<string, Omit<Fixture, 'content'>> = {}
  for (const f of fixtures) {
    writeFileSync(join(OUT, f.name), f.content, 'utf8')
    const { content, ...meta } = f
    void content
    manifest[f.name] = meta
  }
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')
  process.stderr.write(`Generati ${fixtures.length} fixture in ${OUT}\n`)
}

main()
