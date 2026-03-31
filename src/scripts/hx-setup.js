#!/usr/bin/env node

/** hx setup 只负责创建 ~/.hx 目录骨架、写 ~/.hx/settings.yaml，并生成各 agent 的 skill 入口。 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { resolve } from 'path'
import { createInterface } from 'readline/promises'
import { stdin as input, stdout as output } from 'process'

import { FRAMEWORK_ROOT, PACKAGE_ROOT } from './lib/resolve-context.js'
import {
  parseArgs,
  readTopLevelYamlScalar,
  upsertTopLevelYamlScalar,
} from './lib/config-utils.js'
import {
  generateSkillFilesForAgent,
  getAgentSkillDir,
  loadCommandSpecs,
  mergeCommandSpecs,
  resolveAgentTargets,
  SUPPORTED_AGENTS,
} from './lib/install-utils.js'

const USER_LAYER_DIRS = ['commands', 'hooks', 'pipelines']
const USER_SETTINGS_FILE = 'settings.yaml'
const { options } = parseArgs(process.argv.slice(2))

await main()

async function main() {
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
  const configuredAgents = readTopLevelYamlScalar(existingSettings, 'agents')
  const agents = await resolveSetupAgents({ optionAgent: options.agent, configuredAgents })
  const agentHomes = Object.fromEntries(
    SUPPORTED_AGENTS.map((agent) => {
      const overrideKey = `user-${agent}-dir`
      const target = options[overrideKey]
        ? resolve(options[overrideKey], 'skills')
        : resolve(homedir(), getAgentSkillDir(agent))
      return [agent, target]
    })
  )

  const summary = { created: [], updated: [], removed: [], skipped: [], warnings: [] }

  printSetupHeader({ agents, dryRun, userHxDir, agentHomes })

  ensureUserLayerDirectories(userHxDir, summary, dryRun)
  ensureUserSettingsFile(userHxDir, agents, summary, dryRun)

  const frameworkCommandDir = resolve(FRAMEWORK_ROOT, 'commands')
  const userCommandDir = resolve(userHxDir, 'commands')
  const commandSpecs = mergeCommandSpecs(
    loadCommandSpecs(frameworkCommandDir),
    loadCommandSpecs(userCommandDir)
  )

  for (const agent of agents) {
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

async function resolveSetupAgents({ optionAgent, configuredAgents }) {
  if (optionAgent) {
    return resolveAgentTargets(optionAgent)
  }

  if (configuredAgents) {
    return resolveAgentTargets(configuredAgents)
  }

  if ((!input.isTTY || !output.isTTY) && process.env.HX_SETUP_FORCE_PROMPT !== '1') {
    return resolveAgentTargets('all')
  }

  return promptForAgents()
}

async function promptForAgents() {
  console.log('\n  请选择要安装的 agents：\n')
  SUPPORTED_AGENTS.forEach((agent, index) => {
    console.log(`  ${index + 1}. ${agent}`)
  })
  console.log('\n  输入序号或名称，多个值用逗号分隔；直接回车默认安装全部。\n')

  const rl = createInterface({ input, output })

  try {
    const answer = ((await rl.question('  > ')) || '').trim()
    if (!answer) {
      return resolveAgentTargets('all')
    }

    const resolved = answer
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        if (/^\d+$/.test(item)) {
          const index = Number(item) - 1
          const agent = SUPPORTED_AGENTS[index]
          if (!agent) {
            throw new Error(`无效的 agent 序号: ${item}`)
          }
          return agent
        }
        return item
      })

    return resolveAgentTargets(resolved.join(','))
  } catch {
    return resolveAgentTargets('all')
  } finally {
    rl.close()
  }
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

function ensureUserSettingsFile(userHxDir, agents, summary, dryRun) {
  const userSettingsPath = resolve(userHxDir, USER_SETTINGS_FILE)
  const settingsContent = buildUserSettingsContent(agents)

  if (!existsSync(userSettingsPath)) {
    if (!dryRun) writeFileSync(userSettingsPath, settingsContent, 'utf8')
    summary.created.push('~/.hx/settings.yaml')
    return
  }

  const previousContent = readFileSync(userSettingsPath, 'utf8')
  const existingFrameworkRoot = readTopLevelYamlScalar(previousContent, 'frameworkRoot')

  const existingAgents = readTopLevelYamlScalar(previousContent, 'agents')
  const nextAgents = agents.join(',')

  if (existingFrameworkRoot === PACKAGE_ROOT && existingAgents === nextAgents) {
    summary.skipped.push('~/.hx/settings.yaml (已存在)')
    return
  }

  let nextContent = upsertTopLevelYamlScalar(previousContent, 'frameworkRoot', PACKAGE_ROOT)
  nextContent = upsertTopLevelYamlScalar(nextContent, 'agents', nextAgents)
  if (!dryRun) writeFileSync(userSettingsPath, nextContent, 'utf8')
  summary.updated.push('~/.hx/settings.yaml (frameworkRoot / agents)')
}

function buildUserSettingsContent(agents) {
  return [
    '# Harness Workflow 用户级配置',
    `frameworkRoot: ${PACKAGE_ROOT}`,
    `agents: ${agents.join(',')}`,
    '',
  ].join('\n')
}

function printSetupHeader({ agents, dryRun, userHxDir, agentHomes }) {
  const lines = [
    `\n  Harness Workflow · setup${dryRun ? ' (dry-run)' : ''}`,
    `  agents      → ${agents.join(', ')}`,
    `  ~/.hx/      → ${userHxDir}`,
  ]

  for (const agent of agents) {
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
  用法: hx setup [--dry-run]

  选项:
        --user-<agent>-dir <dir>
                        覆盖对应 agent 的安装根目录，例如 --user-gemini-dir /tmp/gemini
        --dry-run       仅显示将要安装的内容，不实际写入
    -h, --help          显示帮助

  将框架文件安装到用户全局目录：
    ~/.hx/              用户层目录骨架（commands/、hooks/、pipelines/）
    ~/.hx/settings.yaml 用户级配置（记录 frameworkRoot / agents）
    ~/.claude/skills/   Claude skill 目录（默认）
    ~/.codex/skills/    Codex skill 目录（默认）
    ~/.cursor/skills/   Cursor skill 目录（默认）
    ~/.gemini/skills/   Gemini skill 目录（默认）
    ~/.kimi/skills/     Kimi skill 目录（默认）
    ~/.windsurf/skills/ Windsurf skill 目录（默认）

  首次无记录时会列出 agent 清单供用户选择。
  hx setup 用于首次安装、手动修复、补装或重跑安装逻辑。

  注意：不会把框架内置 skill、Hook、Pipeline 复制到 ~/.hx/ 下。
  hx setup 会安装同一套 workflow skill 到目标 agent 的 skills 目录。
  业务侧自定义 skill 仍由用户自行管理。

  安装后，在 Agent 会话中运行 hx-init 初始化项目。
  `
}
