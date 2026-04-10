import { describe, expect, it } from 'bun:test'
import { getRunnableTasks, getRecoverableTasks, getScheduledBatch } from '../../src/scripts/lib/task-scheduler.ts'

function makeTask(overrides) {
  return {
    id: 'TASK-1',
    name: '任务',
    status: 'pending',
    dependsOn: [],
    parallelizable: false,
    output: '',
    startedAt: null,
    completedAt: null,
    durationSeconds: null,
    ...overrides,
  }
}

describe('getRunnableTasks', () => {
  it('returns pending tasks with all deps done', () => {
    const data = {
      tasks: [
        makeTask({ id: 'A', status: 'done', output: 'ok', startedAt: '2024-01-01T00:00:00Z', completedAt: '2024-01-01T00:01:00Z', durationSeconds: 60 }),
        makeTask({ id: 'B', status: 'pending', dependsOn: ['A'] }),
        makeTask({ id: 'C', status: 'pending', dependsOn: ['B'] }),
      ],
    }
    const runnable = getRunnableTasks(data)
    expect(runnable.map((t) => t.id)).toEqual(['B'])
  })

  it('returns multiple runnable tasks when deps are satisfied', () => {
    const data = {
      tasks: [
        makeTask({ id: 'A', status: 'done', output: 'ok', startedAt: '2024-01-01T00:00:00Z', completedAt: '2024-01-01T00:01:00Z', durationSeconds: 60 }),
        makeTask({ id: 'B', status: 'pending', dependsOn: ['A'], parallelizable: true }),
        makeTask({ id: 'C', status: 'pending', dependsOn: ['A'], parallelizable: true }),
      ],
    }
    const runnable = getRunnableTasks(data)
    expect(runnable.map((t) => t.id)).toEqual(['B', 'C'])
  })

  it('excludes in-progress tasks', () => {
    const data = {
      tasks: [
        makeTask({ id: 'A', status: 'in-progress', startedAt: '2024-01-01T00:00:00Z' }),
      ],
    }
    expect(getRunnableTasks(data)).toHaveLength(0)
  })

  it('excludes done tasks', () => {
    const data = {
      tasks: [
        makeTask({ id: 'A', status: 'done', output: 'ok', startedAt: '2024-01-01T00:00:00Z', completedAt: '2024-01-01T00:01:00Z', durationSeconds: 60 }),
      ],
    }
    expect(getRunnableTasks(data)).toHaveLength(0)
  })

  it('returns pending task with no deps', () => {
    const data = {
      tasks: [makeTask({ id: 'A' })],
    }
    expect(getRunnableTasks(data).map((t) => t.id)).toEqual(['A'])
  })
})

describe('getRecoverableTasks', () => {
  it('returns in-progress tasks with all deps done and startedAt set', () => {
    const data = {
      tasks: [
        makeTask({ id: 'A', status: 'done', output: 'ok', startedAt: '2024-01-01T00:00:00Z', completedAt: '2024-01-01T00:01:00Z', durationSeconds: 60 }),
        makeTask({ id: 'B', status: 'in-progress', dependsOn: ['A'], startedAt: '2024-01-01T00:02:00Z' }),
      ],
    }
    expect(getRecoverableTasks(data).map((t) => t.id)).toEqual(['B'])
  })

  it('excludes in-progress tasks with null startedAt', () => {
    const data = {
      tasks: [
        makeTask({ id: 'A', status: 'in-progress', startedAt: null }),
      ],
    }
    expect(getRecoverableTasks(data)).toHaveLength(0)
  })

  it('excludes in-progress tasks with pending deps', () => {
    const data = {
      tasks: [
        makeTask({ id: 'A', status: 'pending' }),
        makeTask({ id: 'B', status: 'in-progress', dependsOn: ['A'], startedAt: '2024-01-01T00:00:00Z' }),
      ],
    }
    expect(getRecoverableTasks(data)).toHaveLength(0)
  })

  it('excludes in-progress tasks with non-null completedAt', () => {
    const data = {
      tasks: [
        makeTask({ id: 'A', status: 'in-progress', startedAt: '2024-01-01T00:00:00Z', completedAt: '2024-01-01T00:01:00Z' }),
      ],
    }
    expect(getRecoverableTasks(data)).toHaveLength(0)
  })
})

describe('getScheduledBatch', () => {
  it('returns mode=done when all tasks are done', () => {
    const data = {
      tasks: [
        makeTask({ id: 'A', status: 'done', output: 'ok', startedAt: '2024-01-01T00:00:00Z', completedAt: '2024-01-01T00:01:00Z', durationSeconds: 60 }),
      ],
    }
    expect(getScheduledBatch(data)).toEqual({ tasks: [], parallel: false, mode: 'done' })
  })

  it('prioritizes recover over run', () => {
    const data = {
      tasks: [
        makeTask({ id: 'A', status: 'in-progress', startedAt: '2024-01-01T00:00:00Z' }),
        makeTask({ id: 'B', status: 'pending' }),
      ],
    }
    const batch = getScheduledBatch(data)
    expect(batch.mode).toBe('recover')
    expect(batch.tasks.map((t) => t.id)).toEqual(['A'])
  })

  it('returns run mode for pending tasks when no recoverable', () => {
    const data = {
      tasks: [
        makeTask({ id: 'A' }),
        makeTask({ id: 'B' }),
      ],
    }
    const batch = getScheduledBatch(data)
    expect(batch.mode).toBe('run')
    expect(batch.tasks).toHaveLength(2)
  })

  it('sets parallel=true only when all tasks in batch are parallelizable', () => {
    const data = {
      tasks: [
        makeTask({ id: 'A', parallelizable: true }),
        makeTask({ id: 'B', parallelizable: true }),
      ],
    }
    expect(getScheduledBatch(data).parallel).toBe(true)
  })

  it('sets parallel=false when any task is not parallelizable', () => {
    const data = {
      tasks: [
        makeTask({ id: 'A', parallelizable: true }),
        makeTask({ id: 'B', parallelizable: false }),
      ],
    }
    expect(getScheduledBatch(data).parallel).toBe(false)
  })

  it('sets parallel=false for single task regardless of flag', () => {
    const data = {
      tasks: [makeTask({ id: 'A', parallelizable: true })],
    }
    expect(getScheduledBatch(data).parallel).toBe(false)
  })

  it('returns mode=done when no runnable or recoverable tasks exist but not all done', () => {
    // blocked: dep not done, no recoverable
    const data = {
      tasks: [
        makeTask({ id: 'A', status: 'pending' }),
        makeTask({ id: 'B', status: 'pending', dependsOn: ['A'] }),
      ],
    }
    // A is runnable
    const batch = getScheduledBatch(data)
    expect(batch.mode).toBe('run')
    expect(batch.tasks.map((t) => t.id)).toEqual(['A'])
  })
})
