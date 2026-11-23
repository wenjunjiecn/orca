import { open, readdir, realpath, stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import type {
  DiscoveredSkill,
  SkillDiscoveryResult,
  SkillDiscoverySource
} from '../../../shared/skills/discovery/skills'
import { runSkillCandidateTasks } from '../../skills/filesystem/skill-candidate-concurrency'
import { stablePathId } from '../../skills/discovery/skill-discovery-classification'
import { readDshSkillMetadata } from './dsh-skill-metadata'

const MAX_SKILL_BYTES = 256 * 1024
type DshRoot = { path: string; sourceKind: 'home' | 'repo'; label: string; skipSystem?: boolean }
type DshSkill = DiscoveredSkill & { userInvocable: boolean }

function missing(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error.code === 'ENOENT' || error.code === 'ENOTDIR')
  )
}

/** One unreadable path must not hide every other skill; only aborts stop the scan. */
function unreadable(error: unknown): boolean {
  return error instanceof Error && 'code' in error && typeof error.code === 'string'
}

// A dotfiles repository at the home directory is not the chat's project.
async function projectRoot(cwd: string, home: string, signal?: AbortSignal): Promise<string> {
  const start = resolve(cwd)
  const samePath = (left: string, right: string) =>
    process.platform === 'win32' ? left.toLowerCase() === right.toLowerCase() : left === right
  for (let current = start; !samePath(current, home); current = dirname(current)) {
    signal?.throwIfAborted()
    try {
      await stat(join(current, '.git'))
      return current
    } catch (error) {
      if (!unreadable(error)) {
        throw error
      }
    }
    if (dirname(current) === current) {
      break
    }
  }
  return start
}

async function readSkill(
  path: string,
  root: DshRoot,
  signal?: AbortSignal
): Promise<DshSkill | null> {
  signal?.throwIfAborted()
  try {
    const info = await stat(path)
    if (!info.isFile() || info.size > MAX_SKILL_BYTES) {
      return null
    }
    const file = await open(path, 'r')
    let markdown: string
    try {
      const buffer = Buffer.alloc(Math.min(info.size, MAX_SKILL_BYTES))
      const read = await file.read(buffer, 0, buffer.length, 0)
      markdown = buffer.toString('utf8', 0, read.bytesRead)
    } finally {
      await file.close()
    }
    signal?.throwIfAborted()
    const metadata = readDshSkillMetadata(markdown)
    if (!metadata) {
      return null
    }
    const canonical = await realpath(path)
    return {
      id: stablePathId(canonical),
      ...metadata,
      providers: ['agent-skills'],
      sourceKind: root.sourceKind,
      sourceLabel: root.label,
      rootPath: root.path,
      directoryPath: dirname(path),
      skillFilePath: canonical,
      installed: true,
      updatedAt: info.mtimeMs
    }
  } catch (error) {
    if (unreadable(error)) {
      return null
    }
    throw error
  }
}

/** DSH's default filesystem roots only; ACP does not expose custom or runtime provider catalogs. */
export async function discoverDshSkills(input: {
  cwd: string
  dshHome: string
  agentsHome: string
  /** The user's home directory; it never counts as the project root. */
  home: string
  signal?: AbortSignal
}): Promise<SkillDiscoveryResult> {
  const project = await projectRoot(input.cwd, resolve(input.home), input.signal)
  const roots: DshRoot[] = [
    { path: join(project, '.dsh', 'skills'), sourceKind: 'repo', label: 'DSH project' },
    { path: join(project, '.agents', 'skills'), sourceKind: 'repo', label: 'Project agent skills' },
    {
      path: join(input.dshHome, 'skills'),
      sourceKind: 'home',
      label: 'DSH home',
      skipSystem: true
    },
    { path: join(input.agentsHome, 'skills'), sourceKind: 'home', label: 'Agent skills home' }
  ]
  const sources: SkillDiscoverySource[] = []
  const byName = new Map<string, DshSkill>()
  for (const root of roots) {
    input.signal?.throwIfAborted()
    let skippedReason: SkillDiscoverySource['skippedReason']
    let paths: string[] = []
    try {
      const entries = await readdir(root.path, { withFileTypes: true })
      paths = entries
        .filter((entry) => !(root.skipSystem && entry.name === '.system'))
        .sort((left, right) => left.name.localeCompare(right.name))
        .flatMap((entry) => {
          const path = join(root.path, entry.name)
          if (entry.name.endsWith('.md') && (entry.isFile() || entry.isSymbolicLink())) {
            return [path]
          }
          return entry.isDirectory() || entry.isSymbolicLink() ? [join(path, 'SKILL.md')] : []
        })
    } catch (error) {
      if (!unreadable(error)) {
        throw error
      }
      skippedReason = missing(error) ? 'missing' : 'unavailable'
    }
    sources.push({
      id: `dsh-${stablePathId(root.path)}`,
      label: root.label,
      path: root.path,
      sourceKind: root.sourceKind,
      providers: ['agent-skills'],
      owner: 'dsh',
      exists: skippedReason !== 'missing',
      ...(skippedReason ? { skippedReason } : {})
    })
    const skills = await runSkillCandidateTasks(
      paths.map((path) => () => readSkill(path, root, input.signal))
    )
    for (const skill of skills) {
      if (skill && !byName.has(skill.name)) {
        byName.set(skill.name, skill)
      }
    }
  }
  return {
    skills: [...byName.values()]
      .filter((skill) => skill.userInvocable)
      .map(({ userInvocable: _policy, ...skill }) => skill),
    sources,
    scannedAt: Date.now()
  }
}
