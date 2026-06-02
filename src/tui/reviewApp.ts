// ============================================================
// reviewApp — loop di review da terminale SENZA framework reattivo (no Ink/React).
// Modello "stampa → leggi tasto → ristampa": si ridisegna SOLO su input dell'utente,
// quindi niente diff di frame e niente impilamento (i bug storici di Ink).
//
// Un SOLO gestore keypress per tutta la sessione (niente readline.createInterface,
// che in raw mode confliggeva e faceva uscire dalla TUI). L'aggiunta di un'entità è
// un prompt INLINE gestito da una piccola macchina a stati (browse/addTerm/addType),
// così si resta sempre nella TUI e si possono aggiungere più entità di fila.
//
// ⚠️ Provvisoria: la Fase 2 sarà un'app Electron grafica. La logica di presentazione
// pura (render.ts, entityColors, highlight) migrerà all'app.
//
// Scopo della review (vedi CLAUDE.md): COLPO D'OCCHIO sul documento intero con le
// entità evidenziate, per accorgersi di cosa il NER ha MANCATO e aggiungerlo a mano.
//   ↑↓ / k j   sposta il cursore nella lista entità (finestra scorrevole)
//   SPAZIO     includi/escludi l'entità sotto il cursore
//   n / p      pagina successiva/precedente del documento
//   TAB        anteprima Originale ↔ Anonimizzato
//   a          aggiungi un'entità mancante (prompt inline: testo + tipo)
//   INVIO      approva (con le entità incluse)
//   q / ESC    annulla
// ============================================================

import { emitKeypressEvents, type Key } from 'node:readline'
import chalk from 'chalk'
import type { DetectedEntity, EntityType } from '../types.js'
import type { HighlightMode } from './highlight.js'
import { renderDocPage, renderEntityList, windowAround } from './render.js'
import { ENTITY_TYPES, colorForType } from './entityColors.js'

export interface ReviewAppProps {
  practiceLabel: string
  fileName: string
  originalText: string
  /** Testo pseudonimizzato corrente (può cambiare se si aggiungono entità). */
  anonymizedText: string
  entities: DetectedEntity[]
  /**
   * Aggiunge un'entità manuale. Ritorna l'entità creata + il testo anonimizzato
   * aggiornato, oppure null se il termine è vuoto/assente/duplicato.
   */
  onAddEntity: (
    originalText: string,
    type: EntityType
  ) => { entity: DetectedEntity; anonymizedText: string } | null
}

export interface ReviewResult {
  confirmed: DetectedEntity[]
  manualAdded: number
}

const ALT_SCREEN_ON = '\x1b[?1049h'
const ALT_SCREEN_OFF = '\x1b[?1049l'
const CLEAR = '\x1b[2J\x1b[H'

/** Righe del "telaio": header, intestazioni, separatori, barra comandi. */
const FRAME_OVERHEAD = 8
/** Frazione di schermo per la lista entità (il resto, ~70%, va al documento). */
const LIST_FRACTION = 0.3

type UiMode = 'browse' | 'addTerm' | 'addType'

export function runReview(props: ReviewAppProps): Promise<ReviewResult | null> {
  return new Promise((resolve) => {
    const entities = [...props.entities]
    const included: boolean[] = entities.map(() => true)
    let cursor = 0
    let mode: HighlightMode = 'original'
    let page = 0
    let anonText = props.anonymizedText
    let manualAdded = 0

    // Stato del prompt inline di aggiunta entità.
    let uiMode: UiMode = 'browse'
    let inputBuffer = ''

    const out = process.stdout
    const input = process.stdin
    emitKeypressEvents(input)
    const wasRaw = input.isTTY ? input.isRaw : false
    if (input.isTTY) input.setRawMode(true)
    out.write(ALT_SCREEN_ON)
    input.resume()

    const cleanup = (): void => {
      input.removeListener('keypress', onKey)
      if (input.isTTY) input.setRawMode(wasRaw)
      out.write(ALT_SCREEN_OFF)
      input.pause()
    }

    const cols = out.columns ?? 80
    const rows = out.rows ?? 24

    const draw = (): void => {
      // Geometria: lista compatta (~30%, finestra scorrevole) + documento dominante (~70%).
      const listH = Math.max(3, Math.min(10, Math.ceil(rows * LIST_FRACTION)))
      const docH = Math.max(3, rows - listH - FRAME_OVERHEAD)

      const win = windowAround(cursor, entities.length, listH)
      const text = mode === 'original' ? props.originalText : anonText
      const doc = renderDocPage(text, entities, mode, page, docH, cols)
      page = doc.page // clampato

      const includedCount = included.filter(Boolean).length
      const header =
        chalk.bold(`AnonyMCP — Review ${props.practiceLabel} · ${props.fileName}`) +
        chalk.dim(`   (${includedCount}/${entities.length} incluse · entità ${cursor + 1}/${entities.length})`)
      const list =
        chalk.bold('ENTITÀ RILEVATE') +
        '\n' +
        renderEntityList(entities, included, cursor, win.start, win.end)
      const modeLabel = mode === 'original' ? 'Originale' : 'Anonimizzato'
      const docHeader = chalk.bold(`DOCUMENTO [${modeLabel}] · pagina ${doc.page + 1}/${doc.totalPages}`)

      // Riga di stato in fondo: barra comandi oppure prompt inline di aggiunta.
      let footer: string
      if (uiMode === 'addTerm') {
        footer =
          chalk.green('+ Aggiungi entità') +
          ` · testo da anonimizzare: ${chalk.inverse(inputBuffer + ' ')}` +
          chalk.dim('   (INVIO conferma · ESC annulla)')
      } else if (uiMode === 'addType') {
        footer = chalk.green(`+ "${inputBuffer}" · scegli il tipo:`) + '\n' + typeMenu()
      } else {
        footer = chalk.dim(
          '↑↓ entità · SPAZIO includi/escludi · n/p pagina · TAB orig/anon · a aggiungi · INVIO approva · q annulla'
        )
      }

      out.write(
        CLEAR +
          header +
          '\n\n' +
          list +
          '\n\n' +
          docHeader +
          '\n' +
          doc.body +
          '\n\n' +
          footer
      )
    }

    /** Colora il nome di un tipo con il suo colore chalk (fallback: testo nudo). */
    const paintType = (t: EntityType): string => {
      const fn = (chalk as unknown as Record<string, (s: string) => string>)[colorForType(t)]
      return typeof fn === 'function' ? fn(t) : t
    }

    /** Menu compatto dei tipi: numero acceleratore + nome colorato. */
    const typeMenu = (): string =>
      ENTITY_TYPES.map((t, i) => `${chalk.bold(`[${i + 1}]`)}${paintType(t)}`).join('  ')

    /** Conferma l'aggiunta dell'entità con il tipo scelto. */
    const commitAdd = (type: EntityType): void => {
      const res = props.onAddEntity(inputBuffer.trim(), type)
      if (res) {
        entities.push(res.entity)
        included.push(true)
        anonText = res.anonymizedText
        cursor = entities.length - 1
        manualAdded++
      }
      uiMode = 'browse'
      inputBuffer = ''
      draw()
    }

    const onKey = (str: string, key: Key): void => {
      const name = key?.name
      if (key?.ctrl && name === 'c') {
        cleanup()
        resolve(null)
        return
      }

      // --- Prompt inline: digitazione del testo dell'entità ---
      if (uiMode === 'addTerm') {
        if (name === 'escape') {
          uiMode = 'browse'
          inputBuffer = ''
        } else if (name === 'return') {
          if (inputBuffer.trim().length > 0) uiMode = 'addType'
        } else if (name === 'backspace') {
          inputBuffer = inputBuffer.slice(0, -1)
        } else if (str && str.length === 1 && str >= ' ') {
          inputBuffer += str // carattere stampabile
        }
        draw()
        return
      }

      // --- Prompt inline: scelta del tipo (numero) ---
      if (uiMode === 'addType') {
        if (name === 'escape') {
          uiMode = 'browse'
          inputBuffer = ''
          draw()
          return
        }
        const n = parseInt(str ?? '', 10)
        if (!Number.isNaN(n) && n >= 1 && n <= ENTITY_TYPES.length) {
          commitAdd(ENTITY_TYPES[n - 1]!)
        }
        return // ignora altri tasti finché non sceglie
      }

      // --- Navigazione normale ---
      switch (name) {
        case 'up':
        case 'k':
          cursor = Math.max(0, cursor - 1)
          break
        case 'down':
        case 'j':
          cursor = Math.min(entities.length - 1, cursor + 1)
          break
        case 'space':
          if (entities.length > 0) included[cursor] = !included[cursor]
          break
        case 'n':
        case 'pagedown':
          page++
          break
        case 'p':
        case 'pageup':
          page = Math.max(0, page - 1)
          break
        case 'tab':
          mode = mode === 'original' ? 'pseudonym' : 'original'
          page = 0
          break
        case 'a':
          uiMode = 'addTerm'
          inputBuffer = ''
          break
        case 'return':
          cleanup()
          resolve({ confirmed: entities.filter((_, i) => included[i]), manualAdded })
          return
        case 'q':
        case 'escape':
          cleanup()
          resolve(null)
          return
        default:
          return // tasto ignorato: niente ridisegno
      }
      draw()
    }

    input.on('keypress', onKey)
    draw()
  })
}
