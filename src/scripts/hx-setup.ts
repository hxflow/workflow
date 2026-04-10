#!/usr/bin/env bun

/** hx setup 只负责创建 ~/.hx 目录骨架、写 ~/.hx/settings.yaml，并生成 skill 入口。 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { resolve } from 'path'

import { FRAMEWORK_ROOT, PACKAGE_ROOT } from './lib/resolve-context.ts'
import {
  parseArgs,
  readTopLevelYamlScalar,
  upsertTopLevelYamlScalar,
} from './lib/config-utils.ts'
import {
  generateSkillFilesForAgent,
  getAgentSkillDir,
  loadCommandSpecs,
  mergeCommandSpecs,
  resolveAgentTargets,
  SUPPORTED_AGENTS,
} from './lib/install-utils.ts'

const USER_LAYER_DIRS = ['commands', 'hooks', 'pipelines']
const USER_SETTINGS_FILE = 'settings.yaml'
const { options } = parseArgs(process.argv.slice(2))

await main()

function main() {
  if (options.help) {
    console.log(buildHelpText())
    process.exit(0)
  }

  const dryRun = options['dry-run'] === true
  const userHxDir = options['user-hx-dir']
    ? resolve(options['user-hx-dir'])
    : resolve(homedir(), '.hx')
  const existingSettingsPath = resolve(userHxDir, USER_SETTINGS_FILE)
  const existingSettings = existsSync(existingSettingsPath) ? readFileSync(existingSettingsPath, 'utf8') : ''
  const targets = resolveSetupAgents({ optionAgent: options.agent })
  const agentHomes = Object.fromEntries(
    SUPPORTED_AGENTS.map((agent) => {
      const target = resolveTargetDir(agent)
      return [agent, target]
    })
  )

  const summary = { created: [], updated: [], removed: [], skipped: [], warnings: [] }

  printSetupHeader({ targets, dryRun, userHxDir, agentHomes })

  ensureUserLayerDirectories(userHxDir, summary, dryRun)
  ensureUserSettingsFile(userHxDir, existingSettings, summary, dryRun)

  const frameworkCommandDir = resolve(FRAMEWORK_ROOT, 'commands')
  const userCommandDir = resolve(userHxDir, 'commands')
  const commandSpecs = mergeCommandSpecs(
    loadCommandSpecs(frameworkCommandDir),
    loadCommandSpecs(userCommandDir)
  )

  for (const agent of targets) {
    generateSkillFilesForAgent(
      agent,
      commandSpecs,
      agentHomes[agent],
      FRAMEWORK_ROOT,
      userHxDir,
      summary,
      { createDir: true, dryRun }
    )
  }

  printSummary(summary, dryRun)
}

function resolveSetupAgents({ optionAgent }) {
  if (optionAgent) {
    return resolveAgentTargets(optionAgent)
  }

  return resolveAgentTargets('all')
}

function resolveTargetDir(agent) {
  if (agent === 'claude') {
    return options['user-claude-dir']
      ? resolve(options['user-claude-dir'], 'skills')
      : resolve(homedir(), getAgentSkillDir('claude'))
  }

  const sharedOverride = options['user-agents-dir']

  return sharedOverride
    ? resolve(sharedOverride, 'skills')
    : resolve(homedir(), getAgentSkillDir('agents'))
}

function ensureUserLayerDirectories(userHxDir, summary, dryRun) {
  for (const sub of ['', ...USER_LAYER_DIRS]) {
    const dir = sub ? resolve(userHxDir, sub) : userHxDir
    if (!existsSync(dir)) {
      if (!dryRun) mkdirSync(dir, { recursive: true })
      summary.created.push(`~/.hx/${sub || ''}`.replace(/\/$/, '') + '/')
    }
  }
}

function ensureUserSettingsFile(userHxDir, previousContent, summary, dryRun) {
  const userSettingsPath = resolve(userHxDir, USER_SETTINGS_FILE)
  const settingsContent = buildUserSettingsContent()

  if (!existsSync(userSettingsPath)) {
    if (!dryRun) writeFileSync(userSettingsPath, settingsContent, 'utf8')
    summary.created.push('~/.hx/settings.yaml')
    return
  }

  const existingFrameworkRoot = readTopLevelYamlScalar(previousContent, 'frameworkRoot')
  if (existingFrameworkRoot === PACKAGE_ROOT && !previousContent.includes('\nagents:')) {
    summary.skipped.push('~/.hx/settings.yaml (已存在)')
    return
  }

  let nextContent = upsertTopLevelYamlScalar(previousContent, 'frameworkRoot', PACKAGE_ROOT)
  nextContent = nextContent.replace(/^agents:.*\n?/m, '')
  if (!nextContent.endsWith('\n')) nextContent += '\n'
  if (!dryRun) writeFileSync(userSettingsPath, nextContent, 'utf8')
  summary.updated.push('~/.hx/settings.yaml (frameworkRoot)')
}

function buildUserSettingsContent() {
  return [
    '# Harness Workflow 用户级配置',
    `frameworkRoot: ${PACKAGE_ROOT}`,
    '',
  ].join('\n')
}

function printSetupHeader({ targets, dryRun, userHxDir, agentHomes }) {
  const lines = [
    `\n  Harness Workflow · setup${dryRun ? ' (dry-run)' : ''}`,
    `  targets     → ${targets.join(', ')}`,
    `  ~/.hx/      → ${userHxDir}`,
  ]

  for (const agent of targets) {
    lines.push(`  ${agent.padEnd(11)}→ ${agentHomes[agent]}`)
  }

  for (const line of lines) console.log(line)
  console.log('')
}

function printSummary(summary, dryRun) {
  console.log('  ── 安装报告 ──\n')
  for (const [title, items, marker] of [
    ['创建', summary.created, '+'],
    ['更新', summary.updated, '~'],
    ['删除', summary.removed, 'x'],
    ['跳过', summary.skipped, '-'],
    ['警告', summary.warnings, '!'],
  ]) {
    if (items.length === 0) continue
    console.log(`  ${title}:`)
    for (const item of items) console.log(`    ${marker} ${item}`)
  }
  console.log(`\n  ${dryRun ? '[dry-run] 未实际写入。' : '完成。后续请在 Agent 会话中运行 hx-init。'}\n`)
}

function buildHelpText() {
  return `
  用法: hx setup [--dry-run] [--agent <claude|agents|all>]

  选项:
        --agent <name>  可选，仅安装 claude、agents 或 all（默认）
        --user-claude-dir <dir>
                        覆盖 Claude Code 的安装根目录
        --user-agents-dir <dir>
                        覆盖通用 agent 的安装根目录
        --dry-run       仅显示将要安装的内容，不实际写入
    -h, --help          显示帮助

  将框架文件安装到用户全局目录：
    ~/.hx/              用户层目录骨架（commands/、hooks/、pipelines/）
    ~/.hx/settings.yaml 用户级配置（记录 frameworkRoot）
    ~/.claude/skills/   Claude skill 目录（默认）
    ~/.agents/skills/   其他 agent 共用的 skill 目录（默认）

  hx setup 用于首次安装、手动修复、补装或重跑安装逻辑。

  注意：不会把框架内置 skill、Hook、Pipeline 复制到 ~/.hx/ 下。
  hx setup 会安装同一套 workflow skill 到 ~/.claude/skills/ 与 ~/.agents/skills/。
  业务侧自定义 skill 仍由用户自行管理。

  安装后，在 Agent 会话中运行 hx-init 初始化项目。
  `
}
