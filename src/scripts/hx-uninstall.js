#!/usr/bin/env node

/**
 * hx uninstall — 干净移除 Harness Workflow 安装痕迹
 *
 * 移除内容：
 *   1. .hx/config.yaml
 *   2. .CLAUDE.md（若存在旧入口链接）
 *   3. .claude/commands/hx-*.md
 *   4. CLAUDE.md 中的 harness 标记块
 *
 * 保留内容（完全不动）：
 *   - 用户原有 .claude/skills/、.claude/agents/、.claude/config/
 *   - CLAUDE.md 中标记块以外的所有内容
 *   - 用户源码、git history、所有其他文件
 */

import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { createInterface } from 'readline'
import { resolve } from 'path'

import { findProjectRoot } from './lib/resolve-context.js'
import { HARNESS_MARKER_START, HARNESS_MARKER_END, escapeRegExp } from './lib/install-utils.js'
import { parseArgs } from './lib/profile-utils.js'

// ── CLI 参数 ──

const { options } = parseArgs(process.argv.slice(2))

if (options.help) {
  console.log(`
  用法: hx uninstall [-t <dir>] [-y] [--dry-run]

  选项:
    -t, --target <dir>  目标项目目录（默认当前目录）
    -y, --yes           跳过确认提示，直接卸载
        --dry-run       仅显示将要删除的内容，不实际执行
    -h, --help          显示帮助

  注意: 此操作会移除 workflow 安装痕迹，请提前确认目标目录。
  `)
  process.exit(0)
}

const targetDir = options.target ? resolve(options.target) : process.cwd()
const skipConfirm = options.yes === true
const dryRun = options['dry-run'] === true

const projectRoot = findProjectRoot(targetDir)

// ── 预检：收集将要删除的内容 ──

const toRemove = collectRemoveList(projectRoot)

if (toRemove.length === 0) {
  console.log('\n  未发现 Harness Workflow 安装痕迹，无需卸载。\n')
  process.exit(0)
}

console.log(`\n  Harness Workflow · uninstall${dryRun ? ' (dry-run)' : ''}`)
console.log(`  目标: ${projectRoot}\n`)
console.log('  将要移除:\n')
for (const item of toRemove) {
  console.log(`    - ${item.display}`)
}

if (dryRun) {
  console.log('\n  [dry-run] 未实际删除。\n')
  process.exit(0)
}

// ── 确认 ──

if (skipConfirm) {
  runUninstall(projectRoot, toRemove)
} else {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  rl.question('\n  确认卸载？输入 yes 继续，其他任意键取消：', (answer) => {
    rl.close()
    if (answer.trim().toLowerCase() === 'yes') {
      runUninstall(projectRoot, toRemove)
    } else {
      console.log('\n  已取消。\n')
      process.exit(0)
    }
  })
}

// ── 执行卸载 ──

function runUninstall(projectRoot, items) {
  const summary = { removed: [], warnings: [] }

  for (const item of items) {
    try {
      item.action()
      summary.removed.push(item.display)
    } catch (err) {
      summary.warnings.push(`${item.display}: ${err.message}`)
    }
  }

  console.log('\n  ── 卸载报告 ──\n')

  if (summary.removed.length) {
    console.log('  已移除:')
    for (const item of summary.removed) console.log(`    ✓ ${item}`)
  }

  if (summary.warnings.length) {
    console.log('  警告:')
    for (const w of summary.warnings) console.log(`    ! ${w}`)
  }

  console.log('\n  卸载完成。用户文件（源码、.claude/skills/ 等）未受影响。\n')
}

// ── 收集移除列表 ──

function collectRemoveList(projectRoot) {
  const items = []

  const hxConfigPath = resolve(projectRoot, '.hx', 'config.yaml')
  if (existsSync(hxConfigPath)) {
    items.push({
      display: '.hx/config.yaml',
      action: () => rmSync(hxConfigPath, { force: true })
    })
  }

  const claudeLinkPath = resolve(projectRoot, '.CLAUDE.md')
  if (existsSync(claudeLinkPath)) {
    items.push({
      display: '.CLAUDE.md',
      action: () => rmSync(claudeLinkPath, { force: true })
    })
  }

  // .claude/commands/hx-*.md
  const cmdsDir = resolve(projectRoot, '.claude', 'commands')
  if (existsSync(cmdsDir)) {
    const hxFiles = readdirSync(cmdsDir).filter(f => f.startsWith('hx-') && f.endsWith('.md'))
    for (const file of hxFiles) {
      const filePath = resolve(cmdsDir, file)
      items.push({
        display: `.claude/commands/${file}`,
        action: () => rmSync(filePath, { force: true })
      })
    }
  }

  // CLAUDE.md 标记块
  const claudePath = resolve(projectRoot, 'CLAUDE.md')
  if (existsSync(claudePath)) {
    const content = readFileSync(claudePath, 'utf8')
    if (content.includes(HARNESS_MARKER_START)) {
      items.push({
        display: 'CLAUDE.md (harness 标记块)',
        action: () => removeCLAUDEmdBlock(claudePath, content)
      })
    }
  }

  return items
}

function removeCLAUDEmdBlock(claudePath, content) {
  const cleaned = content
    .replace(
      new RegExp(
        `\\n?${escapeRegExp(HARNESS_MARKER_START)}[\\s\\S]*?${escapeRegExp(HARNESS_MARKER_END)}\\n?`,
        'g'
      ),
      ''
    )
    .trimEnd()

  writeFileSync(claudePath, cleaned + '\n')
}
