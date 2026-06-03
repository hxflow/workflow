#!/usr/bin/env bun
/**
 * hx-init.ts — 项目初始化 orchestrator
 *
 * 幂等：完整已初始化 → no-op；部分缺失 → 仅补全缺失部分。
 * 确定性工作：检测初始化状态、写 .hx/config.yaml 和规则模板。
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs'
import { resolve } from 'path'

import { parse as parseYaml, parseDocument } from 'yaml'

import { FRAMEWORK_ROOT } from '../lib/resolve-context.ts'
import type { InitCandidate } from '../lib/init-target-resolver.ts'
import { resolveInitTarget } from '../lib/init-target-resolver.ts'
import { createSimpleContext } from '../lib/tool-cli.ts'

const { cwd, positional, options } = createSimpleContext()
const initTarget = resolveInitTarget(cwd, positional, options)
const projectRoot = initTarget.root
const hxDir = resolve(projectRoot, '.hx')
const configPath = resolve(hxDir, 'config.yaml')
const workspacePath = resolve(hxDir, 'workspace.yaml')
const rulesDir = resolve(hxDir, 'rules')
const pipelinesDir = resolve(hxDir, 'pipelines')
const hooksDir = resolve(hxDir, 'hooks')
const frameworkRulesDir = resolve(FRAMEWORK_ROOT, 'templates', 'rules')
const frameworkPipelinesDir = resolve(FRAMEWORK_ROOT, 'templates', 'pipelines')
const frameworkConfigTemplate = resolve(FRAMEWORK_ROOT, 'templates', 'config.yaml')
const DEFAULT_PIPELINE_REGISTRATION = 'default: .hx/pipelines/default.yaml'
const REQUIRED_AGENT_HOOK_FILES = [
  'hxflow-guard-write-claude.ts',
  'hxflow-guard-write-codex.ts',
]

if (initTarget.mode === 'workspace') {
  initWorkspace()
  process.exit(0)
}

// ── 1. 检测初始化状态 ─────────────────────────────────────────────────────────

const REQUIRED_RULE_FILES = listFrameworkRuleFiles(frameworkRulesDir)
const REQUIRED_PIPELINE_FILES = listFrameworkPipelineFiles(frameworkPipelinesDir)
const initStatus = detectInitStatus()

if (initStatus.complete) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        status: 'complete',
        mode: 'project',
        projectRoot,
        message: '当前项目已完整初始化，无需再次执行 hx-init。',
        missing: [],
        nextAction: 'hx doc <feature>',
      },
      null,
      2,
    ),
  )
  process.exit(0)
}

// ── 2. 配置模板（纯模板复制，无需 AI）────────────────────────────────────────
const written: string[] = []

mkdirSync(hxDir, { recursive: true })

if (!existsSync(configPath) && existsSync(frameworkConfigTemplate)) {
  writeFileSync(configPath, readFileSync(frameworkConfigTemplate, 'utf8'), 'utf8')
  written.push(configPath)
}

if (existsSync(configPath) && ensureDefaultPipelineRegistration(configPath)) {
  written.push(configPath)
}

// ── 3. 规则模板（纯模板复制，无需 AI）────────────────────────────────────────

mkdirSync(rulesDir, { recursive: true })

for (const file of REQUIRED_RULE_FILES) {
  const dest = resolve(rulesDir, file)
  const src = resolve(frameworkRulesDir, file)
  if (!existsSync(dest) && existsSync(src)) {
    writeFileSync(dest, readFileSync(src, 'utf8'), 'utf8')
    written.push(dest)
  }
}

mkdirSync(pipelinesDir, { recursive: true })

for (const file of REQUIRED_PIPELINE_FILES) {
  const dest = resolve(pipelinesDir, file)
  const src = resolve(frameworkPipelinesDir, file)
  if (!existsSync(dest) && existsSync(src)) {
    writeFileSync(dest, readFileSync(src, 'utf8'), 'utf8')
    written.push(dest)
  }
}

installAgentHooks(projectRoot, written)

console.log(JSON.stringify({
  ok: true,
  status: written.length > 0 ? 'initialized' : 'complete',
  mode: 'project',
  projectRoot,
  missing: [],
  written,
  nextAction: 'hx doc <feature>',
}, null, 2))

// ── helpers ───────────────────────────────────────────────────────────────────

interface InitStatus {
  complete: boolean
  missing: string[]
}

function detectInitStatus(): InitStatus {
  const missing: string[] = []

  if (!existsSync(configPath)) missing.push('config')
  if (existsSync(configPath) && !hasDefaultPipelineRegistration(readFileSync(configPath, 'utf8'))) {
    missing.push('runtime.pipelines.default')
  }

  for (const rf of REQUIRED_RULE_FILES) {
    if (!existsSync(resolve(rulesDir, rf))) missing.push(`rules/${rf}`)
  }

  for (const pf of REQUIRED_PIPELINE_FILES) {
    if (!existsSync(resolve(pipelinesDir, pf))) missing.push(`pipelines/${pf}`)
  }

  for (const hookFile of REQUIRED_AGENT_HOOK_FILES) {
    if (!existsSync(resolve(hooksDir, hookFile))) missing.push(`hooks/${hookFile}`)
  }

  if (!existsSync(resolve(projectRoot, '.claude', 'settings.json'))) missing.push('.claude/settings.json')
  if (!existsSync(resolve(projectRoot, '.codex', 'hooks.json'))) missing.push('.codex/hooks.json')

  return { complete: missing.length === 0, missing }
}

function listFrameworkRuleFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .sort()
}

function listFrameworkPipelineFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.yaml'))
    .sort()
}

function hasDefaultPipelineRegistration(content: string): boolean {
  const doc = parseYaml(content) as Record<string, unknown> | null
  const pipelines = (doc?.runtime as Record<string, unknown> | undefined)?.pipelines
  return typeof pipelines === 'object' && pipelines !== null && 'default' in pipelines
}

function ensureDefaultPipelineRegistration(filePath: string): boolean {
  const content = readFileSync(filePath, 'utf8')
  if (hasDefaultPipelineRegistration(content)) return false

  const updated = addDefaultPipelineRegistration(content)
  if (updated === content) return false

  writeFileSync(filePath, updated, 'utf8')
  return true
}

function addDefaultPipelineRegistration(content: string): string {
  const doc = parseDocument(content)

  if (!doc.has('runtime')) {
    doc.set('runtime', {
      budget: { maxStepAttempts: 3, maxReworkCycles: 2 },
      hooks: {},
      pipelines: { default: '.hx/pipelines/default.yaml' },
    })
  } else {
    const pipelines = doc.getIn(['runtime', 'pipelines'])
    if (pipelines === null || pipelines === undefined) {
      doc.setIn(['runtime', 'pipelines'], { default: '.hx/pipelines/default.yaml' })
    } else {
      doc.setIn(['runtime', 'pipelines', 'default'], '.hx/pipelines/default.yaml')
    }
  }

  return doc.toString()
}

function initWorkspace(): void {
  mkdirSync(hxDir, { recursive: true })

  const written: string[] = []
  if (!existsSync(workspacePath)) {
    writeFileSync(workspacePath, buildWorkspaceYaml(initTarget.candidates), 'utf8')
    written.push(workspacePath)
  }

  if (existsSync(workspacePath) && ensureDefaultPipelineRegistration(workspacePath)) {
    written.push(workspacePath)
  }

  mkdirSync(rulesDir, { recursive: true })
  for (const file of listFrameworkRuleFiles(frameworkRulesDir)) {
    const dest = resolve(rulesDir, file)
    const src = resolve(frameworkRulesDir, file)
    if (!existsSync(dest) && existsSync(src)) {
      writeFileSync(dest, readFileSync(src, 'utf8'), 'utf8')
      written.push(dest)
    }
  }

  mkdirSync(pipelinesDir, { recursive: true })
  for (const file of listFrameworkPipelineFiles(frameworkPipelinesDir)) {
    const dest = resolve(pipelinesDir, file)
    const src = resolve(frameworkPipelinesDir, file)
    if (!existsSync(dest) && existsSync(src)) {
      writeFileSync(dest, readFileSync(src, 'utf8'), 'utf8')
      written.push(dest)
    }
  }

  installAgentHooks(projectRoot, written)

  console.log(JSON.stringify({
    ok: true,
    status: written.length > 0 ? 'initialized' : 'complete',
    mode: 'workspace',
    workspaceRoot: projectRoot,
    projects: initTarget.candidates,
    written,
    nextAction: 'hx doc <feature>',
  }, null, 2))
}

function buildWorkspaceYaml(candidates: InitCandidate[]): string {
  const projectLines = candidates.flatMap((candidate) => [
    `  - id: ${candidate.id}`,
    `    path: ./${candidate.relativePath}`,
    `    type: ${candidate.type}`,
  ])

  return [
    'version: 1',
    '',
    'workspace:',
    '  name: workspace',
    '',
    'paths:',
    '  requirementDoc: docs/requirement/{feature}.md',
    '  planDoc: docs/plans/{feature}.md',
    '  progressFile: docs/plans/{feature}-progress.json',
    '',
    'gates:',
    '  lint:',
    '  build:',
    '  type:',
    '  test:',
    '',
    'runtime:',
    '  # 自动流水线预算。留空表示不启用该停止条件。',
    '  budget:',
    '    maxStepAttempts: 3',
    '    maxReworkCycles: 2',
    '  # 命令级 hook。pre 在命令执行前注入，post 在命令执行后注入。',
    '  # 示例：',
    '  #   hooks:',
    '  #     doc:',
    '  #       pre:',
    '  #         - .hx/hooks/pre_doc.md',
    '  #       post:',
    '  #         - .hx/hooks/post_doc.md',
    '  hooks: {}',
    '  pipelines:',
    '    default: .hx/pipelines/default.yaml',
    '',
    'rules:',
    '  templates:',
    '    requirement: .hx/rules/requirement-template.md',
    '    plan: .hx/rules/plan-template.md',
    '    bugfixRequirement: .hx/rules/bugfix-requirement-template.md',
    '    bugfixPlan: .hx/rules/bugfix-plan-template.md',
    '',
    candidates.length > 0 ? 'projects:' : 'projects: []',
    ...(candidates.length > 0 ? projectLines : []),
    '',
  ].join('\n')
}

function installAgentHooks(root: string, written: string[]): void {
  const targetHooksDir = resolve(root, '.hx', 'hooks')
  mkdirSync(targetHooksDir, { recursive: true })

  writeIfMissing(resolve(targetHooksDir, 'hxflow-guard-write-claude.ts'), buildClaudeGuardHook(), written)
  writeIfMissing(resolve(targetHooksDir, 'hxflow-guard-write-codex.ts'), buildCodexGuardHook(), written)

  const claudeDir = resolve(root, '.claude')
  mkdirSync(claudeDir, { recursive: true })
  writeIfMissing(resolve(claudeDir, 'settings.json'), buildClaudeSettings(), written)

  const codexDir = resolve(root, '.codex')
  mkdirSync(codexDir, { recursive: true })
  writeIfMissing(resolve(codexDir, 'hooks.json'), buildCodexHooks(), written)
}

function writeIfMissing(filePath: string, content: string, written: string[]): void {
  if (existsSync(filePath)) return
  writeFileSync(filePath, content, 'utf8')
  written.push(filePath)
}

function buildClaudeGuardHook(): string {
  return `#!/usr/bin/env bun

import { spawnSync } from 'node:child_process'

const payload = await new Response(Bun.stdin).text()
const input = payload ? JSON.parse(payload) as Record<string, unknown> : {}
const toolName = typeof input.tool_name === 'string' ? input.tool_name : ''

if (!['Edit', 'Write', 'MultiEdit'].includes(toolName)) process.exit(0)

const toolInput = typeof input.tool_input === 'object' && input.tool_input !== null
  ? input.tool_input as Record<string, unknown>
  : {}
const filePath = typeof toolInput.file_path === 'string' ? toolInput.file_path : ''

if (!filePath) process.exit(0)

const result = spawnSync('hx-hook', ['guard-write', filePath], {
  cwd: process.env.CLAUDE_PROJECT_DIR || process.cwd(),
  encoding: 'utf8',
  env: process.env,
})

if (result.status === 0) process.exit(0)

process.stderr.write(result.stderr || result.stdout || 'hxflow guard-write failed\\n')
process.exit(2)
`
}

function buildCodexGuardHook(): string {
  return `#!/usr/bin/env bun

import { spawnSync } from 'node:child_process'

const payload = await new Response(Bun.stdin).text()
const input = payload ? JSON.parse(payload) as Record<string, unknown> : {}
const toolName = typeof input.tool_name === 'string' ? input.tool_name : ''

if (toolName !== 'apply_patch') process.exit(0)

const toolInput = typeof input.tool_input === 'object' && input.tool_input !== null
  ? input.tool_input as Record<string, unknown>
  : {}
const patch = typeof toolInput.command === 'string'
  ? toolInput.command
  : typeof toolInput.patch === 'string'
    ? toolInput.patch
    : ''

const paths = patch
  .split('\\n')
  .map((line) => line.match(/^\\*\\*\\* (?:Add|Update|Delete) File: (.+)$/)?.[1] ?? line.match(/^\\*\\*\\* Move to: (.+)$/)?.[1] ?? '')
  .filter((path) => path.length > 0)

if (paths.length === 0) process.exit(0)

const result = spawnSync('hx-hook', ['guard-write', ...paths], {
  cwd: process.cwd(),
  encoding: 'utf8',
  env: process.env,
})

if (result.status === 0) process.exit(0)

process.stderr.write(result.stderr || result.stdout || 'hxflow guard-write failed\\n')
process.exit(2)
`
}

function buildClaudeSettings(): string {
  return `${JSON.stringify({
    hooks: {
      PreToolUse: [
        {
          matcher: 'Edit|Write|MultiEdit',
          hooks: [
            {
              type: 'command',
              command: 'bun "$CLAUDE_PROJECT_DIR/.hx/hooks/hxflow-guard-write-claude.ts"',
            },
          ],
        },
      ],
    },
  }, null, 2)}
`
}

function buildCodexHooks(): string {
  return `${JSON.stringify({
    hooks: {
      PreToolUse: [
        {
          matcher: 'apply_patch',
          hooks: [
            {
              type: 'command',
              command: 'bun .hx/hooks/hxflow-guard-write-codex.ts',
            },
          ],
        },
      ],
    },
  }, null, 2)}
`
}
