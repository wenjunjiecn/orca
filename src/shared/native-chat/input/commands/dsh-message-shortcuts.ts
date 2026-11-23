const DSH_MESSAGE_SHORTCUT_PROMPTS = new Map([
  [
    'goal',
    'Work toward the following goal. State success criteria, then carry out the task and report the result:'
  ],
  [
    'plan',
    'Create a plan for the following task. Explain the steps and wait for my confirmation before implementing it:'
  ]
])

export type DshMessageShortcut =
  | { kind: 'expanded'; text: string }
  | { kind: 'missingArgument'; command: string }

/** Orca's `/goal` and `/plan` message shortcuts; a picked skill of the same name keeps its own command. */
export function readDshMessageShortcut(
  text: string,
  pickedSkillNames: readonly string[] = []
): DshMessageShortcut | null {
  const match = /^\/(\S+)(?:\s+([\s\S]*))?$/.exec(text.trim())
  const command = match?.[1]?.toLowerCase()
  const prompt = command ? DSH_MESSAGE_SHORTCUT_PROMPTS.get(command) : undefined
  if (!command || !prompt || pickedSkillNames.some((name) => name.toLowerCase() === command)) {
    return null
  }
  const argument = match?.[2]?.trim()
  return argument
    ? { kind: 'expanded', text: `${prompt}\n\n${argument}` }
    : { kind: 'missingArgument', command }
}
