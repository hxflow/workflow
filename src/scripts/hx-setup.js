#!/usr/bin/env node

/**
 * hx setup — 全局安装框架文件到用户目录
 *
 * 安装内容：
 *   1. ~/.hx/ 目录结构（commands/、profiles/、pipelines/）
 *   2. ~/.hx/config.yaml（写入 frameworkRoot，如不存在）
 *   3. Agent 适配层：
 *      - ~/.claude/commands/ — Claude 转发器
 *      - ~/.codex/skills/hxflow/ — Codex skill bundle
 *
 * 三层架构：
 *   系统层  <frameworkRoot>/src/agents/commands/   命令实体（git pull 升级）
 *   用户层  ~/.hx/commands/                        用户自定义覆盖
 *   项目层  <project>/.hx/commands/                项目专属覆盖
 *
 * Claude/Codex 适配层由框架生成；业务 skill 仍由用户自行管理。
 *
 * 幂等设计：重复运行安全。
 *
 * 测试隔离参数（非正式公开）：
 *   --user-hx-dir <dir>      覆盖 ~/.hx/ 路径
 *   --user-claude-dir <dir>  覆盖 ~/.claude/ 路径
 *   --user-codex-dir <dir>   覆盖 ~/.codex/ 路径
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { parseSimpleYaml } from './lib/profile-utils.js'
import { homedir } from 'os'
import { resolve } from 'path'

import { FRAMEWORK_ROOT } from './lib/resolve-context.js'
import { parseArgs } from './lib/profile-utils.js'
import {
  generateCodexSkillFiles,
  generateForwarderFiles,
  resolveAgentTargets,
} from './lib/install-utils.js'

// ── CLI 参数 ──

const { options } = parseArgs(process.argv.slice(2))

if (options.help) {
  console.log(`
  用法: hx setup [--agent <claude|codex|all>] [--dry-run]

  选项:
        --agent <name>  安装目标 agent，支持 claude、codex、all（默认 all）
        --dry-run       仅显示将要安装的内容，不实际写入
    -h, --help          显示帮助

  将框架文件安装到用户全局目录：
    ~/.hx/              目录结构（commands/、profiles/、pipelines/）
    ~/.hx/config.yaml   用户全局配置（记录 frameworkRoot）
    ~/.claude/commands/ Claude 转发器文件（按三层优先级路由到实体命令）
    ~/.codex/skills/    Codex skill bundle（统一使用 canonical hx-* contract）

  hx setup 会安装 Claude 转发器和 Codex skill bundle。
  业务侧自定义 skill 仍由用户自行管理。

  安装后，在任意项目中运行 hx-init 初始化项目。
  `)
  process.exit(0)
}

const dryRun = options['dry-run'] === true
const agents = resolveAgentTargets(options.agent)
const userHxDir = options['user-hx-dir']
  ? resolve(options['user-hx-dir'])
  : resolve(homedir(), '.hx')
const userClaudeDir = options['user-claude-dir']
  ? resolve(options['user-claude-dir'])
  : resolve(homedir(), '.claude')
const userCodexDir = options['user-codex-dir']
  ? resolve(options['user-codex-dir'])
  : resolve(homedir(), '.codex')

const summary = { created: [], updated: [], skipped: [], warnings: [] }

console.log(`\n  Harness Workflow · setup${dryRun ? ' (dry-run)' : ''}`)
console.log(`  agents      → ${agents.join(', ')}`)
console.log(`  ~/.hx/      → ${userHxDir}`)
if (agents.includes('claude')) console.log(`  ~/.claude/  → ${userClaudeDir}`)
if (agents.includes('codex')) console.log(`  ~/.codex/   → ${userCodexDir}`)
console.log('')

// ── Step 1: 创建 ~/.hx/ 目录结构 ──

for (const sub of ['', 'commands', 'profiles', 'pipelines']) {
  const dir = sub ? resolve(userHxDir, sub) : userHxDir
  if (!existsSync(dir)) {
    if (!dryRun) mkdirSync(dir, { recursive: true })
    summary.created.push(`~/.hx/${sub || ''}`.replace(/\/$/, '') + '/')
  }
}

// ── Step 2: 创建 ~/.hx/config.yaml（写入 frameworkRoot）──

const userConfigPath = resolve(userHxDir, 'config.yaml')
if (!existsSync(userConfigPath)) {
  if (!dryRun) writeFileSync(userConfigPath, `# Harness Workflow 用户全局配置\nframeworkRoot: ${FRAMEWORK_ROOT}\n`, 'utf8')
  summary.created.push('~/.hx/config.yaml')
} else {
  // 确保 frameworkRoot 字段是最新的
  try {
    const existing = parseSimpleYaml(readFileSync(userConfigPath, 'utf8'))
    if (existing.frameworkRoot !== FRAMEWORK_ROOT) {
      const updated = readFileSync(userConfigPath, 'utf8').replace(
        /^frameworkRoot:.*$/m,
        `frameworkRoot: ${FRAMEWORK_ROOT}`
      )
      if (!dryRun) writeFileSync(userConfigPath, updated, 'utf8')
      summary.updated.push('~/.hx/config.yaml (frameworkRoot)')
    } else {
      summary.skipped.push('~/.hx/config.yaml (已存在)')
    }
  } catch {
    summary.warnings.push('~/.hx/config.yaml 解析失败，跳过 frameworkRoot 写入')
  }
}

// ── Step 3: 生成 agent 适配层 ──

const commandSourceDir = resolve(FRAMEWORK_ROOT, 'agents', 'commands')

if (agents.includes('claude')) {
  generateForwarderFiles(
    commandSourceDir,
    resolve(userClaudeDir, 'commands'),
    FRAMEWORK_ROOT,
    userHxDir,
    summary,
    { createDir: true, dryRun }
  )
}

if (agents.includes('codex')) {
  generateCodexSkillFiles(
    commandSourceDir,
    resolve(userCodexDir, 'skills', 'hxflow'),
    FRAMEWORK_ROOT,
    userHxDir,
    summary,
    { createDir: true, dryRun }
  )
}

// ── 输出报告 ──

console.log('  ── 安装报告 ──\n')

if (summary.created.length > 0) {
  console.log('  创建:')
  for (const item of summary.created) console.log(`    + ${item}`)
}

if (summary.updated.length > 0) {
  console.log('  更新:')
  for (const item of summary.updated) console.log(`    ~ ${item}`)
}

if (summary.skipped.length > 0) {
  console.log('  跳过:')
  for (const item of summary.skipped) console.log(`    - ${item}`)
}

if (summary.warnings.length > 0) {
  console.log('  警告:')
  for (const item of summary.warnings) console.log(`    ! ${item}`)
}

console.log(`\n  ${dryRun ? '[dry-run] 未实际写入。' : '完成。运行 hx-init 初始化项目。'}\n`)
