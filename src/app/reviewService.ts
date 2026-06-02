// ============================================================
// reviewService — facciata locale per l'app Electron.
//
// Questa API puo' restituire testo originale, nomi file e path reali perche'
// viene usata solo dalla UI locale. Non va registrata come tool/resource MCP.
// ============================================================

import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import type {
  AnonyMcpConfig,
  DetectedEntity,
  DocumentStatus,
  EntityType,
  ExposedFolder,
  SensitivityOverride
} from '../types.js'
import {
  PracticeRegistry,
  type ReviewEntity,
  type WriteOutcome
} from '../practice/practiceRegistry.js'
import type { PendingWrite } from '../practice/writeApprovalStore.js'

export interface PracticeSummary {
  folderId: string
  label: string
  path: string
  matter: ExposedFolder['matter']
  approved: number
  reviewRequired: number
  sensitiveDocs: number
  exposed: number
  cloudBlockedSensitiveDocs: number
  pendingWrites: number
}

export interface DashboardSummary {
  practices: PracticeSummary[]
  totals: {
    practices: number
    approved: number
    reviewRequired: number
    sensitiveDocs: number
    exposed: number
    cloudBlockedSensitiveDocs: number
    pendingWrites: number
  }
}

export interface ReviewDocumentListItem {
  folderId: string
  label: string
  docId: string
  fileName: string
  status: DocumentStatus
  sensitive: boolean
  sensitiveSuggested: boolean
  sensitivityOverride?: SensitivityOverride
  exposable: boolean
}

export interface ReviewDocumentDetail extends ReviewDocumentListItem {
  originalText: string
  anonymizedText: string
  residualRisk: number
  entities: ReviewEntity[]
}

export interface CloudBlockedSensitiveDocument {
  folderId: string
  label: string
  practicePath: string
  docId: string
  fileName: string
  status: DocumentStatus
  sensitive: boolean
  sensitiveSuggested: boolean
  sensitivityOverride?: SensitivityOverride
}

export interface LocalReviewServiceOptions {
  cachePassphrase?: string
}

export class LocalReviewService {
  constructor(private readonly registry: PracticeRegistry) {}

  static fromConfig(config: AnonyMcpConfig, options: LocalReviewServiceOptions = {}): LocalReviewService {
    return new LocalReviewService(
      new PracticeRegistry(
        config.folders,
        config.requireManualApproval,
        options.cachePassphrase,
        config.allowCloudForSensitive
      )
    )
  }

  listFolders(): ExposedFolder[] {
    return this.registry.listFolders()
  }

  dashboard(): DashboardSummary {
    const practices = this.registry.listFolders().map((folder) => {
      const status = this.registry.status(folder.id)
      const pendingWrites = this.registry.listPendingWrites(folder.id).length
      return {
        folderId: folder.id,
        label: status.label,
        path: folder.path,
        matter: folder.matter ?? 'altro',
        approved: status.approved,
        reviewRequired: status.reviewRequired,
        sensitiveDocs: status.sensitiveDocs,
        exposed: status.exposed,
        cloudBlockedSensitiveDocs: status.cloudBlockedSensitiveDocs,
        pendingWrites
      }
    })

    return {
      practices,
      totals: practices.reduce(
        (acc, practice) => ({
          practices: acc.practices + 1,
          approved: acc.approved + practice.approved,
          reviewRequired: acc.reviewRequired + practice.reviewRequired,
          sensitiveDocs: acc.sensitiveDocs + practice.sensitiveDocs,
          exposed: acc.exposed + practice.exposed,
          cloudBlockedSensitiveDocs:
            acc.cloudBlockedSensitiveDocs + practice.cloudBlockedSensitiveDocs,
          pendingWrites: acc.pendingWrites + practice.pendingWrites
        }),
        {
          practices: 0,
          approved: 0,
          reviewRequired: 0,
          sensitiveDocs: 0,
          exposed: 0,
          cloudBlockedSensitiveDocs: 0,
          pendingWrites: 0
        }
      )
    }
  }

  scanPractice(folderId: string): Promise<{
    scanned: number
    reviewRequired: number
    approved: number
    skipped: number
  }> {
    return this.registry.scan(folderId)
  }

  listReviewDocuments(folderId?: string): ReviewDocumentListItem[] {
    const folders = folderId ? [this.requireFolder(folderId)] : this.registry.listFolders()
    return folders.flatMap((folder) =>
      this.registry.reviewList(folder.id).map((doc) => ({
        folderId: folder.id,
        label: folder.label,
        ...doc
      }))
    )
  }

  getReviewDocument(folderId: string, docId: string): ReviewDocumentDetail | null {
    const practice = this.registry.getPractice(folderId)
    const doc = practice?.docs.get(docId)
    if (!practice || !doc?.result) return null
    const item = this.registry.reviewList(folderId).find((entry) => entry.docId === docId)
    if (!item) return null

    return {
      folderId,
      label: practice.folder.label,
      ...item,
      originalText: readFileSync(doc.filePath, 'utf8'),
      anonymizedText: doc.result.text,
      residualRisk: doc.result.residualRisk,
      entities: this.registry.getReviewQueue(folderId, docId)
    }
  }

  addManualEntity(
    folderId: string,
    docId: string,
    originalText: string,
    type: EntityType
  ): DetectedEntity | null {
    return this.registry.addManualEntity(folderId, docId, originalText, type)
  }

  applyReviewSelection(folderId: string, docId: string, entities: DetectedEntity[]): boolean {
    return this.registry.applyReviewSelection(folderId, docId, entities)
  }

  approveDocument(folderId: string, docId: string): boolean {
    return this.registry.approve(folderId, docId)
  }

  setSensitivityOverride(
    folderId: string,
    docId: string,
    decision: SensitivityOverride | null
  ): boolean {
    return this.registry.setSensitivityOverride(folderId, docId, decision)
  }

  listCloudBlockedSensitiveDocuments(): CloudBlockedSensitiveDocument[] {
    return this.registry.listCloudBlockedSensitiveDocs()
  }

  stageWrite(
    folderId: string,
    relPath: string,
    content: string,
    overwrite = false
  ): WriteOutcome {
    return this.registry.stageWrite(folderId, relPath, content, overwrite)
  }

  listPendingWrites(folderId?: string): (PendingWrite & {
    folderId: string
    label: string
    fileName: string
  })[] {
    const folders = folderId ? [this.requireFolder(folderId)] : this.registry.listFolders()
    return folders.flatMap((folder) =>
      this.registry.listPendingWrites(folder.id).map((write) => ({
        folderId: folder.id,
        label: folder.label,
        fileName: basename(write.relPath),
        ...write
      }))
    )
  }

  getPendingWrite(folderId: string, relPath: string): (PendingWrite & {
    folderId: string
    label: string
    fileName: string
    content: string
    hashMatches: boolean
  }) | null {
    const folder = this.requireFolder(folderId)
    const pending = this.registry.pendingWritePreview(folderId, relPath)
    if (!pending) return null
    return {
      folderId,
      label: folder.label,
      fileName: basename(pending.relPath),
      ...pending
    }
  }

  promoteWrite(folderId: string, relPath: string): boolean {
    return this.registry.promoteWrite(folderId, relPath)
  }

  close(): void {
    this.registry.closeIndexes()
  }

  private requireFolder(folderId: string): ExposedFolder {
    const folder = this.registry.listFolders().find((entry) => entry.id === folderId)
    if (!folder) throw new Error(`Pratica sconosciuta: ${folderId}`)
    return folder
  }
}
