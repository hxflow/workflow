import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'fs'
import { basename, resolve } from 'path'

export const SUPPORTED_AGENTS = ['claude', 'codex', 'cursor', 'gemini', 'kimi', 'windsurf']
export const BUILTIN_CLI_COMMANDS = ['setup', 'version']
const TEMPLATE_CACHE = new Map()

export function getAgentSkillDir(agent) {
  return `.${agent}/skills`
}

export function resolveAgentTargets(agentOption) {
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

export function loadCommandSpecs(sourceDir) {
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
        protected: metadata.protected === 'true',
      }
    })
}

export function mergeCommandSpecs(...specGroups) {
  const merged = new Map()

  for (const group of specGroups) {
    for (const spec of group) {
      const existing = merged.get(spec.name)

      if (existing?.protected) {
        continue
      }

      merged.set(spec.name, spec)
    }
  }

  return [...merged.values()].sort((left, right) => left.name.localeCompare(right.name))
}

// ── skill 入口生成 ────────────────────────────────────────────────────────────

/**
 * 在 targetDir 中为 specs 里的每个命令生成 skill 入口。
 *
 * skill 入口不包含命令逻辑，只写三层查找路径，由 Agent 在运行时按优先级读取实体文件执行。
 * frameworkRoot 是框架安装目录的绝对路径，在 setup 时写死到 skill 内容中。
 *
 * opts.createDir   true → 目标目录不存在时自动创建
 * opts.dryRun      true → 只报告，不实际写入
 */
export function generateForwarderFiles(specs, targetDir, frameworkRoot, userHxDir, summary, opts = {}) {
  return generateSkillFilesForAgent('claude', specs, targetDir, frameworkRoot, userHxDir, summary, opts)
}

export function generateSkillFilesForAgent(agent, specs, targetDir, frameworkRoot, userHxDir, summary, opts = {}) {
  const skillDirLabel = `~/${getAgentSkillDir(agent)}/`

  generateAgentArtifacts(specs, targetDir, summary, {
    ...opts,
    emptyWarning: `未发现可安装 workflow skill，跳过 ${agent} skill 生成`,
    missingTargetWarning: `${skillDirLabel} 目录不存在，请重新安装包或运行 hx setup`,
    listExistingTargets(dir) {
      return readdirSync(dir)
        .filter((entry) => entry.startsWith('hx-'))
        .map((entry) => resolve(dir, entry))
        .filter((entryPath) => {
          try {
            return statSync(entryPath).isDirectory()
          } catch {
            return false
          }
        })
        .map((entryPath) => ({
          name: basename(entryPath),
          label: `${skillDirLabel}${basename(entryPath)}/`,
          marker: 'hx-skill:',
          markerPath: resolve(entryPath, 'SKILL.md'),
          removePath: entryPath,
        }))
    },
    getTarget(spec) {
      const skillDir = resolve(targetDir, spec.name)
      return {
        dstPath: resolve(skillDir, 'SKILL.md'),
        label: `${skillDirLabel}${spec.name}/SKILL.md`,
        content: buildAgentArtifactContent(spec, frameworkRoot, userHxDir),
        beforeWrite() {
          mkdirSync(skillDir, { recursive: true })
        },
      }
    },
  })
}

export function generateClaudeSkillFiles(specs, targetDir, frameworkRoot, userHxDir, summary, opts = {}) {
  return generateSkillFilesForAgent('claude', specs, targetDir, frameworkRoot, userHxDir, summary, opts)
}

export function generateCodexSkillFiles(specs, targetDir, frameworkRoot, userHxDir, summary, opts = {}) {
  return generateSkillFilesForAgent('codex', specs, targetDir, frameworkRoot, userHxDir, summary, opts)
}

function generateAgentArtifacts(specs, targetDir, summary, options) {
  const { createDir = false, dryRun = false } = options
  if (specs.length === 0) {
    summary.warnings.push(options.emptyWarning)
    return
  }

  if (!existsSync(targetDir)) {
    if (createDir) {
      if (!dryRun) mkdirSync(targetDir, { recursive: true })
    } else {
      summary.warnings.push(options.missingTargetWarning)
      return
    }
  }

  pruneStaleAgentArtifacts(specs, targetDir, summary, options, dryRun)

  for (const spec of specs) {
    const target = options.getTarget(spec)
    const { dstPath, label, content } = target
    const existing = existsSync(dstPath) ? readFileSync(dstPath, 'utf8') : null

    if (existing === content) {
      summary.skipped.push(`${label} (无变化)`)
      continue
    }

    if (!dryRun) {
      target.beforeWrite?.()
      writeFileSync(dstPath, content, 'utf8')
    }
    summary[existing ? 'updated' : 'created'].push(label)
  }
}

function pruneStaleAgentArtifacts(specs, targetDir, summary, options, dryRun) {
  if (!options.listExistingTargets || !existsSync(targetDir)) {
    return
  }

  const activeNames = new Set(specs.map((spec) => spec.name))

  for (const target of options.listExistingTargets(targetDir)) {
    if (activeNames.has(target.name) || !isManagedArtifact(target)) {
      continue
    }

    if (!dryRun) {
      rmSync(target.removePath, { recursive: true, force: true })
    }
    summary.removed ??= []
    summary.removed.push(target.label)
  }
}

function isManagedArtifact(target) {
  if (!existsSync(target.markerPath)) {
    return false
  }

  try {
    return readFileSync(target.markerPath, 'utf8').includes(target.marker)
  } catch {
    return false
  }
}

function parseCommandFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/)
  if (!match) {
    return {}
  }

  return match[1]
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce((metadata, line) => {
      const separator = line.indexOf(':')
      if (separator === -1) {
        return metadata
      }

      const key = line.slice(0, separator).trim()
      let value = line.slice(separator + 1).trim()
      value = value.replace(/^['"]|['"]$/g, '')
      metadata[key] = value
      return metadata
    }, {})
}

function buildAgentArtifactContent(spec, frameworkRoot, userHxDir) {
  const template = loadArtifactTemplate(frameworkRoot, spec.protected)
  return renderTemplate(template, {
    name: spec.name,
    description: spec.description,
    systemPath: resolve(frameworkRoot, 'commands', `${spec.name}.md`),
    userCommandPath: resolve(userHxDir, 'commands', `${spec.name}.md`),
  })
}

function loadArtifactTemplate(frameworkRoot, isProtected) {
  const templateName = `skill-${isProtected ? 'protected' : 'layered'}.md`
  const templatePath = resolve(frameworkRoot, 'templates', 'forwarders', templateName)

  if (!TEMPLATE_CACHE.has(templatePath)) {
    TEMPLATE_CACHE.set(templatePath, readFileSync(templatePath, 'utf8'))
  }

  return TEMPLATE_CACHE.get(templatePath)
}

function renderTemplate(template, variables) {
  return template.replace(/{{(\w+)}}/g, (_, key) => variables[key] ?? '')
}
