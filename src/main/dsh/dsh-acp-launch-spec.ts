import { join } from 'node:path'
import { GENERIC_ACP_DIALECT } from '../acp/acp-dialects/acp-dialect'
import { directoryAccountBinding } from '../acp/launch/acp-account-binding'
import type { AcpLaunchSpec } from '../acp/launch/acp-launch-contract'

export const DSH_LAUNCH_SPEC: AcpLaunchSpec = {
  agent: 'dsh',
  command: 'dsh',
  // The terminal Command setting can name dsh-tui, which cannot serve ACP.
  ignoreAgentCommandSetting: true,
  args: () => ['--profile', 'acp'],
  env: {},
  dialect: GENERIC_ACP_DIALECT,
  loginCommand: [],
  account: directoryAccountBinding('DSH_HOME', (homePath) => join(homePath, '.dsh')),
  installDirectories: () => [],
  modelDiscovery: {
    kind: 'unavailable',
    reason: 'DSH reports models through the running chat session'
  },
  transcriptImport: null,
  sessionHistory: {
    rowAgents: [],
    rowSessionId: (link) => link.handle.nativeId,
    parseResumeArgs: () => null
  },
  // DSH has no session/delete; a naming task would leave a session in its history.
  keepsEverySession: true
}
