#!/usr/bin/env node

/**
 * hx-run.ts — 任务执行 orchestrator
 *
 * 有待执行任务：输出下一批任务上下文，actionRequired:true，AI 执行后调 hx progress done。
 * 所有任务完成：输出 completed:true。
 */

import { validateProgressFile } from './lib/progress-schema.ts'
import { parseArgs } from './lib/config-utils.ts'
import { findProjectRoot, getSafeCwd, FRAMEWORK_ROOT } from './lib/resolve-context.ts'
import { resolveProgressFile } from './lib/file-paths.ts'
import { getRecoverableTasks, getRunnableTasks, getScheduledBatch } from './lib/task-scheduler.ts'
import { buildTaskContext } from './lib/task-context.ts'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import type { ProgressData, ScheduledBatch } from './lib/types.ts'

const argv = process.argv.slice(2)
const { positional, options } = parseArgs(argv)
const [feature] = positional

if (!feature) {
  console.error('用法: hx run <feature> [--plan-task <task-id>]')
  process.exit(1)
}

const projectRoot = findProjectRoot(getSafeCwd())
const planTaskId = typeof options['plan-task'] === 'string' ? options['plan-task'] : null

let filePath: string
let restored: boolean
try {
  ;({ filePath, restored } = resolveProgressFile(projectRoot, feature))
} catch (err) {
  console.error(`❌ ${err instanceof Error ? err.message : String(err)}`)
  console.error(`   请先运行 hx plan ${feature}`)
  process.exit(1)
}

if (restored) {
  console.error(`ℹ️  progressFile 已从归档还原: ${filePath}`)
}

// ── 校验 progressFile ─────────────────────────────────────────────────────────
const validation = validateProgressFile(filePath)
if (!validation.valid || !validation.data) {
  console.error(JSON.stringify({ ok: false, reason: '校验失败', errors: validation.errors }, null, 2))
  process.exit(1)
}

const progressData = validation.data as ProgressData

// ── 计算下一批次 ───────────────────────────────────────────────────────────────
let batch: ScheduledBatch
try {
  batch = resolveBatch(progressData, planTaskId)
} catch (error) {
  console.error(JSON.stringify({ ok: false, reason: error instanceof Error ? error.message : String(error) }, null, 2))
  process.exit(1)
}

// ── 所有任务完成 ───────────────────────────────────────────────────────────────
if (batch.mode === 'done') {
  console.log(JSON.stringify({
    ok: true,
    actionRequired: false,
    completed: true,
    feature,
    progressFile: filePath,
    restored,
    tasks: progressData.tasks.map((t) => ({ id: t.id, name: t.name, status: t.status })),
    nextAction: `hx check ${feature}`,
  }, null, 2))
  process.exit(0)
}

// ── 有可执行任务 → 输出上下文供 AI 实现 ──────────────────────────────────────────
const tasksContext = batch.tasks.map((task) => buildTaskContext({
  feature,
  projectRoot,
  progressData,
  taskId: task.id,
  mode: batch.mode,
}))

const goldenRules = resolveRuleFile(projectRoot, 'golden-rules.md')

console.log(JSON.stringify({
  ok: true,
  actionRequired: true,
  completed: false,
  feature,
  progressFile: filePath,
  restored,
  mode: batch.mode,
  parallel: batch.parallel,
  tasks: batch.tasks.map((t) => ({ id: t.id, name: t.name, status: t.status, dependsOn: t.dependsOn })),
  context: {
    goldenRules,
    tasksContext,
    progressManagement: {
      startTask: `hx progress start <taskId>`,
      completeTask: `hx progress done <taskId>`,
      failTask: `hx progress fail <taskId>`,
    },
  },
  nextAction: `hx run ${feature}${planTaskId ? ` --plan-task ${planTaskId}` : ''}`,
}, null, 2))

function resolveRuleFile(root: string, name: string): string | null {
  const projectFile = resolve(root, '.hx', 'rules', name)
  const frameworkFile = resolve(FRAMEWORK_ROOT, 'templates', 'rules', name)
  const targetPath = existsSync(projectFile) ? projectFile : frameworkFile
  return existsSync(targetPath) ? readFileSync(targetPath, 'utf8') : null
}

function resolveBatch(progressData: ProgressData, planTaskId: string | null): ScheduledBatch {
  if (!planTaskId) {
    return getScheduledBatch(progressData)
  }

  const task = progressData.tasks.find((item) => item.id === planTaskId)
  if (!task) {
    throw new Error(`task "${planTaskId}" 在 progressFile 中不存在`)
  }

  if (task.status === 'done') {
    throw new Error(`task "${planTaskId}" 已为 done，不能通过 --plan-task 重新执行`)
  }

  const recoverableIds = new Set(getRecoverableTasks(progressData).map((item) => item.id))
  if (recoverableIds.has(planTaskId)) {
    return { tasks: [task], parallel: false, mode: 'recover' }
  }

  const runnableIds = new Set(getRunnableTasks(progressData).map((item) => item.id))
  if (!runnableIds.has(planTaskId)) {
    throw new Error(`task "${planTaskId}" 当前不可执行：依赖未完成或状态非法`)
  }

  return { tasks: [task], parallel: false, mode: 'run' }
}
