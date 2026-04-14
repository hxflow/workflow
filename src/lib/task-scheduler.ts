/**
 * task-scheduler.js — progress.json 调度逻辑
 *
 * 把 progress-contract 中「可执行 task 判定」、「可恢复 task 判定」、
 * 「串行与并行」等确定性规则固化为代码，供 hx-progress.js 和测试调用。
 */

/**
 * 从 progressData 中找出所有「可恢复」的 in-progress task。
 *
 * 可恢复条件（来自 progress-contract）：
 *   - status === 'in-progress'
 *   - startedAt 非空
 *   - completedAt === null
 *   - dependsOn 中所有 task 均为 done
 *
 * @param {object} progressData - 已解析的 progress.json 对象
 * @returns {Array<object>} 可恢复的 task 列表
 */
export function getRecoverableTasks(progressData) {
  const doneIds = new Set(
    progressData.tasks.filter((t) => t.status === 'done').map((t) => t.id)
  )

  return progressData.tasks.filter(
    (t) =>
      t.status === 'in-progress' &&
      t.startedAt !== null &&
      t.completedAt === null &&
      t.dependsOn.every((depId) => doneIds.has(depId))
  )
}

/**
 * 从 progressData 中找出所有「可运行」的 pending task。
 *
 * 可运行条件（来自 progress-contract）：
 *   - status === 'pending'
 *   - dependsOn 中所有 task 均为 done
 *
 * @param {object} progressData - 已解析的 progress.json 对象
 * @returns {Array<object>} 可运行的 task 列表
 */
export function getRunnableTasks(progressData) {
  const doneIds = new Set(
    progressData.tasks.filter((t) => t.status === 'done').map((t) => t.id)
  )

  return progressData.tasks.filter(
    (t) =>
      t.status === 'pending' && t.dependsOn.every((depId) => doneIds.has(depId))
  )
}

/**
 * 获取当前应执行的任务批次。
 *
 * 优先级规则（来自 progress-contract）：
 *   1. 先恢复 recoverable in-progress task
 *   2. 再执行 runnable pending task
 *
 * 并行条件：
 *   - 同一批次内所有 task 的 parallelizable === true
 *   - 批次内 task 数量 > 1
 *
 * @param {object} progressData - 已解析的 progress.json 对象
 * @returns {{ tasks: Array<object>, parallel: boolean, mode: 'recover' | 'run' | 'done' }}
 *   - mode='done' 表示所有 task 已完成，无需执行
 */
export function getScheduledBatch(progressData) {
  const recoverable = getRecoverableTasks(progressData)

  if (recoverable.length > 0) {
    const parallel =
      recoverable.length > 1 && recoverable.every((t) => t.parallelizable)
    return { tasks: recoverable, parallel, mode: 'recover' }
  }

  const runnable = getRunnableTasks(progressData)

  if (runnable.length === 0) {
    return { tasks: [], parallel: false, mode: 'done' }
  }

  const parallel = runnable.length > 1 && runnable.every((t) => t.parallelizable)
  return { tasks: runnable, parallel, mode: 'run' }
}
