/**
 * progress-ops.js — progress.json 原子写入操作
 *
 * 把 progress-contract 中「两阶段写入」规则固化为代码。
 * 每次写入前读取最新文件，写入后自动执行 validateProgressFile，
 * 校验失败时立即抛出。
 *
 * 注意：sleep() 使用 SharedArrayBuffer + Atomics.wait() 实现同步等待。
 * SharedArrayBuffer 在部分浏览器安全上下文中被禁用，但本模块仅在
 * Bun（CLI 运行时）环境下使用，无需兼容浏览器。
 */

import { closeSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'fs'

import { validateProgressData } from './progress-schema.ts'

const ISO_NOW = () => new Date().toISOString()
const LOCK_TIMEOUT_MS = 5000
const LOCK_RETRY_MS = 10
const LOCK_WAIT_BUFFER = new SharedArrayBuffer(4)
const LOCK_WAIT_ARRAY = new Int32Array(LOCK_WAIT_BUFFER)

// ── 内部工具 ────────────────────────────────────────────────

function readProgress(filePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(filePath, 'utf8'))
}

function sleep(ms: number): void {
  Atomics.wait(LOCK_WAIT_ARRAY, 0, 0, ms)
}

function withProgressLock<T>(filePath: string, action: () => T): T {
  const lockPath = `${filePath}.lock`
  const deadline = Date.now() + LOCK_TIMEOUT_MS
  let lockFd = null

  while (lockFd === null) {
    try {
      lockFd = openSync(lockPath, 'wx')
    } catch (error) {
      if (error?.code !== 'EEXIST') {
        throw error
      }
      if (Date.now() >= deadline) {
        throw new Error(`progressFile 正在被其他任务写入，请稍后重试：${filePath}`)
      }
      sleep(LOCK_RETRY_MS)
    }
  }

  try {
    return action()
  } finally {
    closeSync(lockFd)
    try {
      unlinkSync(lockPath)
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        throw error
      }
    }
  }
}

function writeProgress(filePath: string, data: Record<string, unknown>): void {
  const result = validateProgressData(data)
  if (!result.valid) {
    throw new Error(`progressFile 写入校验失败：\n${result.errors.join('\n')}`)
  }
  writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8')
}

function findTask(data: Record<string, unknown>, taskId: string): Record<string, unknown> {
  const tasks = data.tasks as Array<Record<string, unknown>>
  const task = tasks.find((t) => t.id === taskId)
  if (!task) {
    throw new Error(`task "${taskId}" 不存在于 progressFile`)
  }
  return task
}

function hasCompletedDeps(data: Record<string, unknown>, task: Record<string, unknown>): boolean {
  const tasks = data.tasks as Array<Record<string, unknown>>
  const doneIds = new Set(tasks.filter((item) => item.status === 'done').map((item) => item.id))
  return (task.dependsOn as string[]).every((depId) => doneIds.has(depId))
}

// ── 两阶段写入 ──────────────────────────────────────────────

/**
 * 阶段一：将 task 状态设为 in-progress，记录 startedAt。
 *
 * 规则（来自 progress-contract 阶段一）：
 *   - tasks[].status → 'in-progress'
 *   - tasks[].startedAt → 当前时刻 ISO 8601
 *   - 顶层 updatedAt → 当前时刻
 *   - 写入后 validateProgressData 校验
 *
 * 恢复语义：若 task 已为 in-progress 且 startedAt 非空，
 * 则保留原有 startedAt（来自 progress-contract 恢复优先级）。
 *
 * @param {string} filePath - progress.json 绝对路径
 * @param {string} taskId
 * @returns {{ ok: true, data: object }}
 */
export function startTask(filePath, taskId) {
  return withProgressLock(filePath, () => {
    const data = readProgress(filePath)
    const task = findTask(data, taskId)

    if (task.status === 'done') {
      throw new Error(`task "${taskId}" 已为 done，不能重新 start`)
    }

    if (!hasCompletedDeps(data, task)) {
      throw new Error(`task "${taskId}" 仍有未完成依赖，不能 start`)
    }

    const now = ISO_NOW()

    if (task.status !== 'in-progress' || task.startedAt === null) {
      task.status = 'in-progress'
      task.startedAt = now
    }
    // 若已是 in-progress + startedAt 非空，保留原 startedAt（恢复场景）

    data.updatedAt = now

    writeProgress(filePath, data)

    return { ok: true, data }
  })
}

/**
 * 阶段二（成功）：将 task 设为 done，写入完成时间与摘要。
 *
 * 规则（来自 progress-contract 阶段二成功）：
 *   - tasks[].status → 'done'
 *   - tasks[].completedAt → 当前时刻
 *   - tasks[].durationSeconds → completedAt - startedAt（整秒）
 *   - tasks[].output → 摘要（1–200 字符，无换行）
 *   - 顶层 updatedAt 和 lastRun → 更新
 *   - 所有 task 均 done 时写入顶层 completedAt
 *   - 写入后 validateProgressData 校验
 *
 * @param {string} filePath
 * @param {string} taskId
 * @param {string} output - 执行结果摘要
 * @returns {{ ok: true, data: object }}
 */
export function completeTask(filePath, taskId, output) {
  if (typeof output !== 'string' || output.trim() === '') {
    throw new Error('output 不能为空字符串')
  }
  if (output.length > 200) {
    throw new Error(`output 超过最大长度 200 字符（当前 ${output.length} 字符）`)
  }
  if (/[\n\r]/.test(output)) {
    throw new Error('output 不能包含换行符')
  }

  return withProgressLock(filePath, () => {
    const data = readProgress(filePath)
    const task = findTask(data, taskId)

    if (task.status !== 'in-progress') {
      throw new Error(`task "${taskId}" 当前状态为 "${task.status}"，必须先调用 startTask`)
    }

    const now = ISO_NOW()
    const startedMs = task.startedAt ? Date.parse(task.startedAt) : Date.parse(now)
    const durationSeconds = Math.max(0, Math.round((Date.parse(now) - startedMs) / 1000))

    task.status = 'done'
    task.completedAt = now
    task.durationSeconds = durationSeconds
    task.output = output

    data.updatedAt = now
    data.lastRun = {
      taskId: task.id,
      taskName: task.name,
      status: 'done',
      exitStatus: 'succeeded',
      exitReason: '',
      ranAt: now,
    }

    const allDone = data.tasks.every((t) => t.status === 'done')
    if (allDone) {
      data.completedAt = now
    }

    writeProgress(filePath, data)

    return { ok: true, data }
  })
}

/**
 * 阶段二（失败/中断）：保留 in-progress 状态，记录退出原因。
 *
 * 规则（来自 progress-contract 阶段二异常）：
 *   - tasks[].status 保持 'in-progress'
 *   - 不写入 completedAt / durationSeconds / output
 *   - 顶层 updatedAt 和 lastRun → 更新
 *   - 写入后 validateProgressData 校验
 *
 * @param {string} filePath
 * @param {string} taskId
 * @param {'failed'|'aborted'|'blocked'|'timeout'} exitStatus
 * @param {string} exitReason - 非空描述
 * @returns {{ ok: true, data: object }}
 */
export function failTask(filePath, taskId, exitStatus, exitReason) {
  const VALID_EXIT_STATUSES = ['failed', 'aborted', 'blocked', 'timeout']

  if (!VALID_EXIT_STATUSES.includes(exitStatus)) {
    throw new Error(`exitStatus 必须是 ${VALID_EXIT_STATUSES.join(' | ')}，收到 "${exitStatus}"`)
  }

  if (typeof exitReason !== 'string' || exitReason.trim() === '') {
    throw new Error('exitReason 在非 succeeded 时必须为非空字符串')
  }

  return withProgressLock(filePath, () => {
    const data = readProgress(filePath)
    const task = findTask(data, taskId)

    if (task.status !== 'in-progress') {
      throw new Error(`task "${taskId}" 当前状态为 "${task.status}"，必须先调用 startTask`)
    }

    const now = ISO_NOW()

    data.updatedAt = now
    data.lastRun = {
      taskId: task.id,
      taskName: task.name,
      status: 'in-progress',
      exitStatus,
      exitReason,
      ranAt: now,
    }

    writeProgress(filePath, data)

    return { ok: true, data }
  })
}
