import { describe, expect, it, beforeEach, afterEach } from 'bun:test'
import { writeFileSync, mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { startTask, completeTask, failTask } from '../../src/scripts/lib/progress-ops.ts'

// ── helpers ──────────────────────────────────────────────────────────────────

function makeProgressData(overrides = {}) {
  const now = '2024-01-01T00:00:00Z'
  return {
    feature: 'AUTH-001',
    requirementDoc: 'docs/requirement/AUTH-001.md',
    planDoc: 'docs/plans/AUTH-001.md',
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    lastRun: null,
    tasks: [
      {
        id: 'TASK-1',
        name: '实现登录接口',
        status: 'pending',
        dependsOn: [],
        parallelizable: false,
        output: '',
        startedAt: null,
        completedAt: null,
        durationSeconds: null,
      },
    ],
    ...overrides,
  }
}

let tmpDir
let progressFile

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'hxflow-progress-ops-'))
  progressFile = join(tmpDir, 'progress.json')
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true })
})

function writeProgress(data) {
  writeFileSync(progressFile, JSON.stringify(data, null, 2) + '\n', 'utf8')
}

function readProgress() {
  return JSON.parse(readFileSync(progressFile, 'utf8'))
}

// ── startTask ────────────────────────────────────────────────────────────────

describe('startTask', () => {
  it('sets status to in-progress and records startedAt', () => {
    writeProgress(makeProgressData())
    startTask(progressFile, 'TASK-1')
    const data = readProgress()
    expect(data.tasks[0].status).toBe('in-progress')
    expect(data.tasks[0].startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(data.tasks[0].completedAt).toBeNull()
  })

  it('updates top-level updatedAt', () => {
    const original = makeProgressData()
    writeProgress(original)
    startTask(progressFile, 'TASK-1')
    const data = readProgress()
    expect(data.updatedAt).not.toBe(original.updatedAt)
  })

  it('preserves original startedAt when task is already in-progress (recover)', () => {
    const originalStartedAt = '2024-01-01T00:00:00Z'
    const data = makeProgressData()
    data.tasks[0].status = 'in-progress'
    data.tasks[0].startedAt = originalStartedAt
    writeProgress(data)

    startTask(progressFile, 'TASK-1')
    const result = readProgress()
    expect(result.tasks[0].startedAt).toBe(originalStartedAt)
  })

  it('overwrites startedAt when task is in-progress but startedAt is null', () => {
    const data = makeProgressData()
    data.tasks[0].status = 'in-progress'
    data.tasks[0].startedAt = null
    // Note: progress-schema will reject in-progress with null startedAt
    // We directly write without validation to simulate a corrupted state
    writeFileSync(progressFile, JSON.stringify(data, null, 2) + '\n', 'utf8')

    startTask(progressFile, 'TASK-1')
    const result = readProgress()
    expect(result.tasks[0].startedAt).not.toBeNull()
  })

  it('throws when task does not exist', () => {
    writeProgress(makeProgressData())
    expect(() => startTask(progressFile, 'NONEXISTENT')).toThrow(/不存在/)
  })

  it('throws when task is already done', () => {
    const data = makeProgressData()
    data.tasks[0] = {
      ...data.tasks[0],
      status: 'done',
      startedAt: '2024-01-01T00:00:00Z',
      completedAt: '2024-01-01T00:01:00Z',
      durationSeconds: 60,
      output: 'completed',
    }
    data.lastRun = {
      taskId: 'TASK-1',
      taskName: '实现登录接口',
      status: 'done',
      exitStatus: 'succeeded',
      exitReason: '',
      ranAt: '2024-01-01T00:01:00Z',
    }
    data.completedAt = '2024-01-01T00:01:00Z'
    writeProgress(data)
    expect(() => startTask(progressFile, 'TASK-1')).toThrow(/done/)
  })

  it('throws when task dependencies are not done', () => {
    const data = makeProgressData({
      tasks: [
        {
          id: 'TASK-0',
          name: '准备接口字段',
          status: 'pending',
          dependsOn: [],
          parallelizable: false,
          output: '',
          startedAt: null,
          completedAt: null,
          durationSeconds: null,
        },
        {
          id: 'TASK-1',
          name: '实现登录接口',
          status: 'pending',
          dependsOn: ['TASK-0'],
          parallelizable: false,
          output: '',
          startedAt: null,
          completedAt: null,
          durationSeconds: null,
        },
      ],
    })
    writeProgress(data)

    expect(() => startTask(progressFile, 'TASK-1')).toThrow(/未完成依赖/)
  })
})

// ── completeTask ─────────────────────────────────────────────────────────────

describe('completeTask', () => {
  function setupInProgress() {
    const data = makeProgressData()
    data.tasks[0].status = 'in-progress'
    data.tasks[0].startedAt = '2024-01-01T00:00:00.000Z'
    data.updatedAt = '2024-01-01T00:00:00.000Z'
    data.lastRun = {
      taskId: 'TASK-1',
      taskName: '实现登录接口',
      status: 'in-progress',
      exitStatus: 'aborted',
      exitReason: 'start signal',
      ranAt: '2024-01-01T00:00:00Z',
    }
    writeProgress(data)
  }

  it('sets status to done with completedAt, durationSeconds, and output', () => {
    setupInProgress()
    completeTask(progressFile, 'TASK-1', '登录接口实现完成')
    const data = readProgress()
    expect(data.tasks[0].status).toBe('done')
    expect(data.tasks[0].completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(typeof data.tasks[0].durationSeconds).toBe('number')
    expect(data.tasks[0].output).toBe('登录接口实现完成')
  })

  it('sets lastRun.exitStatus to succeeded', () => {
    setupInProgress()
    completeTask(progressFile, 'TASK-1', '登录接口实现完成')
    const data = readProgress()
    expect(data.lastRun.exitStatus).toBe('succeeded')
    expect(data.lastRun.status).toBe('done')
  })

  it('writes top-level completedAt when all tasks are done', () => {
    setupInProgress()
    completeTask(progressFile, 'TASK-1', '登录接口实现完成')
    const data = readProgress()
    expect(data.completedAt).not.toBeNull()
  })

  it('throws when output is empty', () => {
    setupInProgress()
    expect(() => completeTask(progressFile, 'TASK-1', '')).toThrow(/output/)
  })

  it('throws when output exceeds 200 characters', () => {
    setupInProgress()
    const longOutput = 'a'.repeat(201)
    expect(() => completeTask(progressFile, 'TASK-1', longOutput)).toThrow(/200/)
  })

  it('throws when output contains newline', () => {
    setupInProgress()
    expect(() => completeTask(progressFile, 'TASK-1', '第一行\n第二行')).toThrow(/换行/)
  })

  it('throws when task is not in-progress', () => {
    writeProgress(makeProgressData())
    expect(() => completeTask(progressFile, 'TASK-1', 'output')).toThrow(/startTask/)
  })

  it('throws when task does not exist', () => {
    writeProgress(makeProgressData())
    expect(() => completeTask(progressFile, 'NONEXISTENT', 'output')).toThrow(/不存在/)
  })
})

// ── failTask ──────────────────────────────────────────────────────────────────

describe('failTask', () => {
  function setupInProgress() {
    const data = makeProgressData()
    data.tasks[0].status = 'in-progress'
    data.tasks[0].startedAt = '2024-01-01T00:00:00Z'
    data.updatedAt = '2024-01-01T00:00:00Z'
    data.lastRun = {
      taskId: 'TASK-1',
      taskName: '实现登录接口',
      status: 'in-progress',
      exitStatus: 'aborted',
      exitReason: 'initial start',
      ranAt: '2024-01-01T00:00:00Z',
    }
    writeProgress(data)
  }

  it('keeps task as in-progress with updated lastRun', () => {
    setupInProgress()
    failTask(progressFile, 'TASK-1', 'failed', '接口调用超时')
    const data = readProgress()
    expect(data.tasks[0].status).toBe('in-progress')
    expect(data.lastRun.exitStatus).toBe('failed')
    expect(data.lastRun.exitReason).toBe('接口调用超时')
  })

  it('accepts all valid exit statuses', () => {
    const validStatuses = ['failed', 'aborted', 'blocked', 'timeout']
    for (const status of validStatuses) {
      setupInProgress()
      expect(() => failTask(progressFile, 'TASK-1', status, '原因')).not.toThrow()
    }
  })

  it('throws on invalid exitStatus', () => {
    setupInProgress()
    expect(() => failTask(progressFile, 'TASK-1', 'succeeded', '原因')).toThrow(/exitStatus/)
  })

  it('throws when exitReason is empty', () => {
    setupInProgress()
    expect(() => failTask(progressFile, 'TASK-1', 'failed', '')).toThrow(/exitReason/)
  })

  it('throws when task is not in-progress', () => {
    writeProgress(makeProgressData())
    expect(() => failTask(progressFile, 'TASK-1', 'failed', '原因')).toThrow(/startTask/)
  })

  it('does not write completedAt on fail', () => {
    setupInProgress()
    failTask(progressFile, 'TASK-1', 'failed', '失败了')
    const data = readProgress()
    expect(data.completedAt).toBeNull()
  })
})
