#!/usr/bin/env bun

/**
 * hx — Harness Workflow CLI 入口
 *
 * 维护命令:
 *   hx setup [--dry-run]
 *   hx migrate [--dry-run]
 *   hx upgrade [--dry-run]
 *   hx uninstall [--force]
 *   hx version
 *
 * 工作流命令和事实工具均为 agent skill，AI 通过裸脚本直接调用。
 * 本 CLI 不路由 skill 脚本。
 */

import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync, readFileSync } from 'fs'
import {
  BUILTIN_CLI_COMMANDS,
  loadCommandSpecs,
} from '../src/lib/install-utils.ts'
import { findProjectRoot, getSafeCwd } from '../src/lib/resolve-context.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCRIPTS_DIR = resolve(__dirname, '..', 'src', 'scripts')
const FRAMEWORK_COMMAND_DIR = resolve(__dirname, '..', 'src', 'commands')
const PACKAGE_JSON_PATH = resolve(__dirname, '..', 'package.json')
const BUILTIN_SCRIPTS = {
  setup: 'hx-setup.ts',
  migrate: 'hx-migrate.ts',
  upgrade: 'hx-upgrade.ts',
  uninstall: 'hx-uninstall.ts',
}
const runtimeCwd = getSafeCwd()
const projectRoot = findProjectRoot(runtimeCwd)
const frameworkSpecs = loadCommandSpecs(FRAMEWORK_COMMAND_DIR)
const installedCommandNames = new Set(frameworkSpecs.map((spec) => spec.name))

function printHelp() {
  const frameworkContractList = formatCommandList(frameworkSpecs.map((spec) => spec.name))

  console.log(`
  Harness Workflow CLI

  用法: hx <command> [options]

  维护命令:
    setup     手动重跑全局安装/修复 ~/.hx 与各 agent skill 入口
    migrate   执行老版本安装产物迁移并重跑 setup
    upgrade   升级 @hxflow/cli 到最新版本并重跑 setup
    uninstall 移除 Harness Workflow 安装产物
    version   输出当前 CLI 版本

  Agent skill（AI 通过裸脚本直接调用，不走 hx 路由）:
${frameworkContractList}

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
  printUnknownCommand(command)
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
  const isSkill = installedCommandNames.has(commandName) || installedCommandNames.has(`hx-${commandName}`)
  if (isSkill) {
    console.error(`  "${commandName}" 是 agent skill，AI 通过裸脚本直接调用，不走 hx 路由。`)
  } else {
    console.error(`  未知命令: ${commandName}`)
  }
  console.error(`  当前 CLI 可直接执行: ${[...BUILTIN_CLI_COMMANDS].join(', ')}`)
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
