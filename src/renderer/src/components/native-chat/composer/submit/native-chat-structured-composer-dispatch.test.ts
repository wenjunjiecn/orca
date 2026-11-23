import { describe, expect, it, vi } from 'vitest'
import { structuredSlashCommands } from '../../../../../../shared/agent-session/view/structured-agent-session-slash-menu'
import { dispatchNativeChatStructuredComposerText } from './native-chat-structured-composer-dispatch'

function dshComposer() {
  const send = vi.fn(() => true)
  const dispatchCommand = vi.fn(async () => ({ handled: false, accepted: false, error: null }))
  return {
    send,
    submit: (text: string) =>
      dispatchNativeChatStructuredComposerText(
        { send, dispatchCommand },
        text,
        [],
        [],
        {},
        undefined,
        'dsh'
      )
  }
}

describe('DSH structured composer', () => {
  it('offers goal and plan alongside the session option controls', () => {
    expect(structuredSlashCommands([], 'dsh').map(({ name }) => name)).toEqual([
      'model',
      'effort',
      'goal',
      'plan'
    ])
  })

  it('sends goal and plan as instructions and passes a DSH skill invocation verbatim', async () => {
    const { send, submit } = dshComposer()
    await submit('/goal repair the tests')
    await submit('/plan repair the tests')
    await submit('/review-guide inspect the tests')
    await submit('/constructor inspect the tests')
    expect(send.mock.calls).toEqual([
      [
        expect.stringContaining(
          'State success criteria, then carry out the task and report the result:\n\nrepair the tests'
        ),
        []
      ],
      [
        expect.stringContaining(
          'wait for my confirmation before implementing it:\n\nrepair the tests'
        ),
        []
      ],
      ['/review-guide inspect the tests', []],
      ['/constructor inspect the tests', []]
    ])
  })

  it('keeps an empty shortcut in the composer without submitting it', async () => {
    const { send, submit } = dshComposer()
    await expect(submit('/plan')).resolves.toMatchObject({
      accepted: false,
      error: 'Describe the task after /plan.'
    })
    expect(send).not.toHaveBeenCalled()
  })
})
