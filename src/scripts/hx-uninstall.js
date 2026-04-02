#!/usr/bin/env node

/** hx uninstall — 移除 Harness Workflow 安装产物 */

import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'fs'
import { homedir } from 'os'
import { resolve } from 'path'

import { parseArgs } from './lib/config-utils.js'
import { getAgentSkillDir, SUPPORTED_AGENTS } from './lib/install-utils.js'
import { USER_HX_DIR } from './lib/resolve-context.js'

const { options } = parseArgs(process.argv.slice(2))

main()

function main() {
  if (options.help) {
    console.log(buildHelpText())
    process.exit(0)
  }

  const force = options.force === true
  const dryRun = options['dry-run'] === true
  const userHxDir = options['user-hx-dir'] ? resolve(options['user-hx-dir']) : USER_HX_DIR

  const artifacts = collectArtifacts(userHxDir)

  if (artifacts.length === 0) {
    console.log('\n  未发现任何安装产物，无需卸载。\n')
    return
  }

  console.log('\n  将要删除以下安装产物:\n')
  for (const { label } of artifacts) {
    console.log(`    x ${label}`)
  }
  console.log('\n  保留用户内容目录（commands/、hooks/、pipelines/）。\n')

  if (dryRun) {
    console.log('  [dry-run] 未实际删除。\n')
    return
  }

  if (!force) {
    console.log('  加 --force 参数确认删除。\n')
    return
  }

  for (const { path, label } of artifacts) {
    rmSync(path, { recursive: true, force: true })
    console.log(`  已删除 ${label}`)
  }

  console.log('\n  卸载完成。如需重新安装，运行 npm install -g @hxflow/cli && hx setup\n')
}

function collectArtifacts(userHxDir) {
  const artifacts = []

  for (const agent of SUPPORTED_AGENTS) {
    const skillsRoot = resolve(homedir(), getAgentSkillDir(agent))
    if (!existsSync(skillsRoot)) continue

    for (const entry of readdirSync(skillsRoot)) {
      if (!entry.startsWith('hx-')) continue
      const entryPath = resolve(skillsRoot, entry)
      try {
        if (!statSync(entryPath).isDirectory()) continue
      } catch {
        continue
      }
      const markerPath = resolve(entryPath, 'SKILL.md')
      if (!existsSync(markerPath)) continue
      try {
        if (!readFileSync(markerPath, 'utf8').includes('hx-skill:')) continue
      } catch {
        continue
      }
      artifacts.push({
        path: entryPath,
        label: `~/${getAgentSkillDir(agent)}/${entry}/`,
      })
    }
  }

  const settingsPath = resolve(userHxDir, 'settings.yaml')
  if (existsSync(settingsPath)) {
    artifacts.push({
      path: settingsPath,
      label: settingsPath.replace(homedir(), '~'),
    })
  }

  return artifacts
}

function buildHelpText() {
  return `
  用法: hx uninstall [--force] [--dry-run]

  作用:
    移除 Harness Workflow 安装产物：
      - ~/.claude/skills/hx-*/   Claude skill 入口
      - ~/.agents/skills/hx-*/   通用 agent skill 入口
      - ~/.hx/settings.yaml      用户配置

    不会删除 ~/.hx/commands/、~/.hx/hooks/、~/.hx/pipelines/ 中的用户内容。

  选项:
        --force             确认删除（不传则只显示预览）
        --dry-run           仅预览，不实际删除
        --user-hx-dir <dir> 覆盖 ~/.hx 目录（测试用）
    -h, --help              显示帮助
  `
}
