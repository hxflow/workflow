#!/usr/bin/env node

/**
 * hx-progress.js — progress.json 操作命令集
 *
 * 用法：
 *   hx progress next <progressFile>
 *   hx progress start <progressFile> <taskId>
 *   hx progress done <progressFile> <taskId> --output <text>
 *   hx progress fail <progressFile> <taskId> --exit <status> --reason <text>
 *   hx progress validate <progressFile>
 *
 * 所有子命令输出 JSON 到 stdout，失败时 exit 1。
 */

import { resolve } from 'path'
import { parseArgs } from '../lib/config-utils.ts'
import { getScheduledBatch } from '../lib/task-scheduler.ts'
import { startTask, completeTask, failTask } from '../lib/progress-ops.ts'
import { readProgressFile, validateProgressFile } from '../lib/progress-schema.ts'
import { getSafeCwd } from '../lib/resolve-context.ts'

const args = process.argv.slice(2)
const [sub, ...rest] = args

function out(data) {
  console.log(JSON.stringify(data, null, 2))
}

function err(message) {
  console.error(JSON.stringify({ ok: false, error: message }))
  process.exit(1)
}

function resolveFilePath(rawPath) {
  return resolve(getSafeCwd(), rawPath)
}

switch (sub) {
  case 'next': {
    const [rawPath] = rest
    if (!rawPath) err('用法：hx progress next <progressFile>')

    try {
      const filePath = resolveFilePath(rawPath)
      const data = readProgressFile(filePath)
      const batch = getScheduledBatch(data)
      out({
        ok: true,
        mode: batch.mode,
        parallel: batch.parallel,
        tasks: batch.tasks.map((t) => ({ id: t.id, name: t.name })),
      })
    } catch (error) {
      err(error.message)
    }
    break
  }

  case 'start': {
    const [rawPath, taskId] = rest
    if (!rawPath || !taskId) err('用法：hx progress start <progressFile> <taskId>')

    try {
      const filePath = resolveFilePath(rawPath)
      startTask(filePath, taskId)
      out({ ok: true })
    } catch (error) {
      err(error.message)
    }
    break
  }

  case 'done': {
    const [rawPath, taskId, ...doneRest] = rest
    if (!rawPath || !taskId) err('用法：hx progress done <progressFile> <taskId> --output <text>')

    const { options } = parseArgs(doneRest)
    const output = options.output

    if (typeof output !== 'string') err('--output 是必填参数')

    try {
      const filePath = resolveFilePath(rawPath)
      completeTask(filePath, taskId, output)
      out({ ok: true })
    } catch (error) {
      err(error.message)
    }
    break
  }

  case 'fail': {
    const [rawPath, taskId, ...failRest] = rest
    if (!rawPath || !taskId) err('用法：hx progress fail <progressFile> <taskId> --exit <status> --reason <text>')

    const { options } = parseArgs(failRest)
    const exitStatus = options.exit
    const exitReason = options.reason

    if (!exitStatus) err('--exit 是必填参数')
    if (!exitReason) err('--reason 是必填参数')

    try {
      const filePath = resolveFilePath(rawPath)
      failTask(filePath, taskId, exitStatus, String(exitReason))
      out({ ok: true })
    } catch (error) {
      err(error.message)
    }
    break
  }

  case 'validate': {
    const [rawPath] = rest
    if (!rawPath) err('用法：hx progress validate <progressFile>')

    const filePath = resolveFilePath(rawPath)
    const result = validateProgressFile(filePath)

    if (result.valid) {
      out({ ok: true, valid: true })
    } else {
      console.log(JSON.stringify({ ok: false, valid: false, errors: result.errors }, null, 2))
      process.exit(1)
    }
    break
  }

  case 'inspect': {
    const [rawPath] = rest
    if (!rawPath) err('用法：hx progress inspect <progressFile>')

    const filePath = resolveFilePath(rawPath)
    const result = validateProgressFile(filePath)

    if (!result.valid) {
      console.log(JSON.stringify({ ok: false, valid: false, errors: result.errors }, null, 2))
      process.exit(1)
    }

    const data = result.data
    const total = data.tasks.length
    const done = data.tasks.filter((t) => t.status === 'done').length
    const inProgress = data.tasks.filter((t) => t.status === 'in-progress').length
    const pending = total - done - inProgress
    const batch = getScheduledBatch(data)

    out({
      ok: true,
      valid: true,
      feature: data.feature,
      requirementDoc: data.requirementDoc,
      planDoc: data.planDoc,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      completedAt: data.completedAt,
      lastRun: data.lastRun,
      summary: { total, done, inProgress, pending },
      nextBatch: {
        mode: batch.mode,
        parallel: batch.parallel,
        tasks: batch.tasks.map((t) => ({ id: t.id, name: t.name })),
      },
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
    err(`未知子命令 "${sub ?? ''}"，可用：next / start / done / fail / validate / inspect`)
}
