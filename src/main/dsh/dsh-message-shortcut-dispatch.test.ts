import { describe, expect, it } from 'vitest'
import type { AgentJournalMessageItem } from '../../shared/agent-session/journal/agent-session-journal-types'
import { acpDispatchPrompt } from '../acp/turns/acp-prompt-content'
import { DSH_LAUNCH_SPEC } from './dsh-acp-launch-spec'

const session = {
  spec: DSH_LAUNCH_SPEC,
  connection: { initialize: async () => ({ protocolVersion: 1 }) },
  cwd: '/workspace/project'
}

function message(
  text: string,
  skills: AgentJournalMessageItem['skills'] = []
): AgentJournalMessageItem {
  return { kind: 'message', role: 'user', blocks: [{ type: 'text', text }], skills }
}

describe('DSH message shortcuts at dispatch', () => {
  it('expands goal and plan for every client and passes skill commands verbatim', async () => {
    expect(await acpDispatchPrompt(message('/goal repair the tests'), session)).toEqual([
      {
        type: 'text',
        text: 'Work toward the following goal. State success criteria, then carry out the task and report the result:\n\nrepair the tests'
      }
    ])
    expect(await acpDispatchPrompt(message('/PLAN repair the tests'), session)).toEqual([
      {
        type: 'text',
        text: 'Create a plan for the following task. Explain the steps and wait for my confirmation before implementing it:\n\nrepair the tests'
      }
    ])
    expect(await acpDispatchPrompt(message('/review-guide inspect'), session)).toEqual([
      { type: 'text', text: '/review-guide inspect' }
    ])
  })

  it('lets a picked skill of the same name keep its own command', async () => {
    const picked = message('/plan the release', [
      { name: 'plan', path: '/workspace/project/.dsh/skills/plan/SKILL.md' }
    ])
    expect(await acpDispatchPrompt(picked, session)).toEqual([
      { type: 'text', text: '/plan the release' }
    ])
  })

  it('refuses a shortcut without its task instead of sending the bare command', async () => {
    expect(Array.isArray(await acpDispatchPrompt(message('/goal'), session))).toBe(false)
  })
})
