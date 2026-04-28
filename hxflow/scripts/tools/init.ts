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
const frameworkRulesDir = resolve(FRAMEWORK_ROOT, 'templates', 'rules')
const frameworkPipelinesDir = resolve(FRAMEWORK_ROOT, 'templates', 'pipelines')
const frameworkConfigTemplate = resolve(FRAMEWORK_ROOT, 'templates', 'config.yaml')
const DEFAULT_PIPELINE_REGISTRATION = 'default: .hx/pipelines/default.yaml'

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
    doc.set('runtime', { hooks: {}, pipelines: { default: '.hx/pipelines/default.yaml' } })
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
