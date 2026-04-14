#!/usr/bin/env node

/**
 * hx-status.js — 查看 feature 进度摘要
 *
 * 用法：
 *   hx status                  # 扫描全部 docs/plans/*-progress.json
 *   hx status <feature>        # 只查指定 feature
 *   hx status --feature <name> # 同上
 *
 * 输出人类可读的进度摘要到 stdout，失败时 exit 1。
 */

import { readdirSync, existsSync } from 'fs'
import { resolve } from 'path'
import { parseArgs } from '../lib/config-utils.ts'
import { readProgressFile, validateProgressFile } from '../lib/progress-schema.ts'
import { getActiveProgressFilePath } from '../lib/file-paths.ts'
import { findProjectRoot, getSafeCwd } from '../lib/resolve-context.ts'

const rawArgs = process.argv.slice(2)
const { positional, options } = parseArgs(rawArgs)

const projectRoot = findProjectRoot(getSafeCwd())
const plansDir = resolve(projectRoot, 'docs', 'plans')

function printSeparator() {
  console.log('─'.repeat(60))
}

function formatTask(task) {
  const icon = task.status === 'done' ? '✓' : task.status === 'in-progress' ? '⟳' : '○'
  const duration = task.durationSeconds !== null ? ` (${task.durationSeconds}s)` : ''
  return `  ${icon} ${task.id}  ${task.name}${duration}`
}

function printFeatureStatus(filePath) {
  const result = validateProgressFile(filePath)

  if (!result.valid) {
    console.log(`  ⚠ 校验失败：${result.errors[0]}`)
    return
  }

  const data = result.data
  const total = data.tasks.length
  const done = data.tasks.filter((t) => t.status === 'done').length
  const inProgress = data.tasks.filter((t) => t.status === 'in-progress').length
  const pending = total - done - inProgress

  console.log(`  feature:  ${data.feature}`)
  console.log(`  进度:     ${done}/${total} 完成  ${inProgress > 0 ? `${inProgress} 进行中  ` : ''}${pending > 0 ? `${pending} 待执行` : ''}`)

  if (data.completedAt) {
    console.log(`  完成时间: ${data.completedAt}`)
  } else if (data.lastRun) {
    const { taskId, exitStatus, ranAt } = data.lastRun
    console.log(`  最近执行: ${taskId}  [${exitStatus}]  ${ranAt}`)
  }

  console.log()
  for (const task of data.tasks) {
    console.log(formatTask(task))
  }

  console.log()
  if (data.completedAt) {
    console.log('  → 下一步：hx check 或 hx mr')
  } else if (inProgress > 0) {
    console.log(`  → 下一步：hx run ${data.feature}（恢复进行中任务）`)
  } else if (pending > 0) {
    console.log(`  → 下一步：hx run ${data.feature}`)
  }
}

// 确定目标 feature
const featureArg = positional[0] || options.feature

if (featureArg) {
  const filePath = getActiveProgressFilePath(projectRoot, featureArg)

  if (!existsSync(filePath)) {
    console.error(`progressFile 不存在：${filePath}`)
    process.exit(1)
  }

  printSeparator()
  printFeatureStatus(filePath)
  printSeparator()
} else {
  // 扫描全部 *-progress.json
  if (!existsSync(plansDir)) {
    console.log('docs/plans/ 目录不存在，暂无进度文件。')
    process.exit(0)
  }

  const files = readdirSync(plansDir).filter((f) => f.endsWith('-progress.json'))

  if (files.length === 0) {
    console.log('docs/plans/ 中暂无进度文件。')
    process.exit(0)
  }

  printSeparator()
  for (const file of files) {
    printFeatureStatus(resolve(plansDir, file))
    printSeparator()
  }
}
