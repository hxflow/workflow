#!/usr/bin/env bun
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
import { parseArgs } from './config-utils.ts'
import { exitWithJsonError as err, printJson as out } from './json-cli.ts'
import { loadValidatedProgressFile } from './progress-context.ts'
import { computeProgressStats } from './progress-stats.ts'
import { getScheduledBatch } from './task-scheduler.ts'
import { startTask, completeTask, failTask } from './progress-ops.ts'
import { getSafeCwd } from './resolve-context.ts'

const args = process.argv.slice(2)
const [sub, ...rest] = args

function resolveFilePath(rawPath: string) {
  return resolve(getSafeCwd(), rawPath)
}

switch (sub) {
  case 'next': {
    const [rawPath] = rest
    if (!rawPath) err('用法：hx progress next <progressFile>')

    try {
      const filePath = resolveFilePath(rawPath)
      const { data } = loadValidatedProgressFile(filePath)
      const batch = getScheduledBatch(data)
      out({
        ok: true,
        mode: batch.mode,
        parallel: batch.parallel,
        tasks: batch.tasks.map((t) => ({ id: t.id, name: t.name })),
      })
    } catch (error) {
      err(error instanceof Error ? error.message : String(error))
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
      err(error instanceof Error ? error.message : String(error))
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
      err(error instanceof Error ? error.message : String(error))
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
      failTask(filePath, taskId, String(exitStatus), String(exitReason))
      out({ ok: true })
    } catch (error) {
      err(error instanceof Error ? error.message : String(error))
    }
    break
  }

  case 'validate': {
    const [rawPath] = rest
    if (!rawPath) err('用法：hx progress validate <progressFile>')

    try {
      const filePath = resolveFilePath(rawPath)
      loadValidatedProgressFile(filePath)
      out({ ok: true, valid: true })
    } catch (error) {
      console.log(JSON.stringify({
        ok: false,
        valid: false,
        errors: [error instanceof Error ? error.message : String(error)],
      }, null, 2))
      process.exit(1)
    }
    break
  }

  case 'inspect': {
    const [rawPath] = rest
    if (!rawPath) err('用法：hx progress inspect <progressFile>')

    let filePath: string
    let data
    try {
      filePath = resolveFilePath(rawPath)
      data = loadValidatedProgressFile(filePath).data
    } catch (error) {
      console.log(JSON.stringify({
        ok: false,
        valid: false,
        errors: [error instanceof Error ? error.message : String(error)],
      }, null, 2))
      process.exit(1)
    }

    const stats = computeProgressStats(data)
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
      summary: stats,
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
