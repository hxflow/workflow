import { readFileSync } from 'fs'
import { resolve } from 'path'

import { FRAMEWORK_ROOT } from './resolve-context.ts'

const PROGRESS_TEMPLATE_PATH = resolve(FRAMEWORK_ROOT, 'templates/progress.json')
const PROGRESS_SCHEMA_PATH = resolve(FRAMEWORK_ROOT, 'templates/progress.schema.json')
const ISO_DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/
const TASK_STATUSES = ['pending', 'in-progress', 'done']
const RUN_EXIT_STATUSES = ['succeeded', 'failed', 'aborted', 'blocked', 'timeout']

let cachedTemplateKeys = null
let cachedTaskKeys = null
let cachedSchema = null

export function readProgressSchema() {
  if (!cachedSchema) {
    cachedSchema = JSON.parse(readFileSync(PROGRESS_SCHEMA_PATH, 'utf8'))
  }

  return cachedSchema
}

export function readProgressTemplate() {
  const template = JSON.parse(readFileSync(PROGRESS_TEMPLATE_PATH, 'utf8'))

  if (!cachedTemplateKeys) {
    cachedTemplateKeys = Object.keys(template)
    cachedTaskKeys = Object.keys(template.tasks[0])
  }

  return template
}

export function getProgressSchemaPaths() {
  return {
    schemaPath: PROGRESS_SCHEMA_PATH,
    templatePath: PROGRESS_TEMPLATE_PATH,
  }
}

export function readProgressFile(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'))
}

export function validateProgressFile(filePath) {
  let data = null

  try {
    data = readProgressFile(filePath)
  } catch (error) {
    return {
      valid: false,
      filePath,
      data: null,
      errors: [`progress.json 解析失败: ${error.message}`],
    }
  }

  const result = validateProgressData(data)

  return {
    ...result,
    filePath,
    data,
  }
}

export function validateProgressData(data) {
  const errors = []
  const template = readProgressTemplate()
  const topLevelKeys = cachedTemplateKeys || Object.keys(template)
  const taskKeys = cachedTaskKeys || Object.keys(template.tasks[0])

  if (!isPlainObject(data)) {
    return { valid: false, errors: ['progress.json 必须是 object'] }
  }

  validateExactKeys(data, topLevelKeys, '顶层字段', errors)

  validateNonEmptyString(data.feature, 'feature', errors)
  validateNonEmptyString(data.requirementDoc, 'requirementDoc', errors)
  validateNonEmptyString(data.planDoc, 'planDoc', errors)
  validateIsoDateTime(data.createdAt, 'createdAt', errors)
  validateIsoDateTime(data.updatedAt, 'updatedAt', errors)
  validateNullableIsoDateTime(data.completedAt, 'completedAt', errors)

  validateLastRun(data.lastRun, errors)

  if (!Array.isArray(data.tasks) || data.tasks.length === 0) {
    errors.push('tasks 必须是非空数组')
  } else {
    const taskIds = new Set()
    for (const [index, task] of data.tasks.entries()) {
      const label = `tasks[${index}]`
      if (!isPlainObject(task)) {
        errors.push(`${label} 必须是 object`)
        continue
      }

      validateExactKeys(task, taskKeys, `${label} 字段`, errors)
      validateNonEmptyString(task.id, `${label}.id`, errors)
      validateNonEmptyString(task.name, `${label}.name`, errors)
      validateTaskStatus(task.status, `${label}.status`, errors)
      validateDependsOn(task.dependsOn, `${label}.dependsOn`, errors)

      if (typeof task.parallelizable !== 'boolean') {
        errors.push(`${label}.parallelizable 必须是 boolean`)
      }

      validateOutput(task.output, task.status, label, errors)

      validateNullableIsoDateTime(task.startedAt, `${label}.startedAt`, errors)
      validateNullableIsoDateTime(task.completedAt, `${label}.completedAt`, errors)
      validateNullableDuration(task.durationSeconds, `${label}.durationSeconds`, errors)

      if (task.id) {
        if (taskIds.has(task.id)) {
          errors.push(`tasks 中存在重复 id: ${task.id}`)
        } else {
          taskIds.add(task.id)
        }
      }
    }

    validateTaskGraph(data.tasks, errors)
    validateTaskStateConsistency(data.tasks, errors)
    validateLastRunConsistency(data.lastRun, data.tasks, errors)
    validateFeatureCompletion(data.completedAt, data.tasks, errors)
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

function validateLastRun(value, errors) {
  if (value === null) {
    return
  }

  if (!isPlainObject(value)) {
    errors.push('lastRun 只能为 null 或固定 6 字段对象')
    return
  }

  const expectedKeys = ['taskId', 'taskName', 'status', 'exitStatus', 'exitReason', 'ranAt']
  validateExactKeys(value, expectedKeys, 'lastRun 字段', errors)
  validateNonEmptyString(value.taskId, 'lastRun.taskId', errors)
  validateNonEmptyString(value.taskName, 'lastRun.taskName', errors)
  validateLastRunStatus(value.status, 'lastRun.status', errors)
  validateRunExitStatus(value.exitStatus, 'lastRun.exitStatus', errors)
  validateExitReason(value.exitReason, value.exitStatus, 'lastRun.exitReason', errors)
  validateIsoDateTime(value.ranAt, 'lastRun.ranAt', errors)
}

function validateTaskGraph(tasks, errors) {
  const taskMap = new Map(tasks.map((task) => [task.id, task]))

  for (const task of tasks) {
    for (const depId of task.dependsOn || []) {
      if (!taskMap.has(depId)) {
        errors.push(`task ${task.id} 的 dependsOn 引用了不存在的 task: ${depId}`)
      }

      if (depId === task.id) {
        errors.push(`task ${task.id} 不允许依赖自己`)
      }
    }
  }

  const visited = new Set()
  const visiting = new Set()

  function dfs(taskId) {
    if (visiting.has(taskId)) {
      errors.push(`tasks 依赖图存在循环: ${taskId}`)
      return
    }
    if (visited.has(taskId) || !taskMap.has(taskId)) {
      return
    }

    visiting.add(taskId)
    for (const depId of (taskMap.get(taskId).dependsOn ?? [])) {
      dfs(depId)
    }
    visiting.delete(taskId)
    visited.add(taskId)
  }

  for (const task of tasks) {
    dfs(task.id)
  }
}

function validateTaskStateConsistency(tasks, errors) {
  for (const task of tasks) {
    if (task.status === 'pending') {
      if (task.startedAt !== null) {
        errors.push(`task ${task.id} 为 pending 时 startedAt 必须为 null`)
      }
      if (task.completedAt !== null) {
        errors.push(`task ${task.id} 为 pending 时 completedAt 必须为 null`)
      }
      if (task.durationSeconds !== null) {
        errors.push(`task ${task.id} 为 pending 时 durationSeconds 必须为 null`)
      }
      continue
    }

    if (task.status === 'in-progress') {
      if (task.startedAt === null) {
        errors.push(`task ${task.id} 为 in-progress 时 startedAt 不能为空`)
      }
      if (task.completedAt !== null) {
        errors.push(`task ${task.id} 为 in-progress 时 completedAt 必须为 null`)
      }
      if (task.durationSeconds !== null) {
        errors.push(`task ${task.id} 为 in-progress 时 durationSeconds 必须为 null`)
      }
      continue
    }

    if (task.status === 'done') {
      if (task.startedAt === null) {
        errors.push(`task ${task.id} 为 done 时 startedAt 不能为空`)
      }
      if (task.completedAt === null) {
        errors.push(`task ${task.id} 为 done 时 completedAt 不能为空`)
      }
      if (task.durationSeconds === null) {
        errors.push(`task ${task.id} 为 done 时 durationSeconds 不能为空`)
      }
    }
  }
}

function validateLastRunConsistency(lastRun, tasks, errors) {
  if (lastRun == null) {
    return
  }

  const task = tasks.find((item) => item.id === lastRun.taskId)
  if (!task) {
    errors.push(`lastRun.taskId 未匹配到 task: ${lastRun.taskId}`)
    return
  }

  if (task.name !== lastRun.taskName) {
    errors.push(`lastRun.taskName 与 task ${task.id} 的 name 不一致`)
  }

  if (task.status !== lastRun.status) {
    errors.push(`lastRun.status 与 task ${task.id} 的 status 不一致`)
  }

  if (lastRun.exitStatus === 'succeeded' && task.status !== 'done') {
    errors.push(`lastRun.exitStatus 为 succeeded 时，task ${task.id} 的 status 必须为 done`)
  }

  if (lastRun.exitStatus !== 'succeeded' && task.status !== 'in-progress') {
    errors.push(`lastRun.exitStatus 为 ${lastRun.exitStatus} 时，task ${task.id} 的 status 必须为 in-progress`)
  }

  if (task.startedAt && Date.parse(lastRun.ranAt) < Date.parse(task.startedAt)) {
    errors.push(`lastRun.ranAt 不能早于 task ${task.id} 的 startedAt`)
  }

  if (task.completedAt && Date.parse(lastRun.ranAt) < Date.parse(task.completedAt)) {
    errors.push(`lastRun.ranAt 不能早于 task ${task.id} 的 completedAt`)
  }
}

function validateFeatureCompletion(completedAt, tasks, errors) {
  const allDone = tasks.every((task) => task.status === 'done')

  if (allDone && completedAt === null) {
    errors.push('所有 task 已完成时 completedAt 不能为空')
  }

  if (!allDone && completedAt !== null) {
    errors.push('存在未完成 task 时 completedAt 必须为 null')
  }
}

function validateExactKeys(value, expectedKeys, label, errors) {
  const actualKeys = Object.keys(value)
  const missing = expectedKeys.filter((key) => !actualKeys.includes(key))
  const extra = actualKeys.filter((key) => !expectedKeys.includes(key))

  if (missing.length > 0) {
    errors.push(`${label} 缺少字段: ${missing.join(', ')}`)
  }

  if (extra.length > 0) {
    errors.push(`${label} 存在未定义字段: ${extra.join(', ')}`)
  }
}

function validateNonEmptyString(value, label, errors) {
  if (typeof value !== 'string' || value.trim() === '') {
    errors.push(`${label} 必须是非空 string`)
  }
}

function validateTaskStatus(value, label, errors) {
  if (typeof value !== 'string' || !TASK_STATUSES.includes(value)) {
    errors.push(`${label} 必须是 ${TASK_STATUSES.join(' | ')}`)
  }
}

function validateLastRunStatus(value, label, errors) {
  const allowedStatuses = TASK_STATUSES.filter((status) => status !== 'pending')

  if (typeof value !== 'string' || !allowedStatuses.includes(value)) {
    errors.push(`${label} 必须是 ${allowedStatuses.join(' | ')}`)
  }
}

function validateRunExitStatus(value, label, errors) {
  if (typeof value !== 'string' || !RUN_EXIT_STATUSES.includes(value)) {
    errors.push(`${label} 必须是 ${RUN_EXIT_STATUSES.join(' | ')}`)
  }
}

function validateExitReason(value, exitStatus, label, errors) {
  if (typeof value !== 'string') {
    errors.push(`${label} 必须是 string`)
    return
  }

  if (exitStatus && exitStatus !== 'succeeded' && value.trim() === '') {
    errors.push(`${label} 在 exitStatus 非 succeeded 时必须为非空 string`)
  }
}

function validateDependsOn(value, label, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${label} 必须是 string[]`)
    return
  }

  for (const depId of value) {
    if (typeof depId !== 'string' || depId.trim() === '') {
      errors.push(`${label} 只能包含非空 string`)
    }
  }
}

function validateIsoDateTime(value, label, errors) {
  if (typeof value !== 'string' || !ISO_DATE_TIME_RE.test(value) || Number.isNaN(Date.parse(value))) {
    errors.push(`${label} 必须是合法的 ISO 8601 时间字符串`)
  }
}

function validateNullableIsoDateTime(value, label, errors) {
  if (value === null) {
    return
  }

  validateIsoDateTime(value, label, errors)
}

function validateNullableDuration(value, label, errors) {
  if (value === null) {
    return
  }

  if (!Number.isInteger(value) || value < 0) {
    errors.push(`${label} 必须是非负整数或 null`)
  }
}

function validateOutput(value, status, label, errors) {
  if (typeof value !== 'string') {
    errors.push(`${label}.output 必须是 string`)
    return
  }

  if (status === 'pending' || status === 'in-progress') {
    if (value !== '') {
      errors.push(`${label}.output 在 status 为 ${status} 时必须为空字符串`)
    }
    return
  }

  if (status === 'done') {
    if (value.trim() === '') {
      errors.push(`${label}.output 在 status 为 done 时不能为空`)
    } else if (value.length > 200) {
      errors.push(`${label}.output 超过最大长度 200 字符（当前 ${value.length} 字符）`)
    }
    if (/[\n\r]/.test(value)) {
      errors.push(`${label}.output 不能包含换行符`)
    }
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
