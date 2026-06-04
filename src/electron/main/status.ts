import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export type ConfigSource = 'ANONYMCP_CONFIG' | 'appUserData'
export type ClientConfigStatus = 'uses_env_config' | 'not_verifiable' | 'diverged'

export interface ConfigLinkStatus {
  configSource: ConfigSource
  serverEnvConfigPath?: string
  serverEnvConfigHash?: string
  configMatchesServerEnv?: boolean
  clientConfigStatus: ClientConfigStatus
}

export function configHash(path: string): string | undefined {
  if (!existsSync(path)) return undefined
  return createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 12)
}

export function buildConfigLinkStatus(
  activeConfigPath: string,
  activeConfigHash: string | undefined,
  envConfigPath: string | undefined
): ConfigLinkStatus {
  if (!envConfigPath) {
    return {
      configSource: 'appUserData',
      clientConfigStatus: 'not_verifiable'
    }
  }

  const serverEnvConfigPath = resolve(envConfigPath)
  const serverEnvConfigHash = configHash(serverEnvConfigPath)
  const pathsMatch = resolve(activeConfigPath) === serverEnvConfigPath
  const hashesMatch = activeConfigHash && serverEnvConfigHash
    ? activeConfigHash === serverEnvConfigHash
    : true
  const matches = pathsMatch && hashesMatch

  return {
    configSource: pathsMatch ? 'ANONYMCP_CONFIG' : 'appUserData',
    serverEnvConfigPath,
    serverEnvConfigHash,
    configMatchesServerEnv: matches,
    clientConfigStatus: matches ? 'uses_env_config' : 'diverged'
  }
}
