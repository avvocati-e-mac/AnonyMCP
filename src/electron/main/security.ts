export interface TrustedRendererOptions {
  isDev: boolean
  devUrl?: string
  rendererFileUrl: string
}

export function isTrustedRendererUrl(url: string, options: TrustedRendererOptions): boolean {
  if (options.isDev) {
    if (!options.devUrl) return false
    try {
      const expected = new URL(options.devUrl)
      const actual = new URL(url)
      return actual.origin === expected.origin
    } catch {
      return false
    }
  }
  return url === options.rendererFileUrl || url.startsWith(`${options.rendererFileUrl}#`)
}

export function rendererConsoleLogPayload(args: unknown[]): { argCount: number } {
  return { argCount: args.length }
}
