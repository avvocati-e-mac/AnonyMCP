import { z } from 'zod'

export const IPC_CHANNELS = {
  APP_STATUS: 'app:status'
} as const

export const AppStatusSchema = z.object({
  configPresent: z.boolean(),
  configuredFolders: z.number().int().nonnegative(),
  mcpReady: z.boolean(),
  configError: z.string().optional()
}).strict()

export type AppStatus = z.infer<typeof AppStatusSchema>

export interface AnonymcpElectronApi {
  getAppStatus: () => Promise<AppStatus>
}
