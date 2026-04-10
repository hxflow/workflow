#!/usr/bin/env bun

import { execFileSync } from 'child_process'
import { homedir } from 'os'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

import { parseArgs } from './lib/config-utils.ts'
import { resolveAgentTargets, SUPPORTED_AGENTS } from './lib/install-utils.ts'
import { getSafeCwd } from './lib/resolve-context.ts'

const { options } = parseArgs(process.argv.slice(2))
const __dirname = dirname(fileURLToPath(import.meta.url))
const SETUP_SCRIPT = resolve(__dirname, 'hx-setup.ts')

main()

function main() {
  if (options.help) {
    console.log(buildHelpText())
    process.exit(0)
  }

  const dryRun = options['dry-run'] === true
  const userHxDir = options['user-hx-dir']
    ? resolve(options['user-hx-dir'])
    : resolve(homedir(), '.hx')
  const { targets, source } = resolveMigrationTargets()

  printHeader({ targets, source, dryRun, userHxDir })
  runSetup({ targets, dryRun })
}

function resolveMigrationTargets() {
  if (options.agent) {
    return {
      targets: resolveAgentTargets(options.agent),
      source: 'arguments',
    }
  }

  return {
    targets: [...SUPPORTED_AGENTS],
    source: 'default',
  }
}

function runSetup({ targets, dryRun }) {
  const setupArgs = [SETUP_SCRIPT, '--agent', targets.join(',')]

  if (dryRun) {
    setupArgs.push('--dry-run')
  }

  if (options['user-hx-dir']) {
    setupArgs.push('--user-hx-dir', options['user-hx-dir'])
  }

  for (const agent of SUPPORTED_AGENTS) {
    const overrideKey = `user-${agent}-dir`
    if (options[overrideKey]) {
      setupArgs.push(`--${overrideKey}`, options[overrideKey])
    }
  }

  try {
    const output = execFileSync(process.execPath, setupArgs, {
      cwd: getSafeCwd(),
      encoding: 'utf8',
      env: process.env,
    })
    process.stdout.write(output)
  } catch (error) {
    if (error.stdout) process.stdout.write(error.stdout)
    if (error.stderr) process.stderr.write(error.stderr)
    process.exit(error.status || 1)
  }
}

function printHeader({ targets, source, dryRun, userHxDir }) {
  console.log(`
  Harness Workflow · migrate${dryRun ? ' (dry-run)' : ''}
  source      → ${source}
  targets     → ${targets.join(', ')}
  ~/.hx/      → ${userHxDir}
  `)
}

function buildHelpText() {
  return `
  用法: hx migrate [--dry-run]

  作用:
    将 1.x / 2.x 安装产物迁移到当前模型。

  规则:
    1. 优先使用传入的 --agent
    2. 未指定时默认迁移到 claude + agents
    3. 迁移时会重跑 hx setup，按当前模型重建入口并清理遗留 settings 字段

  选项:
        --dry-run       仅显示迁移计划，不实际写入
        --user-hx-dir   覆盖 ~/.hx 目录（测试用）
        --user-claude-dir <dir>
                        覆盖 Claude Code 的安装根目录
        --user-agents-dir <dir>
                        覆盖通用 agent 的安装根目录
    -h, --help          显示帮助
  `
}
