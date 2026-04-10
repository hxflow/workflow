#!/usr/bin/env bun

/** hx upgrade — 升级 @hxflow/cli 并重跑 setup */

import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { homedir } from 'os'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

import { parseArgs } from './lib/config-utils.ts'
import { getSafeCwd } from './lib/resolve-context.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PACKAGE_JSON_PATH = resolve(__dirname, '../../package.json')
const { options } = parseArgs(process.argv.slice(2))

main()

function main() {
  if (options.help) {
    console.log(buildHelpText())
    process.exit(0)
  }

  const dryRun = options['dry-run'] === true
  const { name: packageName, version: currentVersion } = readPackageJson()
  const targetSuffix = options.target ? `@${options.target}` : '@latest'

  printHeader({ dryRun, currentVersion, packageName, targetSuffix })
  runNpmInstall({ packageName, targetSuffix, dryRun })
  runSetup({ dryRun })
}

function readPackageJson() {
  try {
    const { name, version } = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf8'))
    return { name, version }
  } catch {
    return { name: '@hxflow/cli', version: 'unknown' }
  }
}

function runNpmInstall({ packageName, targetSuffix, dryRun }) {
  const installSpec = `${packageName}${targetSuffix}`
  const registry = 'https://npm.cdfsunrise.com/'
  const npmCmd = `npm install -g ${installSpec} --registry ${registry}`

  if (dryRun) {
    console.log(`  [dry-run] ${npmCmd}\n`)
    return
  }

  console.log(`  升级 ${installSpec}...\n`)

  try {
    const output = execSync(npmCmd, {
      cwd: getSafeCwd(),
      encoding: 'utf8',
      env: process.env,
    })
    if (output) process.stdout.write(output)
  } catch (error) {
    if (error.stdout) process.stdout.write(error.stdout)
    if (error.stderr) process.stderr.write(error.stderr)
    process.exit(error.status || 1)
  }
}

function runSetup({ dryRun }) {
  const setupArgs = buildSetupArgs(dryRun)

  if (dryRun) {
    console.log(`  [dry-run] hx setup ${setupArgs.filter((a) => a.startsWith('--')).join(' ')}\n`)
    return
  }

  console.log('  重跑 setup...\n')

  try {
    const output = execSync(`hx setup ${setupArgs.join(' ')}`, {
      cwd: getSafeCwd(),
      encoding: 'utf8',
      env: process.env,
    })
    if (output) process.stdout.write(output)
  } catch (error) {
    if (error.stdout) process.stdout.write(error.stdout)
    if (error.stderr) process.stderr.write(error.stderr)
    process.exit(error.status || 1)
  }
}

function buildSetupArgs(dryRun) {
  const args = []
  if (dryRun) args.push('--dry-run')
  for (const key of ['user-hx-dir', 'user-claude-dir', 'user-agents-dir']) {
    if (options[key]) args.push(`--${key}`, options[key])
  }
  return args
}

function printHeader({ dryRun, currentVersion, packageName, targetSuffix }) {
  console.log(`
  Harness Workflow · upgrade${dryRun ? ' (dry-run)' : ''}
  当前版本    → ${currentVersion}
  升级目标    → ${packageName}${targetSuffix}
  `)
}

function buildHelpText() {
  return `
  用法: hx upgrade [--dry-run] [--target <version>]

  作用:
    升级 @hxflow/cli 到最新版本（或指定版本），并重跑 hx setup 同步安装产物。

  选项:
        --target <version>  指定升级目标版本（默认: latest）
        --dry-run           仅预览升级计划，不实际执行
        --user-hx-dir <dir>
                            覆盖 ~/.hx 目录（测试用）
        --user-claude-dir <dir>
                            覆盖 Claude Code 的安装根目录
        --user-agents-dir <dir>
                            覆盖通用 agent 的安装根目录
    -h, --help              显示帮助

  示例:
    hx upgrade
    hx upgrade --target 3.1.0
    hx upgrade --dry-run
  `
}
