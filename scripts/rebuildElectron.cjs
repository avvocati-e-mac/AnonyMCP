#!/usr/bin/env node
// ============================================================
// Ricompila better-sqlite3 per l'ABI di Electron (gap M6/M7, ROADMAP-fase2).
//
// Due insidie scoperte sul campo (collaudo 2026-06-11):
// 1. `electron-builder install-app-deps` può risultare un no-op silenzioso e
//    lasciare il binario con ABI Node: l'app parte ma FTS5 degrada in silenzio.
//    Serve `electron-rebuild --force`.
// 2. Su macOS arm64 il binario ricompilato ha una firma ad-hoc non valida per
//    dyld dentro Electron: il processo muore con SIGKILL "Code Signature
//    Invalid" senza alcun errore JS. Va ri-firmato ad-hoc dopo il rebuild.
// Il percorso inverso (Electron → Node) è `npm run rebuild:node` o il guard
// `pretest` (scripts/ensureNodeSqlite.cjs).
// ============================================================

'use strict'

const { spawnSync } = require('node:child_process')
const { join } = require('node:path')

const projectRoot = join(__dirname, '..')

function run(cmd, args) {
  const res = spawnSync(cmd, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  })
  if (res.status !== 0) {
    console.error(`[rebuildElectron] comando fallito: ${cmd} ${args.join(' ')}`)
    process.exit(res.status ?? 1)
  }
}

run('npx', ['electron-rebuild', '-f', '-w', 'better-sqlite3'])

if (process.platform === 'darwin') {
  run('codesign', [
    '--force',
    '--sign',
    '-',
    join(projectRoot, 'node_modules/better-sqlite3/build/Release/better_sqlite3.node')
  ])
}

console.error('[rebuildElectron] better-sqlite3 pronto per Electron (FTS5 inclusa).')
