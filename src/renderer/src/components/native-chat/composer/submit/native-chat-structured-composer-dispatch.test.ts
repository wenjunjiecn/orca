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

  it('hands goal to the host as typed so the transcript keeps what was sent', async () => {
    const { send, submit } = dshComposer()
    await submit('/goal repair the tests')
    expect(send.mock.calls).toEqual([['/goal repair the tests', []]])
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
