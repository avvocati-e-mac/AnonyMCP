import { describe, it, expect, afterEach } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LocalReviewService } from '../src/app/reviewService.js'
import type { AnonyMcpConfig } from '../src/types.js'

let dirs: string[] = []

function serviceWithTmp(): { service: LocalReviewService; dir: string } {
  const dir = mkdtempSync(join(tmpdir(), 'anonymcp-review-service-write-'))
  dirs.push(dir)
  const config: AnonyMcpConfig = {
    version: 1,
    folders: [{ id: '400f', label: '400F', path: dir }],
    requireManualApproval: true,
    allowCloudForSensitive: false,
    logLevel: 'info'
  }
  return { service: LocalReviewService.fromConfig(config), dir }
}

afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true })
  dirs = []
})

describe('LocalReviewService pending write', () => {
  it('mostra preview locale e promuove la bozza finale', () => {
    const { service, dir } = serviceWithTmp()
    service.stageWrite('400f', 'Ricerche/bozza.md', 'Contenuto re-idratato.')

    const [pending] = service.listPendingWrites()
    expect(pending!.relPath).toBe(join('Ricerche', 'bozza.md'))

    const detail = service.getPendingWrite('400f', pending!.relPath)
    expect(detail!.content).toBe('Contenuto re-idratato.')
    expect(detail!.hashMatches).toBe(true)

    expect(service.promoteWrite('400f', pending!.relPath)).toBe(true)
    expect(existsSync(join(dir, 'Ricerche/bozza.md'))).toBe(true)
    expect(readFileSync(join(dir, 'Ricerche/bozza.md'), 'utf8')).toBe('Contenuto re-idratato.')
    expect(service.listPendingWrites()).toHaveLength(0)
    service.close()
  })
})
