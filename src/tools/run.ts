#!/usr/bin/env node

/**
 * hx-run.ts — 任务执行事实工具
 *
 * 用法：
 *   hx run next <feature> [--plan-task <taskId>]     下一批可执行任务及上下文
 *   hx run validate <feature>                        校验所有任务是否完成
 *
 * 所有子命令输出 JSON 到 stdout，失败时 exit 1。
 */

import { validateProgressFile } from '../lib/progress-schema.ts'
import { parseArgs } from '../lib/config-utils.ts'
import { findProjectRoot, getSafeCwd, FRAMEWORK_ROOT } from '../lib/resolve-context.ts'
import { resolveProgressFile } from '../lib/file-paths.ts'
import { getRecoverableTasks, getRunnableTasks, getScheduledBatch } from '../lib/task-scheduler.ts'
import { buildTaskContext } from '../lib/task-context.ts'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import type { ProgressData, ScheduledBatch } from '../lib/types.ts'

const argv = process.argv.slice(2)
const [sub, ...rest] = argv
const { positional, options } = parseArgs(rest)
const [feature] = positional

function out(data: unknown) {
  console.log(JSON.stringify(data, null, 2))
}

function err(message: string): never {
  console.error(JSON.stringify({ ok: false, error: message }))
  process.exit(1)
}

const projectRoot = findProjectRoot(getSafeCwd())

switch (sub) {
  case 'next': {
    if (!feature) err('用法：hx run next <feature> [--plan-task <taskId>]')

    const planTaskId = typeof options['plan-task'] === 'string' ? options['plan-task'] : null

    let filePath: string
    let restored: boolean
    try {
      ;({ filePath, restored } = resolveProgressFile(projectRoot, feature))
    } catch (error) {
      err(error instanceof Error ? error.message : String(error))
    }

    const validation = validateProgressFile(filePath)
    if (!validation.valid || !validation.data) {
      err(`progressFile 校验失败: ${validation.errors[0]}`)
    }

    const progressData = validation.data as ProgressData

    let batch: ScheduledBatch
    try {
      batch = resolveBatch(progressData, planTaskId)
    } catch (error) {
      err(error instanceof Error ? error.message : String(error))
    }

    if (batch.mode === 'done') {
      out({
        ok: true,
        completed: true,
        feature,
        progressFile: filePath,
        restored,
        tasks: progressData.tasks.map((t) => ({ id: t.id, name: t.name, status: t.status })),
      })
      break
    }

    const tasksContext = batch.tasks.map((task) => buildTaskContext({
      feature,
      projectRoot,
      progressData,
      taskId: task.id,
      mode: batch.mode,
    }))

    const goldenRules = resolveRuleFile(projectRoot, 'golden-rules.md')

    out({
      ok: true,
      completed: false,
      feature,
      progressFile: filePath,
      restored,
      mode: batch.mode,
      parallel: batch.parallel,
      tasks: batch.tasks.map((t) => ({ id: t.id, name: t.name, status: t.status, dependsOn: t.dependsOn })),
      tasksContext,
      goldenRules,
    })
    break
  }

  case 'validate': {
    if (!feature) err('用法：hx run validate <feature>')

    let filePath: string
    try {
      ;({ filePath } = resolveProgressFile(projectRoot, feature))
    } catch (error) {
      err(error instanceof Error ? error.message : String(error))
    }

    const validation = validateProgressFile(filePath)
    if (!validation.valid || !validation.data) {
      out({ ok: false, feature, progressFile: filePath, errors: validation.errors })
      process.exit(1)
    }

    const data = validation.data as ProgressData
    const allDone = data.tasks.every((t) => t.status === 'done')
    const done = data.tasks.filter((t) => t.status === 'done').length

    out({
      ok: true,
      feature,
      progressFile: filePath,
      allDone,
      done,
      total: data.tasks.length,
      completedAt: data.completedAt,
      tasks: data.tasks.map((t) => ({ id: t.id, name: t.name, status: t.status })),
    })
    break
  }

  default:
    err(`未知子命令 "${sub ?? ''}"，可用：next / validate`)
}

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
