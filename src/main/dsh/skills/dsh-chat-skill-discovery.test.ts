import { describe, expect, it, vi } from 'vitest'
import { agentSessionRecordFixture } from '../../../shared/agent-session/lifecycle/records/agent-session-record.test-fixture'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../shared/workspace/identity/floating-workspace-id'
import { discoverDshChatSkills } from './dsh-chat-skill-discovery'
import { discoverDshSkills } from './dsh-skill-discovery'

vi.mock('./dsh-skill-discovery', () => ({
  discoverDshSkills: vi.fn(async () => ({ skills: [], sources: [], scannedAt: 1 }))
}))

describe('DSH skill discovery account and host ownership', () => {
  it('uses the pinned home and launch directory instead of a later environment/account selection', async () => {
    const base = agentSessionRecordFixture()
    const record = {
      ...base,
      location: { ...base.location, workspaceId: FLOATING_TERMINAL_WORKTREE_ID },
      provider: 'dsh',
      accountHome: { variable: 'DSH_HOME', path: '/accounts/pinned' },
      launchDirectory: '/workspace/pinned'
    }
    await discoverDshChatSkills({
      record,
      resolveWorkspacePath: async () => '/workspace/other',
      launchEnv: { DSH_HOME: '/accounts/other' }
    })
    expect(discoverDshSkills).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: '/workspace/pinned',
        dshHome: '/accounts/pinned'
      })
    )
  })

  it('resolves a worktree or folder through the owning runtime', async () => {
    const record = {
      ...agentSessionRecordFixture(),
      provider: 'dsh',
      accountHome: { variable: 'DSH_HOME', path: '/accounts/dsh' }
    }
    const resolveWorkspacePath = vi.fn(async () => '/workspace/from-host')
    await discoverDshChatSkills({ record, resolveWorkspacePath, launchEnv: {} })
    expect(resolveWorkspacePath).toHaveBeenCalledWith('workspace-1')
    expect(discoverDshSkills).toHaveBeenCalledWith(
      expect.objectContaining({ cwd: '/workspace/from-host', dshHome: '/accounts/dsh' })
    )
  })

  it('refuses missing sessions, other agents, foreign homes, and direct SSH/WSL locations', async () => {
    const base = agentSessionRecordFixture()
    const dsh = {
      ...base,
      provider: 'dsh',
      accountHome: { variable: 'DSH_HOME', path: '/account' }
    }
    for (const record of [
      null,
      base,
      { ...dsh, accountHome: base.accountHome },
      { ...dsh, location: { ...base.location, executionHostId: 'ssh:box' as const } },
      { ...dsh, location: { ...base.location, wslDistro: 'Ubuntu' } }
    ]) {
      await expect(
        discoverDshChatSkills({
          record,
          resolveWorkspacePath: async () => '/workspace',
          launchEnv: {}
        })
      ).rejects.toThrow()
    }
  })
})
