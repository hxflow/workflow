#!/usr/bin/env node

/**
 * hx-init.ts — 项目初始化 orchestrator
 *
 * 幂等：完整已初始化 → no-op；部分缺失 → 仅补全缺失部分。
 * 确定性工作：检测初始化状态、收集 projectFacts、写骨架文件、更新 AGENTS.md/CLAUDE.md 标记块。
 * AI 工作：填充 .hx/config.yaml 和规则文件中的项目特定内容。
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs'
import { resolve, basename } from 'path'

import { FRAMEWORK_ROOT, findProjectRoot, getSafeCwd } from '../lib/resolve-context.ts'

const projectRoot = findProjectRoot(getSafeCwd())
const hxDir = resolve(projectRoot, '.hx')
const configPath = resolve(hxDir, 'config.yaml')
const rulesDir = resolve(hxDir, 'rules')

// ── 1. 检测初始化状态 ─────────────────────────────────────────────────────────

const REQUIRED_RULE_FILES = ['golden-rules.md', 'review-checklist.md']
const SKELETON_DIRS = ['commands', 'hooks', 'pipelines']

const initStatus = detectInitStatus()

if (initStatus.complete) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        status: 'complete',
        message: '当前项目已完整初始化，无需再次执行 hx-init。',
        missing: [],
        nextAction: 'hx rules view',
      },
      null,
      2,
    ),
  )
  process.exit(0)
}

// ── 2. 骨架目录（纯模板复制，无需 AI）────────────────────────────────────────
const written: string[] = []

for (const dir of SKELETON_DIRS) {
  if (!initStatus.missing.includes(`skeleton/${dir}`)) continue
  const destDir = resolve(hxDir, dir)
  const srcDir = resolve(FRAMEWORK_ROOT, 'templates', 'skeleton', dir)
  mkdirSync(destDir, { recursive: true })

  if (existsSync(srcDir)) {
    for (const f of readdirSync(srcDir)) {
      const dest = resolve(destDir, f)
      if (!existsSync(dest)) {
        writeFileSync(dest, readFileSync(resolve(srcDir, f), 'utf8'), 'utf8')
        written.push(dest)
      }
    }
  } else {
    const readmePath = resolve(destDir, 'README.md')
    if (!existsSync(readmePath)) {
      writeFileSync(readmePath, `# ${dir}\n\n项目级 ${dir} 定义目录。\n`, 'utf8')
      written.push(readmePath)
    }
  }
}

// ── 3. 剩余缺失（config / rules / agents-marker）→ 输出上下文供 AI 补全 ────
const remainingMissing = initStatus.missing.filter((m) => !m.startsWith('skeleton/'))

if (remainingMissing.length === 0) {
  console.log(JSON.stringify({
    ok: true,
    status: written.length > 0 ? 'initialized' : 'complete',
    missing: [],
    written,
    nextAction: 'hx rules view',
  }, null, 2))
  process.exit(0)
}

const frameworkConfigTemplate = resolve(FRAMEWORK_ROOT, 'templates', 'config.yaml')
const frameworkRulesDir = resolve(FRAMEWORK_ROOT, 'templates', 'rules')

console.log(JSON.stringify({
  ok: true,
  status: 'partial',
  missing: remainingMissing,
  written,
  context: {
    projectRoot,
    projectFacts: collectProjectFacts(),
    configPath,
    configTemplate: existsSync(frameworkConfigTemplate) ? readFileSync(frameworkConfigTemplate, 'utf8') : null,
    existingConfig: existsSync(configPath) ? readFileSync(configPath, 'utf8') : null,
    ruleTemplates: listRuleTemplates(frameworkRulesDir),
    existingRules: listExistingRules(rulesDir),
    agentsPath: resolve(projectRoot, 'AGENTS.md'),
    agentsExists: existsSync(resolve(projectRoot, 'AGENTS.md')),
    hxflowMarker: '<!-- hxflow:start --> ... <!-- hxflow:end -->',
  },
  nextAction: 'hx init',
}, null, 2))

// ── helpers ───────────────────────────────────────────────────────────────────

interface InitStatus {
  complete: boolean
  missing: string[]
}

function detectInitStatus(): InitStatus {
  const missing: string[] = []

  if (!existsSync(configPath)) missing.push('config')

  for (const rf of REQUIRED_RULE_FILES) {
    if (!existsSync(resolve(rulesDir, rf))) missing.push(`rules/${rf}`)
  }

  for (const dir of SKELETON_DIRS) {
    if (!existsSync(resolve(hxDir, dir))) missing.push(`skeleton/${dir}`)
  }

  const agentsPath = resolve(projectRoot, 'AGENTS.md')
  const claudePath = resolve(projectRoot, 'CLAUDE.md')
  const hasMarker =
    (existsSync(agentsPath) && readFileSync(agentsPath, 'utf8').includes('<!-- hxflow:start -->')) ||
    (existsSync(claudePath) && readFileSync(claudePath, 'utf8').includes('<!-- hxflow:start -->'))
  if (!hasMarker) missing.push('agents-marker')

  return { complete: missing.length === 0, missing }
}

function collectProjectFacts(): Record<string, unknown> {
  const facts: Record<string, unknown> = { projectRoot }

  const pkgPath = resolve(projectRoot, 'package.json')
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
      facts.packageName = pkg.name
      facts.packageManager = detectPackageManager()
      facts.scripts = pkg.scripts ?? {}
      facts.hasTypeScript = existsSync(resolve(projectRoot, 'tsconfig.json'))
      facts.mainDeps = Object.keys(pkg.dependencies ?? {}).slice(0, 20)
    } catch {
      /* ignore */
    }
  }

  facts.srcPath = existsSync(resolve(projectRoot, 'src')) ? 'src' : null
  facts.docsPath = existsSync(resolve(projectRoot, 'docs')) ? 'docs' : null
  facts.testsPath =
    existsSync(resolve(projectRoot, 'tests'))
      ? 'tests'
      : existsSync(resolve(projectRoot, 'test'))
        ? 'test'
        : null

  const agentsPath = resolve(projectRoot, 'AGENTS.md')
  facts.agentsMarkerBlocks = existsSync(agentsPath)
    ? extractHxflowBlocks(readFileSync(agentsPath, 'utf8'))
    : []

  return facts
}

function detectPackageManager(): string {
  if (existsSync(resolve(projectRoot, 'bun.lock'))) return 'bun'
  if (existsSync(resolve(projectRoot, 'pnpm-lock.yaml'))) return 'pnpm'
  if (existsSync(resolve(projectRoot, 'yarn.lock'))) return 'yarn'
  return 'npm'
}

function extractHxflowBlocks(content: string): string[] {
  const blocks: string[] = []
  const re = /<!-- hxflow:start -->([\s\S]*?)<!-- hxflow:end -->/g
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) blocks.push(m[1].trim())
  return blocks
}

function listRuleTemplates(dir: string): Array<{ name: string; content: string }> {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => ({ name: f, content: readFileSync(resolve(dir, f), 'utf8') }))
}

function listExistingRules(dir: string): Array<{ name: string; content: string }> {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => ({ name: basename(f), content: readFileSync(resolve(dir, f), 'utf8') }))
}
