#!/usr/bin/env bun

/**
 * hx — Harness Workflow CLI 入口
 *
 * 内置命令:
 *   hx setup [--dry-run]
 *   hx migrate [--dry-run]
 *   hx version
 *
 * 其他 hx-* 能力通过 agent 命令 contract 提供，不是本地 Node 子命令。
 */

import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync, readFileSync } from 'fs'
import {
  BUILTIN_CLI_COMMANDS,
  loadCommandSpecs,
  mergeCommandSpecs,
} from '../src/scripts/lib/install-utils.ts'
import { USER_HX_DIR, findProjectRoot, getSafeCwd } from '../src/scripts/lib/resolve-context.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCRIPTS_DIR = resolve(__dirname, '..', 'src', 'scripts')
const FRAMEWORK_COMMAND_DIR = resolve(__dirname, '..', 'src', 'commands')
const PACKAGE_JSON_PATH = resolve(__dirname, '..', 'package.json')
const BUILTIN_SCRIPTS = {
  setup: 'hx-setup.ts',
  migrate: 'hx-migrate.ts',
  upgrade: 'hx-upgrade.ts',
  uninstall: 'hx-uninstall.ts',
  // 确定性工具命令（代码实现，供 AI agent 调用）
  progress: 'hx-progress.ts',
  feature: 'hx-feature.ts',
  archive: 'hx-archive.ts',
  restore: 'hx-restore.ts',
  status: 'hx-status.ts',
  // 编排命令（状态机，代码驱动，输出精确 AI 指令）
  run: 'hx-run.ts',
  plan: 'hx-plan.ts',
  go: 'hx-go.ts',
  check: 'hx-check.ts',
  mr: 'hx-mr.ts',
}
const runtimeCwd = getSafeCwd()
const projectRoot = findProjectRoot(runtimeCwd)
const frameworkSpecs = loadCommandSpecs(FRAMEWORK_COMMAND_DIR)
const userSpecs = loadCommandSpecs(resolve(USER_HX_DIR, 'commands'))
const projectSpecs = loadCommandSpecs(resolve(projectRoot, '.hx', 'commands'))
const installedCommandSpecs = mergeCommandSpecs(frameworkSpecs, userSpecs, projectSpecs)
const installedCommandNames = new Set(installedCommandSpecs.map((spec) => spec.name))

function printHelp() {
  const frameworkContractList = formatCommandList(frameworkSpecs.map((spec) => spec.name))
  const customSections = buildCustomCommandSections()

  console.log(`
  Harness Workflow CLI

  用法: hx <command> [options]

  内置命令:
    setup     手动重跑全局安装/修复 ~/.hx 与各 agent skill 入口
    migrate   执行老版本安装产物迁移并重跑 setup
    upgrade   升级 @hxflow/cli 到最新版本并重跑 setup
    uninstall 移除 Harness Workflow 安装产物
    version   输出当前 CLI 版本

  确定性工具命令（代码实现，供 AI agent 调用）:
    progress  进度文件操作  next/start/done/fail/validate
    feature   需求文档工具  parse
    archive   归档 feature 产物到 docs/archive/
    restore   从 docs/archive/ 还原 feature 产物
    status    查看 feature 进度摘要

  框架工作流命令 contract:
${frameworkContractList}
${customSections}
  全局选项:
    --help    显示帮助

  示例:
    npm install -g @hxflow/cli
    hx setup                     # 首次安装或手动修复安装产物
    hx migrate                   # 从老版本安装产物迁移到当前模型
    hx upgrade                   # 升级到最新版本
    hx version                   # 查看版本
  `)
}

function buildCustomCommandSections() {
  const lines = []

  if (projectSpecs.length > 0) {
    lines.push(`  项目级自定义命令 (.hx/commands/):`)
    lines.push(formatCommandList(projectSpecs.map((spec) => spec.name)))
  }

  if (userSpecs.length > 0) {
    lines.push(`  用户级自定义命令 (~/.hx/commands/):`)
    lines.push(formatCommandList(userSpecs.map((spec) => spec.name)))
  }

  return lines.length > 0 ? lines.join('\n') + '\n' : ''
}

function printVersion() {
  try {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf8'))
    console.log(`hx v${pkg.version}`)
  } catch {
    console.log('hx v1.0.0')
  }
}

const args = process.argv.slice(2)
const command = args[0]

if (!command || command === '--help' || command === '-h') {
  printHelp()
  process.exit(0)
}

if (command === 'version' || command === '--version' || command === '-v') {
  printVersion()
  process.exit(0)
}

const script = BUILTIN_SCRIPTS[command]

if (!script) {
  if (installedCommandNames.has(command)) {
    console.error(`  "${command}" 是 agent 命令 contract。Claude 使用 "/${command}"，Codex 使用 "${command}"。`)
  } else {
    printUnknownCommand(command)
  }
  process.exit(1)
}

function formatCommandList(commands) {
  if (commands.length === 0) {
    return '    (未发现命令 contract)'
  }

  const lines = []

  for (let index = 0; index < commands.length; index += 4) {
    lines.push(`    ${commands.slice(index, index + 4).join('  ')}`)
  }

  return lines.join('\n')
}

function printUnknownCommand(commandName) {
  console.error(`  未知命令: ${commandName}`)
  console.error('  新增共享命令：在 ~/.hx/commands/hx-*.md 中编写 contract 后运行 hx setup 安装适配层')
  console.error(`  项目级覆写：在 ${projectRoot}/.hx/commands/ 中放同名 hx-*.md`)
  console.error(`  当前 CLI 仅直接执行: ${BUILTIN_CLI_COMMANDS.join(', ')}`)
}

const scriptPath = resolve(SCRIPTS_DIR, script)

if (!existsSync(scriptPath)) {
  console.error(`  命令脚本不存在: ${scriptPath}`)
  process.exit(1)
}

try {
  process.argv = [process.argv[0], scriptPath, ...args.slice(1)]
  await import(scriptPath)
} catch (err) {
  console.error(`  执行失败: ${err.message}`)
  process.exit(1)
}
