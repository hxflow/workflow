#!/usr/bin/env node

/**
 * hx upgrade — 升级已安装的 Harness Workflow
 *
 * 行为：
 *   1. git pull 更新系统层（框架 repo 自身）
 *   2. 重新生成 agent 适配产物（Claude 转发器 / Codex skill bundle）
 *   3. 更新当前项目 CLAUDE.md 中的 harness 标记块（如在项目中运行）
 *
 * 三层架构升级原则：
 *   系统层  git pull（本命令负责）
 *   用户层  ~/.hx/commands/ 用户自己维护，upgrade 不动
 *   项目层  .hx/commands/ 项目自己维护，upgrade 不动
 *
 * 幂等设计：重复运行安全。
 */

import { execSync } from 'child_process'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { resolve } from 'path'

import { FRAMEWORK_ROOT, USER_HX_DIR, findProjectRoot } from './lib/resolve-context.js'
import { parseArgs, parseSimpleYaml } from './lib/profile-utils.js'
import {
  DEFAULT_PLAN_DOC,
  DEFAULT_REQUIREMENT_DOC,
  HARNESS_MARKER_START,
  HARNESS_MARKER_END,
  buildHarnessBlock,
  escapeRegExp,
  generateCodexSkillFiles,
  generateForwarderFiles,
  resolveAgentTargets,
} from './lib/install-utils.js'

// ── CLI 参数 ──

const { options } = parseArgs(process.argv.slice(2))

if (options.help) {
  console.log(`
  用法: hx upgrade [--agent <claude|codex|all>] [--dry-run]

  更新框架到最新版：
    1. git pull 更新系统层（框架 repo）
    2. 重新生成 agent 适配产物
    3. 更新当前项目 CLAUDE.md 中的 harness 标记块

  用户层 (~/.hx/commands/) 和项目层 (.hx/commands/) 不会被修改。

  选项:
        --agent <name>  更新目标 agent，支持 claude、codex、all（默认 all）
        --dry-run       仅显示将要更新的内容，不实际写入
    -h, --help          显示帮助
  `)
  process.exit(0)
}

const dryRun = options['dry-run'] === true
const agents = resolveAgentTargets(options.agent)
const userClaudeDir = options['user-claude-dir']
  ? resolve(options['user-claude-dir'])
  : resolve(homedir(), '.claude')
const userCodexDir = options['user-codex-dir']
  ? resolve(options['user-codex-dir'])
  : resolve(homedir(), '.codex')
const summary = { created: [], updated: [], skipped: [], warnings: [] }

console.log(`\n  Harness Workflow · upgrade${dryRun ? ' (dry-run)' : ''}`)
console.log(`  系统层: ${FRAMEWORK_ROOT}\n`)

// ── Step 1: git pull 更新系统层 ──

console.log('  Step 1: 更新系统层 (git pull)...')
try {
  if (!dryRun) {
    const output = execSync('git pull', { cwd: FRAMEWORK_ROOT, encoding: 'utf8' })
    const line = output.trim().split('\n').pop()
    summary.updated.push(`系统层 (${line})`)
  } else {
    summary.updated.push('系统层 (dry-run，跳过 git pull)')
  }
} catch (err) {
  summary.warnings.push(`git pull 失败: ${err.message.split('\n')[0]}`)
}

// ── Step 2: 重新生成 agent 适配产物 ──

console.log(`  Step 2: 重新生成 agent 适配产物 (${agents.join(', ')})...`)
const commandSourceDir = resolve(FRAMEWORK_ROOT, 'agents', 'commands')

if (agents.includes('claude')) {
  generateForwarderFiles(
    commandSourceDir,
    resolve(userClaudeDir, 'commands'),
    FRAMEWORK_ROOT,
    USER_HX_DIR,
    summary,
    { dryRun }
  )
}

if (agents.includes('codex')) {
  generateCodexSkillFiles(
    commandSourceDir,
    resolve(userCodexDir, 'skills', 'hxflow'),
    FRAMEWORK_ROOT,
    USER_HX_DIR,
    summary,
    { createDir: true, dryRun }
  )
}

// ── Step 3: 更新 CLAUDE.md 标记块（如在项目中运行）──

console.log('  Step 3: 更新 CLAUDE.md 标记块...')
const projectRoot = findProjectRoot(process.cwd())
upgradeCLAUDEmd(projectRoot, summary)

// ── 输出报告 ──

console.log('\n  ── 升级报告 ──\n')

if (summary.updated.length) {
  console.log('  更新:')
  for (const item of summary.updated) console.log(`    ~ ${item}`)
}

if (summary.skipped.length) {
  console.log('  跳过:')
  for (const item of summary.skipped) console.log(`    - ${item}`)
}

if (summary.warnings.length) {
  console.log('  警告:')
  for (const item of summary.warnings) console.log(`    ! ${item}`)
}

console.log(`\n  ${dryRun ? '[dry-run] 未实际写入。' : '完成。'}\n`)

// ── 函数 ──

function upgradeCLAUDEmd(projectRoot, summary) {
  const claudePath = resolve(projectRoot, 'CLAUDE.md')

  if (!existsSync(claudePath)) {
    summary.skipped.push('CLAUDE.md (不在项目中，跳过)')
    return
  }

  const content = readFileSync(claudePath, 'utf8')

  if (!content.includes(HARNESS_MARKER_START)) {
    summary.warnings.push('CLAUDE.md 中未找到 harness 标记块，跳过（可运行 hx init 重新安装）')
    return
  }

  const configPath = resolve(projectRoot, '.hx', 'config.yaml')
  let profile = 'base'
  let requirementDoc = DEFAULT_REQUIREMENT_DOC
  let planDoc = DEFAULT_PLAN_DOC

  if (existsSync(configPath)) {
    try {
      const config = parseSimpleYaml(readFileSync(configPath, 'utf8'))
      profile = config.defaultProfile || profile
      requirementDoc = config.paths?.requirementDoc || requirementDoc
      planDoc = config.paths?.planDoc || planDoc
    } catch (err) {
      summary.warnings.push(`.hx/config.yaml 解析失败，使用默认 CLAUDE 标记块: ${err.message}`)
    }
  } else {
    const profileMatch = content.match(/Profile: `([^`]+)`/)
    profile = profileMatch?.[1] || profile
  }

  const newBlock = buildHarnessBlock(profile, { requirementDoc, planDoc })
  const currentBlock = content.match(
    new RegExp(`${escapeRegExp(HARNESS_MARKER_START)}[\\s\\S]*?${escapeRegExp(HARNESS_MARKER_END)}`)
  )?.[0]

  if (currentBlock === newBlock) {
    summary.skipped.push('CLAUDE.md (标记块无变化)')
    return
  }

  if (!dryRun) {
    const updated = content.replace(
      new RegExp(`${escapeRegExp(HARNESS_MARKER_START)}[\\s\\S]*?${escapeRegExp(HARNESS_MARKER_END)}`),
      newBlock
    )
    writeFileSync(claudePath, updated)
  }

  summary.updated.push('CLAUDE.md (harness 标记块)')
}
