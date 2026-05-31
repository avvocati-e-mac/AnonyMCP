// ============================================================
// practiceRegistry — stato in RAM delle pratiche e dei documenti:
// scansione cartelle, stato quarantena/approvato, risultati di
// pseudonimizzazione. Coordina engine + cache cifrata + classificazione.
//
// La mappa reversibile reale↔pseudonimo NON è qui: vive nel SessionManager
// (RAM) e non viene mai serializzata in chiaro.
// ============================================================

import { readdirSync, statSync, readFileSync } from 'node:fs'
import { join, basename } from 'node:path'
import type { AnonymizationResult, DetectedEntity, DocumentStatus, ExposedFolder } from '../types.js'
import { isSupported, isTextDocument } from '../pipeline/toMarkdown.js'
import { processText } from '../pipeline/documentService.js'
import { SessionManager } from '../engine/sessionManager.js'
import { classifySensitivity } from '../pipeline/riskScorer.js'
import { sanitizeId, isInternalArtifact } from '../util/pathGuard.js'
import { hmac, randomKey, sha256 } from '../util/crypto.js'
import { buildCache, saveCache, loadCache } from './practiceStore.js'
import { log } from '../util/logger.js'

export interface DocEntry {
  /** Id opaco usato nell'URI della resource (non rivela il nome file reale). */
  docId: string
  filePath: string
  status: DocumentStatus
  /** Risultato pseudonimizzato (presente dopo la scansione). */
  result?: AnonymizationResult
}

export interface PracticeEntry {
  folder: ExposedFolder
  /** SessionManager condiviso tra i documenti della pratica (coerenza pseudonimi). */
  session: SessionManager
  docs: Map<string, DocEntry>
}

export class PracticeRegistry {
  private practices = new Map<string, PracticeEntry>()
  /** Callback invocata quando cambia l'elenco di resource (per listChanged). */
  onResourcesChanged?: () => void
  /**
   * Chiave segreta casuale per gli id opachi (HMAC). Generata a ogni avvio:
   * gli URI sono stabili nella sessione ma non correlabili tra sessioni né
   * forzabili offline conoscendo i path.
   */
  private readonly idKey = randomKey()

  /**
   * @param cachePassphrase se presente, abilita la cache cifrata `.anonymcp`
   *   (coerenza pseudonimi tra sessioni). Se assente, modello "forward-only":
   *   gli pseudonimi sono coerenti solo entro la sessione corrente.
   */
  constructor(
    private folders: ExposedFolder[],
    private requireManualApproval: boolean,
    private cachePassphrase?: string
  ) {
    for (const folder of folders) {
      this.practices.set(folder.id, { folder, session: new SessionManager(), docs: new Map() })
    }
  }

  listFolders(): ExposedFolder[] {
    return this.folders
  }

  getPractice(folderId: string): PracticeEntry | undefined {
    return this.practices.get(folderId)
  }

  /** File supportati e non-artefatti dentro una cartella pratica. */
  private listFiles(folderPath: string): string[] {
    let names: string[]
    try {
      names = readdirSync(folderPath)
    } catch {
      return []
    }
    return names
      .map((n) => join(folderPath, n))
      .filter((p) => {
        try {
          return statSync(p).isFile() && isSupported(p) && !isInternalArtifact(p)
        } catch {
          return false
        }
      })
  }

  /**
   * Genera un docId opaco e stabile per un file. Usa HMAC con la chiave di
   * sessione (no sha256 nudo del path → non forzabile con dizionario) e NON
   * include l'estensione (che rivelerebbe il tipo di documento).
   */
  private docIdFor(filePath: string): string {
    return sanitizeId(hmac(filePath, this.idKey).slice(0, 24))
  }

  /**
   * (Ri)scansiona una pratica: pseudonimizza ogni documento testuale.
   * I documenti restano in quarantena se requireManualApproval è attivo.
   * Ritorna un sommario (senza valori reali).
   */
  async scan(folderId: string): Promise<{ scanned: number; quarantined: number; skipped: number }> {
    const practice = this.practices.get(folderId)
    if (!practice) throw new Error(`Pratica sconosciuta: ${folderId}`)

    const files = this.listFiles(practice.folder.path).filter(isTextDocument)
    const skipped = this.listFiles(practice.folder.path).length - files.length

    // sourceHash deterministico sull'insieme dei contenuti testuali della pratica.
    const sourceHash = `sha256:${sha256(
      files
        .sort()
        .map((f) => sha256(readFileSync(f, 'utf8')))
        .join('|')
    )}`

    // Precarica la cache cifrata (se abilitata e ancora valida) → coerenza pseudonimi.
    if (this.cachePassphrase) {
      const cache = loadCache(practice.folder.path, this.cachePassphrase, sourceHash)
      if (cache) {
        for (const e of cache.entries) {
          if (e.confirmed) practice.session.preloadByHash(e.origHash, e.pseudonym, e.type)
        }
        log.info('Cache pratica precaricata', { folderId, entries: cache.entries.length })
      }
    }

    let scanned = 0
    let quarantined = 0
    const allEntities: DetectedEntity[] = []

    for (const filePath of files) {
      const docId = this.docIdFor(filePath)
      const raw = readFileSync(filePath, 'utf8')
      const result = await processText(raw, { session: practice.session })
      const status: DocumentStatus = this.requireManualApproval ? 'quarantined' : 'approved'
      practice.docs.set(docId, { docId, filePath, status, result })
      allEntities.push(...result.entities)
      scanned++
      if (status === 'quarantined') quarantined++
      log.info('Documento processato', { folderId, docId, status, sensitive: result.sensitive })
    }

    // Persiste la cache cifrata (solo hash, niente PII in chiaro) per la prossima sessione.
    if (this.cachePassphrase && scanned > 0) {
      const confirmed = !this.requireManualApproval // confermate solo se auto-approvate
      const cache = buildCache(folderId, sourceHash, allEntities, confirmed)
      saveCache(practice.folder.path, cache, this.cachePassphrase)
    }

    this.onResourcesChanged?.()
    return { scanned, quarantined, skipped }
  }

  /** Approva un documento in quarantena (human-in-the-loop). */
  approve(folderId: string, docId: string): boolean {
    const doc = this.practices.get(folderId)?.docs.get(docId)
    if (!doc) return false
    doc.status = 'approved'
    this.onResourcesChanged?.()
    return true
  }

  /** Documenti esponibili come resource: solo quelli approvati. */
  exposableDocs(): { folderId: string; doc: DocEntry }[] {
    const out: { folderId: string; doc: DocEntry }[] = []
    for (const [folderId, p] of this.practices) {
      for (const doc of p.docs.values()) {
        if (doc.status === 'approved') out.push({ folderId, doc })
      }
    }
    return out
  }

  /** Stato di una pratica (conteggi, NON valori reali). */
  status(folderId: string): {
    label: string
    approved: number
    quarantined: number
    entitiesByType: Record<string, number>
    sensitiveDocs: number
  } {
    const p = this.practices.get(folderId)
    if (!p) throw new Error(`Pratica sconosciuta: ${folderId}`)
    let approved = 0
    let quarantined = 0
    let sensitiveDocs = 0
    for (const doc of p.docs.values()) {
      if (doc.status === 'approved') approved++
      else quarantined++
      if (doc.result?.sensitive) sensitiveDocs++
    }
    return {
      label: p.folder.label,
      approved,
      quarantined,
      entitiesByType: p.session.getStats().byType,
      sensitiveDocs
    }
  }
}

/** Riesporta per i tool. */
export { classifySensitivity }
export function shortName(filePath: string): string {
  return basename(filePath)
}
