import { homedir } from 'node:os'
import { join } from 'node:path'
import type { AgentSessionRecord } from '../../../shared/agent-session/lifecycle/agent-session-record'
import type { SkillDiscoveryTarget } from '../../../shared/skills/discovery/skills'
import { isLegacyAgentSessionAccountHome } from '../../../shared/agent-session/lifecycle/accounts/agent-session-account-home'
import { resolveAbsoluteDirOverride } from '../../../shared/file-access/absolute-dir-override'
import { agentSessionPinnedLaunchDirectory } from '../../runtime/agent-session/records/agent-session-record-launch-directory'
import { discoverDshSkills } from './dsh-skill-discovery'

export async function discoverDshChatSkills(input: {
  record: AgentSessionRecord | null
  resolveWorkspacePath: (workspaceId: string) => Promise<string | null>
  launchEnv: NodeJS.ProcessEnv
  signal?: AbortSignal
  names?: SkillDiscoveryTarget['names']
  sourceKinds?: SkillDiscoveryTarget['sourceKinds']
}) {
  const { record } = input
  if (
    !record ||
    record.provider !== 'dsh' ||
    !isLegacyAgentSessionAccountHome(record.accountHome) ||
    record.accountHome.variable !== 'DSH_HOME'
  ) {
    throw new Error('DSH skill discovery requires a chat with a pinned DSH_HOME.')
  }
  if (record.location.executionHostId !== 'local' || record.location.wslDistro) {
    throw new Error('DSH skill discovery must run on the native execution host.')
  }
  const cwd =
    agentSessionPinnedLaunchDirectory(record) ??
    (await input.resolveWorkspacePath(record.location.workspaceId))
  if (!cwd) {
    throw new Error('DSH skill discovery is waiting for the chat workspace.')
  }
  const result = await discoverDshSkills({
    cwd,
    dshHome: record.accountHome.path,
    agentsHome: resolveAbsoluteDirOverride(
      input.launchEnv.DSH_AGENTS_HOME ?? process.env.DSH_AGENTS_HOME,
      join(homedir(), '.agents')
    ),
    ...(input.signal ? { signal: input.signal } : {})
  })
  return {
    ...result,
    skills: result.skills.filter(
      (skill) =>
        (!input.names?.length ||
          input.names.some((name) => name.toLowerCase() === skill.name.toLowerCase())) &&
        (!input.sourceKinds?.length || input.sourceKinds.includes(skill.sourceKind))
    )
  }
}
