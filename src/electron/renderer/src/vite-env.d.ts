/// <reference types="vite/client" />

import type { AnonymcpElectronApi } from '../../shared/ipc'

declare global {
  interface Window {
    anonymcp: AnonymcpElectronApi
  }
}

export {}
