import type { z } from 'zod'
import type { RpcContext } from '../../core'
import type { SkillDiscoveryResult } from '../../../../../shared/skills/discovery/skills'
import type { SkillsDiscoverParams } from '../../../../../shared/rpc-contract/skills/skills-params'
import type { ResolvedSkillDiscoveryTarget } from '../../../../skills/discovery/skill-discovery-target'
import { requireInstalledStructuredHost } from '../structured-sessions/creation/structured-agent-session-gate'
import {
  discoverDshChatSkills,
  discoverDshLaunchSkills,
  isNativeDshChatRecord
} from '../../../../dsh/skills/dsh-chat-skill-discovery'

type DiscoverParams = z.infer<typeof SkillsDiscoverParams>

function dshDiscoveryInput(params: DiscoverParams, { runtime, signal }: RpcContext) {
  return {
    launchEnv: runtime.getClientSettings().agentDefaultEnv?.dsh ?? {},
    ...(params.names ? { names: params.names } : {}),
    ...(params.sourceKinds ? { sourceKinds: params.sourceKinds } : {}),
    ...(signal ? { signal } : {})
  }
}

/** A running native DSH chat reads its pinned folders; any other chat gets null and the workspace roots. */
export async function discoverSkillsForDshChat(
  params: DiscoverParams,
  context: RpcContext
): Promise<SkillDiscoveryResult | null> {
  if (!params.agentSessionId) {
    return null
  }
  const host = await requireInstalledStructuredHost(context, params.agentSessionId)
  const record = host.deps.store.getRecord(params.agentSessionId)
  if (!record || !isNativeDshChatRecord(record)) {
    return null
  }
  return discoverDshChatSkills({
    record,
    resolveWorkspacePath: (workspaceId) =>
      context.runtime.resolveStructuredAgentSessionLocalWorkspacePath(`id:${workspaceId}`),
    ...dshDiscoveryInput(params, context)
  })
}

/** A DSH chat not yet started on this host reads the folders its first launch will use. */
export function discoverSkillsForDshLaunch(
  params: DiscoverParams,
  target: ResolvedSkillDiscoveryTarget,
  context: RpcContext
): Promise<SkillDiscoveryResult> | null {
  if (params.launchAgent !== 'dsh' || target.kind !== 'native-host' || !target.cwd) {
    return null
  }
  return discoverDshLaunchSkills({ cwd: target.cwd, ...dshDiscoveryInput(params, context) })
}
