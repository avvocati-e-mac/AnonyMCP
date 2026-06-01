// ============================================================
// reviewApp — TUI di revisione (Ink) per la Fase 1 di sviluppo.
//
// ⚠️ Provvisoria: la Fase 2 sarà un'app Electron grafica per gli avvocati.
// Riusa logica pura (entityColors, highlight) che migrerà all'app Electron.
//
// Layout (stile Anonimator):
//   sinistra: lista entità con checkbox + colori per tipo
//   destra:   anteprima documento, toggle Originale/Anonimizzato, entità evidenziate
//   basso:    barra comandi
// ============================================================

import React, { useState } from 'react'
import { Box, Text, useInput, useApp } from 'ink'
import type { DetectedEntity } from '../types.js'
import { colorForType } from './entityColors.js'
import { highlightEntities, type HighlightMode } from './highlight.js'

export interface ReviewAppProps {
  /** Numero/etichetta opaca della pratica (es. "400F"). */
  practiceLabel: string
  /** Nome file in revisione (uso locale; non passa mai all'LLM). */
  fileName: string
  /** Testo originale (per l'anteprima "Originale"). */
  originalText: string
  /** Testo pseudonimizzato (per l'anteprima "Anonimizzato"). */
  anonymizedText: string
  /** Entità rilevate, con stato di inclusione iniziale (tutte incluse). */
  entities: DetectedEntity[]
  /**
   * Callback all'approvazione: riceve le entità confermate (incluse).
   * Chi monta la TUI persiste la decisione e chiude.
   */
  onApprove: (confirmed: DetectedEntity[]) => void
  /** Callback all'annullamento. */
  onCancel: () => void
}

/** Riga della lista entità. */
function EntityRow({
  entity,
  selected,
  included
}: {
  entity: DetectedEntity
  selected: boolean
  included: boolean
}): React.ReactElement {
  const color = colorForType(entity.type)
  const check = included ? '[✓]' : '[ ]'
  const occ = entity.occurrences > 1 ? ` ×${entity.occurrences}` : ''
  return (
    <Box>
      <Text inverse={selected} dimColor={!included}>
        {check} <Text color={color}>{entity.type.padEnd(14)}</Text>{' '}
        {entity.originalText} → {entity.pseudonym}
        {occ}
      </Text>
    </Box>
  )
}

/**
 * Anteprima del testo con entità evidenziate a colori, con scroll per riga.
 * Mostra `maxLines` righe a partire da `scrollOffset`. Per evidenziare le entità
 * anche quando una riga è una sottostringa, si segmenta riga per riga.
 */
function Preview({
  text,
  entities,
  mode,
  scrollOffset,
  maxLines
}: {
  text: string
  entities: DetectedEntity[]
  mode: HighlightMode
  scrollOffset: number
  maxLines: number
}): React.ReactElement {
  const lines = text.split('\n')
  const visible = lines.slice(scrollOffset, scrollOffset + maxLines)
  return (
    <Box flexDirection="column">
      {visible.map((line, li) => {
        const segments = highlightEntities(line, entities, mode)
        return (
          <Text key={li} wrap="truncate-end">
            {segments.map((seg, i) =>
              seg.type ? (
                <Text key={i} color={colorForType(seg.type)} bold>
                  {seg.text}
                </Text>
              ) : (
                <Text key={i}>{seg.text}</Text>
              )
            )}
          </Text>
        )
      })}
    </Box>
  )
}

/** Numero di righe dell'anteprima visibili insieme (finestra di scroll). */
const PREVIEW_LINES = 20

export function ReviewApp(props: ReviewAppProps): React.ReactElement {
  const { exit } = useApp()
  const [cursor, setCursor] = useState(0)
  const [included, setIncluded] = useState<boolean[]>(() => props.entities.map(() => true))
  const [mode, setMode] = useState<HighlightMode>('original')
  const [scroll, setScroll] = useState(0)

  const previewText = mode === 'original' ? props.originalText : props.anonymizedText
  const totalLines = previewText.split('\n').length
  const maxScroll = Math.max(0, totalLines - PREVIEW_LINES)

  useInput((input, key) => {
    if (key.upArrow) setCursor((c) => Math.max(0, c - 1))
    else if (key.downArrow) setCursor((c) => Math.min(props.entities.length - 1, c + 1))
    else if (input === ' ') {
      setIncluded((prev) => prev.map((v, i) => (i === cursor ? !v : v)))
    } else if (key.tab) {
      setMode((m) => (m === 'original' ? 'pseudonym' : 'original'))
    } else if (key.pageDown || input === 'j') {
      setScroll((s) => Math.min(maxScroll, s + PREVIEW_LINES))
    } else if (key.pageUp || input === 'k') {
      setScroll((s) => Math.max(0, s - PREVIEW_LINES))
    } else if (key.return) {
      const confirmed = props.entities.filter((_, i) => included[i])
      props.onApprove(confirmed)
      exit()
    } else if (key.escape || input === 'q') {
      props.onCancel()
      exit()
    }
  })

  const includedCount = included.filter(Boolean).length
  const scrollInfo =
    maxScroll > 0 ? ` · righe ${scroll + 1}-${Math.min(scroll + PREVIEW_LINES, totalLines)}/${totalLines}` : ''

  return (
    <Box flexDirection="column">
      <Text bold>
        AnonyMCP — Review pratica: {props.practiceLabel} ({props.fileName} ·{' '}
        {props.entities.length} entità, {includedCount} incluse)
      </Text>
      <Box>
        {/* Colonna sinistra: lista entità */}
        <Box flexDirection="column" width="50%" marginRight={1}>
          <Text bold>ENTITÀ RILEVATE</Text>
          {props.entities.map((e, i) => (
            <EntityRow key={i} entity={e} selected={i === cursor} included={included[i]!} />
          ))}
        </Box>
        {/* Colonna destra: anteprima con scroll */}
        <Box flexDirection="column" width="50%">
          <Text bold>
            ANTEPRIMA [{mode === 'original' ? 'Originale' : 'Anonimizzato'}]{scrollInfo}
          </Text>
          <Preview
            text={previewText}
            entities={props.entities}
            mode={mode}
            scrollOffset={scroll}
            maxLines={PREVIEW_LINES}
          />
        </Box>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          ↑↓ naviga · SPAZIO includi/escludi · TAB Orig↔Anon · PagSu/PagGiù (o k/j) scorri ·
          INVIO approva · q annulla
        </Text>
      </Box>
    </Box>
  )
}
