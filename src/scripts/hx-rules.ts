#!/usr/bin/env node

/**
 * hx-rules.ts — 规则状态查看 / 更新 orchestrator
 *
 * view 模式：纯确定性，读取并输出规则概况，不调 AI。
 * update 模式：收集 projectFacts → 调 AI → 仅更新 hx:auto 区段，保留 hx:manual。
 */

import { existsSync, readFileSync, readdirSync } from 'fs'
import { resolve, basename } from 'path'

import { parseArgs } from './lib/config-utils.ts'
import { FRAMEWORK_ROOT, findProjectRoot, getSafeCwd } from './lib/resolve-context.ts'

const AUTO_START = '<!-- hx:auto:start -->'
const AUTO_END = '<!-- hx:auto:end -->'
const MANUAL_START = '<!-- hx:manual:start -->'
const MANUAL_END = '<!-- hx:manual:end -->'

const argv = process.argv.slice(2)
const { positional } = parseArgs(argv)
const subcommand = positional[0] ?? 'view'

if (subcommand !== 'view' && subcommand !== 'update') {
  console.error(`❌ 无效子命令 "${subcommand}"，有效值: view | update`)
  process.exit(1)
}

const projectRoot = findProjectRoot(getSafeCwd())
const hxDir = resolve(projectRoot, '.hx')
const configPath = resolve(hxDir, 'config.yaml')
const rulesDir = resolve(hxDir, 'rules')

if (subcommand === 'view') {
  runView()
} else {
  runUpdate()
}

// ── view mode ─────────────────────────────────────────────────────────────────

function runView() {
  const configExists = existsSync(configPath)
  const configContent = configExists ? readFileSync(configPath, 'utf8') : null
  const ruleFiles = listRuleFiles()

  const output = {
    ok: true,
    mode: 'view',
    config: {
      path: configPath,
      exists: configExists,
      gates: configContent ? extractGates(configContent) : null,
      paths: configContent ? extractPaths(configContent) : null,
    },
    rules: ruleFiles.map((f) => describeRuleFile(f)),
    directories: {
      commands: describeDir(resolve(hxDir, 'commands')),
      hooks: describeDir(resolve(hxDir, 'hooks')),
      pipelines: describeDir(resolve(hxDir, 'pipelines')),
    },
  }

  console.log(JSON.stringify(output, null, 2))
}

// ── update mode ───────────────────────────────────────────────────────────────

function runUpdate() {
  const projectFacts = collectProjectFacts()
  const ruleFiles = listRuleFiles()
  const templateDir = resolve(FRAMEWORK_ROOT, 'templates', 'rules')
  const templates = listTemplateFiles(templateDir)

  console.log(JSON.stringify({
    ok: true,
    actionRequired: true,
    mode: 'update',
    context: {
      projectRoot,
      projectFacts,
      configPath,
      configContent: existsSync(configPath) ? readFileSync(configPath, 'utf8') : null,
      ruleFiles: ruleFiles.map((f) => ({ path: f, content: readFileSync(f, 'utf8'), ...describeRuleFile(f) })),
      templates: templates.map((f) => ({
        name: basename(f),
        content: readFileSync(f, 'utf8'),
      })),
      blockStructure: {
        autoStart: AUTO_START,
        autoEnd: AUTO_END,
        manualStart: MANUAL_START,
        manualEnd: MANUAL_END,
        instruction: 'Only replace content between hx:auto:start and hx:auto:end. Never modify hx:manual blocks.',
      },
    },
    nextAction: 'hx rules view',
  }, null, 2))
}

// ── block-aware merge ─────────────────────────────────────────────────────────

/**
 * 替换文件中 hx:auto 区段内容，保留 hx:manual 区段不变。
 * 如果文件没有 hx:auto 块，将新内容作为 hx:auto 区插入文件头。
 */
function mergeAutoBlock(original: string, newAutoContent: string): string {
  const autoStartIdx = original.indexOf(AUTO_START)
  const autoEndIdx = original.indexOf(AUTO_END)

  if (autoStartIdx === -1 || autoEndIdx === -1) {
    // 没有 auto 块：把 manual 区提取出来，构造标准格式
    const manualBlock = extractManualBlock(original)
    return buildBlockedContent(newAutoContent, manualBlock)
  }

  const before = original.slice(0, autoStartIdx)
  const after = original.slice(autoEndIdx + AUTO_END.length)
  return `${before}${AUTO_START}\n${newAutoContent}\n${AUTO_END}${after}`
}

function extractManualBlock(content: string): string {
  const start = content.indexOf(MANUAL_START)
  const end = content.indexOf(MANUAL_END)
  if (start === -1 || end === -1) return ''
  return content.slice(start + MANUAL_START.length, end).trim()
}

function buildBlockedContent(autoContent: string, manualContent: string): string {
  const manualSection =
    manualContent
      ? `\n\n${MANUAL_START}\n${manualContent}\n${MANUAL_END}`
      : `\n\n${MANUAL_START}\n<!-- 团队可在这里补充长期有效的项目规则。 -->\n${MANUAL_END}`
  return `${AUTO_START}\n${autoContent}\n${AUTO_END}${manualSection}\n`
}

// ── project facts ─────────────────────────────────────────────────────────────

function collectProjectFacts(): Record<string, unknown> {
  const facts: Record<string, unknown> = {}

  // package.json
  const pkgPath = resolve(projectRoot, 'package.json')
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
      facts.packageName = pkg.name
      facts.packageVersion = pkg.version
      facts.scripts = pkg.scripts ?? {}
      facts.dependencies = Object.keys(pkg.dependencies ?? {})
      facts.devDependencies = Object.keys(pkg.devDependencies ?? {})
    } catch {
      /* ignore */
    }
  }

  // tsconfig.json
  facts.hasTypeScript = existsSync(resolve(projectRoot, 'tsconfig.json'))

  // source dirs
  facts.srcExists = existsSync(resolve(projectRoot, 'src'))
  facts.docsExists = existsSync(resolve(projectRoot, 'docs'))
  facts.testsExists = existsSync(resolve(projectRoot, 'tests'))

  // existing .hx config
  if (existsSync(configPath)) {
    const content = readFileSync(configPath, 'utf8')
    facts.existingGates = extractGates(content)
    facts.existingPaths = extractPaths(content)
  }

  return facts
}

// ── yaml helpers ──────────────────────────────────────────────────────────────

function extractGates(content: string): Record<string, string> {
  const result: Record<string, string> = {}
  const match = content.match(/^gates:\s*\n((?:[ \t]+\S[^\n]*\n?)*)/m)
  if (!match) return result
  for (const line of match[1].split('\n')) {
    const m = line.match(/^\s+(lint|build|type|test):\s*(.*)/)
    if (m) result[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2').trim()
  }
  return result
}

function extractPaths(content: string): Record<string, string> {
  const result: Record<string, string> = {}
  const match = content.match(/^paths:\s*\n((?:[ \t]+\S[^\n]*\n?)*)/m)
  if (!match) return result
  for (const line of match[1].split('\n')) {
    const m = line.match(/^\s+(\w+):\s*(.*)/)
    if (m) result[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2').trim()
  }
  return result
}

// ── file helpers ──────────────────────────────────────────────────────────────

function listRuleFiles(): string[] {
  if (!existsSync(rulesDir)) return []
  return readdirSync(rulesDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => resolve(rulesDir, f))
}

function listTemplateFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => resolve(dir, f))
}

function describeRuleFile(filePath: string): {
  name: string
  path: string
  hasAutoBlock: boolean
  hasManualBlock: boolean
  manualContentEmpty: boolean
} {
  const content = readFileSync(filePath, 'utf8')
  const hasAuto = content.includes(AUTO_START)
  const hasManual = content.includes(MANUAL_START)
  const manualContent = extractManualBlock(content)
  return {
    name: basename(filePath),
    path: filePath,
    hasAutoBlock: hasAuto,
    hasManualBlock: hasManual,
    manualContentEmpty: !manualContent || manualContent.startsWith('<!-- '),
  }
}

function describeDir(dirPath: string): { exists: boolean; files: string[] } {
  if (!existsSync(dirPath)) return { exists: false, files: [] }
  return {
    exists: true,
    files: readdirSync(dirPath).filter((f) => !f.startsWith('.')),
  }
}
