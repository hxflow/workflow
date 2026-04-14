import { describe, expect, it } from 'bun:test'

import {
  getProgressSchemaPaths,
  readProgressSchema,
  readProgressFile,
  readProgressTemplate,
  validateProgressData,
  validateProgressFile,
} from '../../src/lib/progress-schema.ts'
import { mkdtempSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

function buildValidProgress() {
  return {
    feature: 'user-login',
    requirementDoc: 'docs/requirement/user-login.md',
    planDoc: 'docs/plans/user-login.md',
    createdAt: '2026-04-01T10:00:00+08:00',
    updatedAt: '2026-04-01T10:30:00+08:00',
    completedAt: null,
    lastRun: {
      taskId: 'TASK-BE-01',
      taskName: '新增手机号登录接口',
      status: 'done',
      exitStatus: 'succeeded',
      exitReason: '',
      ranAt: '2026-04-01T10:30:00+08:00',
    },
    tasks: [
      {
        id: 'TASK-BE-01',
        name: '新增手机号登录接口',
        status: 'done',
        dependsOn: [],
        parallelizable: false,
        output: '接口已实现并通过测试',
        startedAt: '2026-04-01T10:10:00+08:00',
        completedAt: '2026-04-01T10:30:00+08:00',
        durationSeconds: 1200,
      },
      {
        id: 'TASK-FE-01',
        name: '接入手机号登录表单',
        status: 'pending',
        dependsOn: ['TASK-BE-01'],
        parallelizable: true,
        output: '',
        startedAt: null,
        completedAt: null,
        durationSeconds: null,
      },
    ],
  }
}

describe('progress runtime validation', () => {
  it('exposes stable schema and template paths', () => {
    const paths = getProgressSchemaPaths()

    expect(paths.schemaPath.endsWith('src/templates/progress.schema.json')).toBe(true)
    expect(paths.templatePath.endsWith('src/templates/progress.json')).toBe(true)
  })

  it('reads the fixed schema and template assets', () => {
    const schema = readProgressSchema()
    const template = readProgressTemplate()

    expect(schema.$id).toContain('progress.schema.json')
    expect(template.lastRun).toBe(null)
    expect(template.tasks[0].parallelizable).toBe(false)
  })

  it('reads a progress file from disk', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hx-progress-'))
    const filePath = join(dir, 'feature-progress.json')
    const progress = buildValidProgress()
    writeFileSync(filePath, JSON.stringify(progress, null, 2), 'utf8')

    expect(readProgressFile(filePath)).toEqual(progress)
  })

  it('accepts a valid progress object', () => {
    const result = validateProgressData(buildValidProgress())

    expect(result).toEqual({
      valid: true,
      errors: [],
    })
  })

  it('validates a progress file from disk', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hx-progress-'))
    const filePath = join(dir, 'feature-progress.json')
    const progress = buildValidProgress()
    writeFileSync(filePath, JSON.stringify(progress, null, 2), 'utf8')

    expect(validateProgressFile(filePath)).toEqual({
      valid: true,
      filePath,
      data: progress,
      errors: [],
    })
  })

  it('rejects extra fields and malformed lastRun', () => {
    const progress = buildValidProgress()
    progress.extra = true
    progress.lastRun = {
      taskId: 'TASK-BE-01',
      status: 'done',
      exitStatus: 'failed',
      exitReason: '',
      ranAt: '2026-04-01T10:30:00+08:00',
    }

    const result = validateProgressData(progress)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('顶层字段 存在未定义字段: extra')
    expect(result.errors).toContain('lastRun 字段 缺少字段: taskName')
    expect(result.errors).toContain('lastRun.exitReason 在 exitStatus 非 succeeded 时必须为非空 string')
  })

  it('rejects dependency cycles and invalid task state combinations', () => {
    const progress = buildValidProgress()
    progress.lastRun = null
    progress.tasks[0].dependsOn = ['TASK-FE-01']
    progress.tasks[1].status = 'in-progress'
    progress.tasks[1].startedAt = null
    progress.tasks[1].completedAt = '2026-04-01T10:50:00+08:00'
    progress.tasks[1].durationSeconds = 600

    const result = validateProgressData(progress)

    expect(result.valid).toBe(false)
    expect(result.errors.some((message) => message.includes('循环'))).toBe(true)
    expect(result.errors).toContain('task TASK-FE-01 为 in-progress 时 startedAt 不能为空')
    expect(result.errors).toContain('task TASK-FE-01 为 in-progress 时 completedAt 必须为 null')
    expect(result.errors).toContain('task TASK-FE-01 为 in-progress 时 durationSeconds 必须为 null')
  })

  it('rejects inconsistent lastRun snapshots', () => {
    const progress = buildValidProgress()
    progress.lastRun = {
      taskId: 'TASK-BE-01',
      taskName: '错误任务名',
      status: 'pending',
      exitStatus: 'failed',
      exitReason: '测试失败',
      ranAt: '2026-04-01T10:05:00+08:00',
    }

    const result = validateProgressData(progress)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('lastRun.taskName 与 task TASK-BE-01 的 name 不一致')
    expect(result.errors).toContain('lastRun.status 必须是 in-progress | done')
    expect(result.errors).toContain('lastRun.exitStatus 为 failed 时，task TASK-BE-01 的 status 必须为 in-progress')
    expect(result.errors).toContain('lastRun.ranAt 不能早于 task TASK-BE-01 的 startedAt')
  })

  it('rejects pending tasks recorded as failed lastRun', () => {
    const progress = buildValidProgress()
    progress.lastRun = {
      taskId: 'TASK-FE-01',
      taskName: '接入手机号登录表单',
      status: 'in-progress',
      exitStatus: 'failed',
      exitReason: '执行中断',
      ranAt: '2026-04-01T10:45:00+08:00',
    }

    const result = validateProgressData(progress)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('lastRun.status 与 task TASK-FE-01 的 status 不一致')
    expect(result.errors).toContain('lastRun.exitStatus 为 failed 时，task TASK-FE-01 的 status 必须为 in-progress')
  })

  it('accepts unfinished runs when exitStatus carries the failure reason', () => {
    const progress = buildValidProgress()
    progress.lastRun = {
      taskId: 'TASK-FE-01',
      taskName: '接入手机号登录表单',
      status: 'in-progress',
      exitStatus: 'blocked',
      exitReason: '接口联调环境不可用',
      ranAt: '2026-04-01T10:45:00+08:00',
    }
    progress.tasks[1].status = 'in-progress'
    progress.tasks[1].startedAt = '2026-04-01T10:40:00+08:00'

    const result = validateProgressData(progress)

    expect(result).toEqual({
      valid: true,
      errors: [],
    })
  })

  it('rejects output violations by status', () => {
    const base = buildValidProgress()

    // done task 不能为空
    const emptyOutput = structuredClone(base)
    emptyOutput.tasks[0].output = ''
    expect(validateProgressData(emptyOutput).errors).toContain(
      'tasks[0].output 在 status 为 done 时不能为空'
    )

    // done task 超过 200 字符
    const longOutput = structuredClone(base)
    longOutput.tasks[0].output = 'x'.repeat(201)
    expect(validateProgressData(longOutput).errors).toContain(
      `tasks[0].output 超过最大长度 200 字符（当前 201 字符）`
    )

    // done task 包含换行符
    const newlineOutput = structuredClone(base)
    newlineOutput.tasks[0].output = '新增文件\n单元测试通过'
    expect(validateProgressData(newlineOutput).errors).toContain(
      'tasks[0].output 不能包含换行符'
    )

    // pending task output 必须为空字符串
    const pendingNonEmpty = structuredClone(base)
    pendingNonEmpty.tasks[1].output = '提前写入'
    expect(validateProgressData(pendingNonEmpty).errors).toContain(
      'tasks[1].output 在 status 为 pending 时必须为空字符串'
    )

    // in-progress task output 必须为空字符串
    const inProgress = structuredClone(base)
    inProgress.lastRun = {
      taskId: 'TASK-FE-01',
      taskName: '接入手机号登录表单',
      status: 'in-progress',
      exitStatus: 'blocked',
      exitReason: '接口联调环境不可用',
      ranAt: '2026-04-01T10:45:00+08:00',
    }
    inProgress.tasks[1].status = 'in-progress'
    inProgress.tasks[1].startedAt = '2026-04-01T10:40:00+08:00'
    inProgress.tasks[1].output = '执行中...'
    expect(validateProgressData(inProgress).errors).toContain(
      'tasks[1].output 在 status 为 in-progress 时必须为空字符串'
    )
  })

  it('accepts output at boundary length', () => {
    const progress = buildValidProgress()
    progress.tasks[0].output = 'x'.repeat(200)
    expect(validateProgressData(progress)).toEqual({ valid: true, errors: [] })
  })

  it('rejects completedAt when feature is not fully done', () => {
    const progress = buildValidProgress()
    progress.completedAt = '2026-04-01T11:00:00+08:00'

    const result = validateProgressData(progress)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('存在未完成 task 时 completedAt 必须为 null')
  })

  it('returns a file-level parse error for invalid json', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hx-progress-'))
    const filePath = join(dir, 'feature-progress.json')
    writeFileSync(filePath, '{"feature":', 'utf8')

    const result = validateProgressFile(filePath)

    expect(result.valid).toBe(false)
    expect(result.filePath).toBe(filePath)
    expect(result.data).toBe(null)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('progress.json 解析失败:')
  })
})
