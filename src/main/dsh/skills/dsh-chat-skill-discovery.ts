import { homedir } from 'node:os'
import { join } from 'node:path'
import type { AgentSessionRecord } from '../../../shared/agent-session/lifecycle/agent-session-record'
import type {
  SkillDiscoveryResult,
  SkillDiscoveryTarget
} from '../../../shared/skills/discovery/skills'
import { isLegacyAgentSessionAccountHome } from '../../../shared/agent-session/lifecycle/accounts/agent-session-account-home'
import { resolveStructuredEnvAccountHomePath } from '../../runtime/agent-session/environment/structured-agent-account-home'
import { agentSessionPinnedLaunchDirectory } from '../../runtime/agent-session/records/agent-session-record-launch-directory'
import { discoverDshSkills } from './dsh-skill-discovery'

/** A DSH chat with a pinned DSH_HOME on this host, whose folders this process can read. */
export function isNativeDshChatRecord(record: AgentSessionRecord): boolean {
  return (
    record.provider === 'dsh' &&
    isLegacyAgentSessionAccountHome(record.accountHome) &&
    record.accountHome.variable === 'DSH_HOME' &&
    record.location.executionHostId === 'local' &&
    !record.location.wslDistro
  )
}

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
    !isNativeDshChatRecord(record) ||
    !isLegacyAgentSessionAccountHome(record.accountHome)
  ) {
    throw new Error('DSH skill discovery requires a native DSH chat with a pinned DSH_HOME.')
  }
  const cwd =
    agentSessionPinnedLaunchDirectory(record) ??
    (await input.resolveWorkspacePath(record.location.workspaceId))
  if (!cwd) {
    throw new Error('DSH skill discovery is waiting for the chat workspace.')
  }
  return filterDshSkills(
    await discoverDshSkills({
      cwd,
      dshHome: record.accountHome.path,
      agentsHome: dshAgentsHome(input.launchEnv),
      home: homedir(),
      ...(input.signal ? { signal: input.signal } : {})
    }),
    input
  )
}

/** Before a chat starts nothing is pinned, so read the home its first launch will use. */
export async function discoverDshLaunchSkills(input: {
  cwd: string
  launchEnv: NodeJS.ProcessEnv
  signal?: AbortSignal
  names?: SkillDiscoveryTarget['names']
  sourceKinds?: SkillDiscoveryTarget['sourceKinds']
}) {
  return filterDshSkills(
    await discoverDshSkills({
      cwd: input.cwd,
      dshHome: resolveStructuredEnvAccountHomePath({
        launchEnv: input.launchEnv,
        variable: 'DSH_HOME',
        defaultPath: (home) => join(home, '.dsh')
      }),
      agentsHome: dshAgentsHome(input.launchEnv),
      home: homedir(),
      ...(input.signal ? { signal: input.signal } : {})
    }),
    input
  )
}

function dshAgentsHome(launchEnv: NodeJS.ProcessEnv): string {
  return resolveStructuredEnvAccountHomePath({
    launchEnv,
    variable: 'DSH_AGENTS_HOME',
    defaultPath: (home) => join(home, '.agents')
  })
}

function filterDshSkills(
  result: SkillDiscoveryResult,
  filter: Pick<SkillDiscoveryTarget, 'names' | 'sourceKinds'>
): SkillDiscoveryResult {
  return {
    ...result,
    skills: result.skills.filter(
      (skill) =>
        (!filter.names?.length ||
          filter.names.some((name) => name.toLowerCase() === skill.name.toLowerCase())) &&
        (!filter.sourceKinds?.length || filter.sourceKinds.includes(skill.sourceKind))
    )
  }
}
