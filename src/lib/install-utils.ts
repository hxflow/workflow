import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'fs'
import { basename, resolve } from 'path'

export const SUPPORTED_AGENTS = ['claude', 'agents']
export const BUILTIN_CLI_COMMANDS = ['setup', 'migrate', 'upgrade', 'uninstall', 'version']
const TEMPLATE_CACHE = new Map<string, string>()

export function getAgentSkillDir(agent: string) {
  return agent === 'claude' ? '.claude/skills' : '.agents/skills'
}

export function resolveAgentTargets(agentOption: string | boolean | undefined) {
  if (!agentOption || agentOption === true || agentOption === 'all') {
    return [...SUPPORTED_AGENTS]
  }

  const agents = String(agentOption)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  if (agents.includes('all')) {
    return [...SUPPORTED_AGENTS]
  }

  const invalid = agents.filter((agent) => !SUPPORTED_AGENTS.includes(agent))
  if (invalid.length > 0) {
    throw new Error(`无效的 agent: ${invalid.join(', ')}。可用值: ${SUPPORTED_AGENTS.join(', ')}, all`)
  }

  return [...new Set(agents)]
}

export function loadCommandSpecs(sourceDir: string) {
  if (!existsSync(sourceDir)) {
    return []
  }

  return readdirSync(sourceDir)
    .filter((file) => file.startsWith('hx-') && file.endsWith('.md'))
    .sort()
    .map((file) => {
      const commandName = file.replace(/\.md$/, '')
      const raw = readFileSync(resolve(sourceDir, file), 'utf8')
      const metadata = parseCommandFrontmatter(raw)

      return {
        name: metadata.name || commandName,
        description: metadata.description || commandName,
      }
    })
}

// ── skill 入口生成 ────────────────────────────────────────────────────────────

/**
 * 在 targetDir 中为 specs 里的每个命令生成 skill 入口。
 * Skill 入口直接指向框架层命令文件，不做三层查找。
 */
export function generateSkillFilesForAgent(
  agent: string,
  specs: Array<{ name: string; description: string }>,
  targetDir: string,
  frameworkRoot: string,
  summary: { created: string[]; updated: string[]; removed: string[]; skipped: string[]; warnings: string[] },
  opts: { createDir?: boolean; dryRun?: boolean } = {},
) {
  const { createDir = false, dryRun = false } = opts
  const skillDirLabel = `~/${getAgentSkillDir(agent)}/`

  if (specs.length === 0) {
    summary.warnings.push(`未发现可安装 workflow skill，跳过 ${agent} skill 生成`)
    return
  }

  if (!existsSync(targetDir)) {
    if (createDir) {
      if (!dryRun) mkdirSync(targetDir, { recursive: true })
    } else {
      summary.warnings.push(`${skillDirLabel} 目录不存在，请重新安装包或运行 hx setup`)
      return
    }
  }

  pruneStaleSkills(specs, targetDir, skillDirLabel, summary, dryRun)

  for (const spec of specs) {
    const skillDir = resolve(targetDir, spec.name)
    const dstPath = resolve(skillDir, 'SKILL.md')
    const label = `${skillDirLabel}${spec.name}/SKILL.md`
    const content = buildSkillContent(spec, frameworkRoot)
    const existing = existsSync(dstPath) ? readFileSync(dstPath, 'utf8') : null

    if (existing === content) {
      summary.skipped.push(`${label} (无变化)`)
      continue
    }

    if (!dryRun) {
      mkdirSync(skillDir, { recursive: true })
      writeFileSync(dstPath, content, 'utf8')
    }
    summary[existing ? 'updated' : 'created'].push(label)
  }
}

function pruneStaleSkills(
  specs: Array<{ name: string }>,
  targetDir: string,
  skillDirLabel: string,
  summary: { removed: string[] },
  dryRun: boolean,
) {
  if (!existsSync(targetDir)) return

  const activeNames = new Set(specs.map((s) => s.name))
  const existing = readdirSync(targetDir)
    .filter((entry) => entry.startsWith('hx-'))
    .map((entry) => resolve(targetDir, entry))
    .filter((p) => { try { return statSync(p).isDirectory() } catch { return false } })

  for (const entryPath of existing) {
    const name = basename(entryPath)
    if (activeNames.has(name)) continue

    const markerPath = resolve(entryPath, 'SKILL.md')
    if (!existsSync(markerPath)) continue
    try {
      if (!readFileSync(markerPath, 'utf8').includes('hx-skill:')) continue
    } catch { continue }

    if (!dryRun) rmSync(entryPath, { recursive: true, force: true })
    summary.removed.push(`${skillDirLabel}${name}/`)
  }
}

function buildSkillContent(
  spec: { name: string; description: string },
  frameworkRoot: string,
): string {
  const template = loadSkillTemplate(frameworkRoot)
  return renderTemplate(template, {
    name: spec.name,
    description: spec.description,
    runtimePath: resolve(frameworkRoot, 'contracts', 'runtime-contract.md'),
    commandPath: resolve(frameworkRoot, 'commands', `${spec.name}.md`),
  })
}

function loadSkillTemplate(frameworkRoot: string): string {
  const templatePath = resolve(frameworkRoot, 'templates', 'skill.md')

  if (!TEMPLATE_CACHE.has(templatePath)) {
    TEMPLATE_CACHE.set(templatePath, readFileSync(templatePath, 'utf8'))
  }

  return TEMPLATE_CACHE.get(templatePath)!
}

function parseCommandFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/)
  if (!match) return {}

  return match[1]
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce((metadata: Record<string, string>, line) => {
      const separator = line.indexOf(':')
      if (separator === -1) return metadata
      const key = line.slice(0, separator).trim()
      let value = line.slice(separator + 1).trim()
      value = value.replace(/^['"]|['"]$/g, '')
      metadata[key] = value
      return metadata
    }, {})
}

function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? '')
}
