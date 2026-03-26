#!/usr/bin/env node

/**
 * hx — Harness Workflow CLI 入口
 *
 * 内置命令:
 *   hx setup [--dry-run]
 *   hx upgrade [--target <dir>] [--dry-run]
 *   hx uninstall [--target <dir>] [--yes] [--dry-run]
 *   hx doctor
 *   hx version
 *
 * 自定义工作流:
 *   在 .hx/commands/ 中创建 <name>.md，运行 hx upgrade 后即可被 Claude/Codex 适配层发现
 *   同名文件会覆盖框架内置的 hx-* 命令 contract
 *
 * 工作流命令（Canonical contract）:
 *   hx-init  hx-doc  hx-plan  hx-ctx  hx-run  hx-qa  hx-review  hx-fix
 *   hx-clean  hx-mr  hx-status  hx-go
 */

import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync, readFileSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCRIPTS_DIR = resolve(__dirname, '..', 'src', 'scripts')

// ── 帮助信息 ──

function printHelp() {
  console.log(`
  Harness Workflow CLI

  用法: hx <command> [options]

  内置命令:
    setup     全局安装框架文件到 ~/.hx/，并生成 Claude/Codex 适配层（首次使用必跑）
    upgrade   升级命令文件；同步 .hx/commands/ 中的自定义覆盖
    uninstall 移除安装痕迹
    doctor    健康检测（环境、安装、项目配置）

  自定义工作流:
    在 .hx/commands/<name>.md 中编写 prompt-first 命令定义
    Claude 使用 /hx-*；Codex 使用 hx-*；两边共享同一份命令 contract

  全局选项:
    --help    显示帮助

  示例:
    hx setup                     # 首次安装
    hx upgrade                   # 升级 + 同步自定义命令
    hx doctor                    # 检查环境健康状态
  `)
}

// ── 版本 ──

function printVersion() {
  try {
    const pkg = JSON.parse(
      readFileSync(resolve(__dirname, '..', 'package.json'), 'utf8')
    )
    console.log(`hx v${pkg.version}`)
  } catch {
    console.log('hx v1.0.0')
  }
}

// ── 主流程 ──

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

const BUILTIN_SCRIPTS = {
  setup:     'hx-setup.js',
  upgrade:   'hx-upgrade.js',
  uninstall: 'hx-uninstall.js',
  doctor:    'hx-doctor.js',
}

const script = BUILTIN_SCRIPTS[command]

if (!script) {
  const CANONICAL_COMMANDS = ['hx-init', 'hx-doc', 'hx-plan', 'hx-ctx', 'hx-run', 'hx-qa', 'hx-review', 'hx-fix', 'hx-clean', 'hx-mr', 'hx-status', 'hx-go']
  const legacyCommands = ['init', 'doc', 'plan', 'ctx', 'run', 'qa', 'review', 'fix', 'clean', 'mr', 'status', 'go']
  if (CANONICAL_COMMANDS.includes(command)) {
    console.error(`  "${command}" 是 agent 命令 contract。Claude 使用 "/${command}"，Codex 使用 "${command}"。`)
  } else if (legacyCommands.includes(command)) {
    console.error(`  "${command}" 是旧式短命令。Claude 使用 "/hx-${command}"，Codex 使用 "hx-${command}"。`)
  } else {
    console.error(`  未知命令: ${command}`)
    console.error(`  自定义工作流：在 .hx/commands/${command}.md 中编写指令，运行 hx upgrade 后供 Claude/Codex 适配层使用`)
  }
  process.exit(1)
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
