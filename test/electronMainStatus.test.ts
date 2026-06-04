import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildConfigLinkStatus, configHash } from '../src/electron/main/status.js'

let dirs: string[] = []

function tmp(): string {
  const dir = mkdtempSync(join(tmpdir(), 'anonymcp-electron-status-'))
  dirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
  dirs = []
})

describe('Electron app status config link', () => {
  it('se ANONYMCP_CONFIG manca dichiara il client non verificabile', () => {
    const status = buildConfigLinkStatus('/app/anonymcp.config.json', 'abc', undefined)
    expect(status.configSource).toBe('appUserData')
    expect(status.clientConfigStatus).toBe('not_verifiable')
    expect(status.configMatchesServerEnv).toBeUndefined()
  })

  it('se path e hash coincidono dichiara la config env in uso', () => {
    const dir = tmp()
    const configPath = join(dir, 'anonymcp.config.json')
    writeFileSync(configPath, '{"version":1,"folders":[]}', 'utf8')
    const hash = configHash(configPath)

    const status = buildConfigLinkStatus(configPath, hash, configPath)

    expect(status.configSource).toBe('ANONYMCP_CONFIG')
    expect(status.clientConfigStatus).toBe('uses_env_config')
    expect(status.configMatchesServerEnv).toBe(true)
    expect(status.serverEnvConfigHash).toBe(hash)
  })

  it('se path o hash divergono mostra uno stato fail-safe', () => {
    const dir = tmp()
    const appConfigPath = join(dir, 'ui.config.json')
    const envConfigPath = join(dir, 'server.config.json')
    writeFileSync(appConfigPath, '{"version":1,"folders":[]}', 'utf8')
    writeFileSync(envConfigPath, '{"version":1,"folders":[{"id":"400F"}]}', 'utf8')

    const status = buildConfigLinkStatus(appConfigPath, configHash(appConfigPath), envConfigPath)

    expect(status.configSource).toBe('appUserData')
    expect(status.clientConfigStatus).toBe('diverged')
    expect(status.configMatchesServerEnv).toBe(false)
  })
})
