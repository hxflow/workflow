#!/usr/bin/env node

/**
 * hx-task.ts — 任务事实工具
 *
 * 用法：
 *   hx task next <feature>                 下一批可执行任务
 *   hx task context <feature> <taskId>     单个任务的实现上下文
 *   hx task list <feature>                 全部任务列表与状态
 *
 * 所有子命令输出 JSON 到 stdout，失败时 exit 1。
 */

import { parseArgs } from '../lib/config-utils.ts'
import { findProjectRoot, getSafeCwd } from '../lib/resolve-context.ts'
import { resolveProgressFile } from '../lib/file-paths.ts'
import { validateProgressFile } from '../lib/progress-schema.ts'
import { getScheduledBatch } from '../lib/task-scheduler.ts'
import { buildTaskContext } from '../lib/task-context.ts'
import type { ProgressData } from '../lib/types.ts'

const args = process.argv.slice(2)
const [sub, ...rest] = args

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
    const [feature] = rest
    if (!feature) err('用法：hx task next <feature>')

    let filePath: string
    try {
      ;({ filePath } = resolveProgressFile(projectRoot, feature))
    } catch (error) {
      err(error instanceof Error ? error.message : String(error))
    }

    const validation = validateProgressFile(filePath)
    if (!validation.valid || !validation.data) {
      err(`progressFile 校验失败: ${validation.errors[0]}`)
    }

    const batch = getScheduledBatch(validation.data as ProgressData)
    out({
      ok: true,
      feature,
      mode: batch.mode,
      parallel: batch.parallel,
      tasks: batch.tasks.map((t) => ({
        id: t.id,
        name: t.name,
        status: t.status,
        dependsOn: t.dependsOn,
      })),
    })
    break
  }

  case 'context': {
    const { positional } = parseArgs(rest)
    const [feature, taskId] = positional
    if (!feature || !taskId) err('用法：hx task context <feature> <taskId>')

    let filePath: string
    try {
      ;({ filePath } = resolveProgressFile(projectRoot, feature))
    } catch (error) {
      err(error instanceof Error ? error.message : String(error))
    }

    const validation = validateProgressFile(filePath)
    if (!validation.valid || !validation.data) {
      err(`progressFile 校验失败: ${validation.errors[0]}`)
    }

    const progressData = validation.data as ProgressData
    const batch = getScheduledBatch(progressData)
    const taskInBatch = batch.tasks.find((t) => t.id === taskId)
    const mode = taskInBatch ? batch.mode : 'run'

    try {
      const context = buildTaskContext({
        feature,
        projectRoot,
        progressData,
        taskId,
        mode: mode as 'run' | 'recover',
      })
      out({ ok: true, ...context })
    } catch (error) {
      err(error instanceof Error ? error.message : String(error))
    }
    break
  }

  case 'list': {
    const [feature] = rest
    if (!feature) err('用法：hx task list <feature>')

    let filePath: string
    try {
      ;({ filePath } = resolveProgressFile(projectRoot, feature))
    } catch (error) {
      err(error instanceof Error ? error.message : String(error))
    }

    const validation = validateProgressFile(filePath)
    if (!validation.valid || !validation.data) {
      err(`progressFile 校验失败: ${validation.errors[0]}`)
    }

    const data = validation.data as ProgressData
    const done = data.tasks.filter((t) => t.status === 'done').length
    const inProgress = data.tasks.filter((t) => t.status === 'in-progress').length
    const pending = data.tasks.length - done - inProgress

    out({
      ok: true,
      feature,
      total: data.tasks.length,
      done,
      inProgress,
      pending,
      completedAt: data.completedAt,
      tasks: data.tasks.map((t) => ({
        id: t.id,
        name: t.name,
        status: t.status,
        dependsOn: t.dependsOn,
        parallelizable: t.parallelizable,
        output: t.output || null,
        startedAt: t.startedAt,
        completedAt: t.completedAt,
        durationSeconds: t.durationSeconds,
      })),
    })
    break
  }

  default:
    err(`未知子命令 "${sub ?? ''}"，可用：next / context / list`)
}
