import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'

// ── CLAUDE.md 标记块 ──────────────────────────────────────────────────────────

export const HARNESS_MARKER_START = '<!-- hxflow:start -->'
export const HARNESS_MARKER_END = '<!-- hxflow:end -->'
export const SUPPORTED_AGENTS = ['claude', 'codex']
export const DEFAULT_REQUIREMENT_DOC = 'docs/requirement/{feature}.md'
export const DEFAULT_PLAN_DOC = 'docs/plans/{feature}.md'

export function buildHarnessBlock(profile, opts = {}) {
  const requirementDir = extractTemplateDir(
    opts.requirementDoc || DEFAULT_REQUIREMENT_DOC,
    'docs/requirement/'
  )
  const planDir = extractTemplateDir(
    opts.planDoc || DEFAULT_PLAN_DOC,
    'docs/plans/'
  )

  return `${HARNESS_MARKER_START}
## Harness Workflow

本项目已启用 Harness Workflow Framework。

- 配置: \`.hx/config.yaml\`
- Profile: \`${profile}\`
- 需求文档: \`${requirementDir}\`
- 执行计划: \`${planDir}\`

标准命令: \`hx-go\` \`hx-doc\` \`hx-plan\` \`hx-run\` \`hx-review\` \`hx-qa\` \`hx-clean\` \`hx-mr\`

- Claude: 使用 \`/hx-*\`
- Codex: 使用 \`hx-*\`
${HARNESS_MARKER_END}`
}

function extractTemplateDir(template, fallback) {
  if (typeof template !== 'string' || template.trim() === '') {
    return fallback
  }

  const normalized = template.replace(/\\/g, '/')
  const lastSlash = normalized.lastIndexOf('/')
  if (lastSlash === -1) {
    return normalized
  }

  return normalized.slice(0, lastSlash + 1)
}

export function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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
        description: metadata.description || (FORWARDER_DESCRIPTIONS[commandName] ?? commandName),
        usage: metadata.usage || commandName,
        claude: metadata.claude || `/${commandName}`,
        codex: metadata.codex || commandName,
        protected: metadata.protected === 'true',
      }
    })
}

// ── 转发器生成 ────────────────────────────────────────────────────────────────

/**
 * 在 targetDir 中为 sourceDir 里每个 hx-*.md 命令文件生成转发器。
 *
 * 转发器不包含命令逻辑，只写三层查找路径，由 Claude 在运行时按优先级读取实体文件执行。
 * frameworkRoot 是框架安装目录的绝对路径，在 setup 时写死到转发器内容中。
 *
 * opts.createDir   true → 目标目录不存在时自动创建
 * opts.dryRun      true → 只报告，不实际写入
 */
export function generateForwarderFiles(sourceDir, targetDir, frameworkRoot, userHxDir, summary, opts = {}) {
  const { createDir = false, dryRun = false } = opts

  if (!existsSync(sourceDir)) {
    summary.warnings.push('框架命令目录不存在，跳过转发器生成')
    return
  }

  if (!existsSync(targetDir)) {
    if (createDir) {
      if (!dryRun) mkdirSync(targetDir, { recursive: true })
    } else {
      summary.warnings.push('~/.claude/commands/ 目录不存在，请先运行 hx setup')
      return
    }
  }

  const specs = loadCommandSpecs(sourceDir)

  for (const spec of specs) {
    const commandName = spec.name
    const file = `${commandName}.md`
    const dstPath = resolve(targetDir, file)
    const label = `~/.claude/commands/${file}`

    const content = buildForwarderContent(spec, frameworkRoot, userHxDir)
    const existing = existsSync(dstPath) ? readFileSync(dstPath, 'utf8') : null

    if (existing === content) {
      summary.skipped.push(`${label} (无变化)`)
      continue
    }

    if (!dryRun) writeFileSync(dstPath, content, 'utf8')
    summary[existing ? 'updated' : 'created'].push(label)
  }
}

const FORWARDER_DESCRIPTIONS = {
  'hx-go':      '全自动流水线，从需求到交付（Phase 01→08）',
  'hx-doc':     'Phase 01 · 获取需求并创建需求文档',
  'hx-plan':    'Phase 02 · 生成执行计划，拆分 TASK',
  'hx-ctx':     'Phase 03 · 当前需求执行前预检（可选诊断）',
  'hx-run':     'Phase 04 · 默认执行整个需求，按计划顺序完成所有 pending 任务',
  'hx-review':  'Phase 05 · 按团队清单审查代码',
  'hx-fix':     'Phase 05 · 按 Review 意见修复代码',
  'hx-qa':      'Phase 06 · 运行团队质量校验',
  'hx-clean':   'Phase 07 · 工程清理扫描',
  'hx-mr':      'Phase 08 · 输出 Merge Request 创建上下文',
  'hx-init':    '初始化项目，分析结构，写入 .hx/config.yaml',
  'hx-status':  '查看当前项目任务执行进度',
}

export function generateCodexSkillFiles(sourceDir, targetDir, frameworkRoot, userHxDir, summary, opts = {}) {
  const { createDir = false, dryRun = false } = opts

  if (!existsSync(sourceDir)) {
    summary.warnings.push('框架命令目录不存在，跳过 Codex skill 生成')
    return
  }

  if (!existsSync(targetDir)) {
    if (createDir) {
      if (!dryRun) mkdirSync(targetDir, { recursive: true })
    } else {
      summary.warnings.push('~/.codex/skills/ 目录不存在，请先运行 hx setup')
      return
    }
  }

  const specs = loadCommandSpecs(sourceDir)
  const files = {
    'SKILL.md': buildCodexSkillContent(specs, frameworkRoot, userHxDir),
    'commands.json': buildCodexCommandsManifest(specs, frameworkRoot, userHxDir),
  }

  for (const [fileName, content] of Object.entries(files)) {
    const dstPath = resolve(targetDir, fileName)
    const label = `~/.codex/skills/hxflow/${fileName}`
    const existing = existsSync(dstPath) ? readFileSync(dstPath, 'utf8') : null

    if (existing === content) {
      summary.skipped.push(`${label} (无变化)`)
      continue
    }

    if (!dryRun) writeFileSync(dstPath, content, 'utf8')
    summary[existing ? 'updated' : 'created'].push(label)
  }
}

function buildForwarderContent(spec, frameworkRoot, userHxDir) {
  const systemPath = resolve(frameworkRoot, 'agents', 'commands', `${spec.name}.md`)

  if (spec.protected) {
    return `---
description: ${spec.description}
---
<!-- hx-forwarder: ${spec.name} — 由 hx setup 自动生成，请勿手动修改 -->
<!-- protected: 此命令由框架锁定，不支持用户层或项目层覆盖 -->

读取 \`${systemPath}\` 的完整内容作为指令执行（$ARGUMENTS 原样透传）。

若文件不存在，报错：\`${spec.name} 命令实体文件未找到，请运行 hx setup 修复。\`
`
  }

  return `---
description: ${spec.description}
---
<!-- hx-forwarder: ${spec.name} — 由 hx setup 自动生成，请勿手动修改 -->

按以下优先级找到第一个存在的文件，读取其完整内容作为指令执行（$ARGUMENTS 原样透传）：

1. 从当前目录向上查找含 \`.hx/config.yaml\` 或 \`.git\` 的项目根目录，读取 \`<项目根>/.hx/commands/${spec.name}.md\`
2. \`${userHxDir}/commands/${spec.name}.md\`
3. \`${systemPath}\`

若三处均不存在，报错：\`${spec.name} 命令实体文件未找到，请运行 hx setup 修复。\`
`
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

function buildCodexSkillContent(specs, frameworkRoot, userHxDir) {
  const commandList = specs
    .map((spec) => `- \`${spec.codex}\` -> \`${spec.usage}\` · ${spec.description}`)
    .join('\n')

  return `---
name: hxflow
description: Execute canonical hx-* workflow commands in Codex using the same command contract as Claude.
---

# hxflow

Use this skill when the user invokes a canonical Harness Workflow command such as \`hx-init\`, \`hx-go\`, \`hx-run\`, \`hx-qa\`, or asks to use Harness Workflow in Codex.

## Command Contract

- Preserve the literal command token and trailing arguments exactly. Example: \`hx-run user-login --profile base\`
- Claude uses slash commands such as \`/hx-run\`; Codex uses the canonical command form \`hx-run\`
- Canonical command definitions live in the same markdown files used by Claude

## Resolution Order

1. Walk up from the current working directory until finding \`.hx/config.yaml\` or \`.git\`
2. If \`<projectRoot>/.hx/commands/<command>.md\` exists, read it and execute its full content as the command instruction
3. Else if \`${userHxDir}/commands/<command>.md\` exists, read it and execute its full content
4. Else read \`${frameworkRoot}/agents/commands/<command>.md\`
5. Pass the raw trailing text as \`$ARGUMENTS\`

## Available Commands

${commandList}
`
}

function buildCodexCommandsManifest(specs, frameworkRoot, userHxDir) {
  return JSON.stringify({
    name: 'hxflow',
    frameworkRoot,
    userHxDir,
    resolutionOrder: [
      '<projectRoot>/.hx/commands/<command>.md',
      `${userHxDir}/commands/<command>.md`,
      `${frameworkRoot}/agents/commands/<command>.md`,
    ],
    commands: specs,
  }, null, 2) + '\n'
}
