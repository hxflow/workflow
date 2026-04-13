import { spawnSync } from 'child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'

import { afterEach, describe, expect, it } from 'bun:test'

const REPO_ROOT = resolve(import.meta.dir, '..', '..')
const SCRIPTS_DIR = resolve(REPO_ROOT, 'src', 'scripts')

const tempDirs: string[] = []

function createTempProject(): string {
  const dir = mkdtempSync(resolve(tmpdir(), 'hx-wf-'))
  tempDirs.push(dir)
  mkdirSync(resolve(dir, 'docs', 'plans'), { recursive: true })
  mkdirSync(resolve(dir, 'docs', 'requirement'), { recursive: true })
  return dir
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true })
  }
})

function run(script: string, args: string[], cwd: string) {
  return spawnSync(process.execPath, [resolve(SCRIPTS_DIR, script), ...args], {
    cwd,
    encoding: 'utf8',
  })
}

// ─── progress fixtures ────────────────────────────────────────────────────────

const NOW = '2026-01-01T00:00:00.000Z'
const LATER = '2026-01-01T01:00:00.000Z'

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 't1',
    name: 'Task 1',
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

function makeDoneTask(id: string, name: string, dependsOn: string[] = []) {
  return makeTask({
    id,
    name,
    status: 'done',
    dependsOn,
    output: `${id} completed`,
    startedAt: NOW,
    completedAt: LATER,
    durationSeconds: 60,
  })
}

function baseProgress(feature: string, tasks: object[], extra: Record<string, unknown> = {}) {
  return {
    feature,
    requirementDoc: `docs/requirement/${feature.toLowerCase()}.md`,
    planDoc: `docs/plans/${feature.toLowerCase()}.md`,
    createdAt: NOW,
    updatedAt: NOW,
    completedAt: null,
    lastRun: null,
    tasks,
    ...extra,
  }
}

function writeProgress(projectRoot: string, feature: string, data: object): string {
  const filePath = resolve(projectRoot, 'docs', 'plans', `${feature.toLowerCase()}-progress.json`)
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
  return filePath
}

function writePlanDoc(projectRoot: string, feature: string): string {
  const filePath = resolve(projectRoot, 'docs', 'plans', `${feature.toLowerCase()}.md`)
  writeFileSync(filePath, `# Plan: ${feature}\n\nPlan content.\n`, 'utf8')
  return filePath
}

function writeRequirementDoc(projectRoot: string, feature: string): string {
  const filePath = resolve(projectRoot, 'docs', 'requirement', `${feature.toLowerCase()}.md`)
  const content = [
    `# Requirement`,
    ``,
    `> Feature: ${feature}`,
    `> Display Name: Test Feature`,
    `> Source ID: TSK-001`,
    `> Source Fingerprint: abc123`,
    ``,
    `## Overview`,
    ``,
    `Some requirement text.`,
  ].join('\n')
  writeFileSync(filePath, content, 'utf8')
  return filePath
}

// ─── hx progress ─────────────────────────────────────────────────────────────

describe('hx progress integration', () => {
  describe('next', () => {
    it('returns the first runnable task in run mode', () => {
      const project = createTempProject()
      const data = baseProgress('TEST-001', [makeTask({ id: 't1', name: 'Task 1' })])
      const filePath = writeProgress(project, 'TEST-001', data)

      const result = run('hx-progress.ts', ['next', filePath], project)

      expect(result.status).toBe(0)
      const out = JSON.parse(result.stdout)
      expect(out.ok).toBe(true)
      expect(out.mode).toBe('run')
      expect(out.tasks).toEqual([{ id: 't1', name: 'Task 1' }])
    })

    it('returns mode=recover when a task is already in-progress', () => {
      const project = createTempProject()
      const data = baseProgress('TEST-001', [
        makeTask({ id: 't1', name: 'Task 1', status: 'in-progress', startedAt: NOW }),
      ])
      const filePath = writeProgress(project, 'TEST-001', data)

      const result = run('hx-progress.ts', ['next', filePath], project)

      expect(result.status).toBe(0)
      const out = JSON.parse(result.stdout)
      expect(out.mode).toBe('recover')
      expect(out.tasks[0].id).toBe('t1')
    })

    it('returns mode=done when all tasks are done', () => {
      const project = createTempProject()
      const data = baseProgress('TEST-001', [makeDoneTask('t1', 'Task 1')], {
        completedAt: LATER,
        lastRun: {
          taskId: 't1',
          taskName: 'Task 1',
          status: 'done',
          exitStatus: 'succeeded',
          exitReason: '',
          ranAt: LATER,
        },
      })
      const filePath = writeProgress(project, 'TEST-001', data)

      const result = run('hx-progress.ts', ['next', filePath], project)

      expect(result.status).toBe(0)
      const out = JSON.parse(result.stdout)
      expect(out.mode).toBe('done')
      expect(out.tasks).toEqual([])
    })

    it('returns parallel=true for a parallel batch', () => {
      const project = createTempProject()
      const data = baseProgress('TEST-001', [
        makeTask({ id: 'p1', name: 'P1', parallelizable: true }),
        makeTask({ id: 'p2', name: 'P2', parallelizable: true }),
      ])
      const filePath = writeProgress(project, 'TEST-001', data)

      const result = run('hx-progress.ts', ['next', filePath], project)

      expect(result.status).toBe(0)
      const out = JSON.parse(result.stdout)
      expect(out.parallel).toBe(true)
      expect(out.tasks).toHaveLength(2)
    })

    it('blocks dependent task until its dependency is done', () => {
      const project = createTempProject()
      const data = baseProgress('TEST-001', [
        makeTask({ id: 't1', name: 'Task 1' }),
        makeTask({ id: 't2', name: 'Task 2', dependsOn: ['t1'] }),
      ])
      const filePath = writeProgress(project, 'TEST-001', data)

      const result = run('hx-progress.ts', ['next', filePath], project)

      expect(result.status).toBe(0)
      const out = JSON.parse(result.stdout)
      expect(out.tasks).toHaveLength(1)
      expect(out.tasks[0].id).toBe('t1')
    })
  })

  describe('start → done lifecycle', () => {
    it('marks a task in-progress then done', () => {
      const project = createTempProject()
      const data = baseProgress('TEST-001', [makeTask({ id: 't1', name: 'Task 1' })])
      const filePath = writeProgress(project, 'TEST-001', data)

      const startResult = run('hx-progress.ts', ['start', filePath, 't1'], project)
      expect(startResult.status).toBe(0)
      expect(JSON.parse(startResult.stdout).ok).toBe(true)

      const doneResult = run(
        'hx-progress.ts',
        ['done', filePath, 't1', '--output', 'task completed'],
        project,
      )
      expect(doneResult.status).toBe(0)
      expect(JSON.parse(doneResult.stdout).ok).toBe(true)

      const saved = JSON.parse(readFileSync(filePath, 'utf8'))
      expect(saved.tasks[0].status).toBe('done')
      expect(saved.tasks[0].output).toBe('task completed')
      expect(saved.completedAt).not.toBeNull()
    })

    it('sets top-level completedAt when all tasks finish', () => {
      const project = createTempProject()
      const data = baseProgress('TEST-001', [
        makeTask({ id: 't1', name: 'Task 1' }),
        makeTask({ id: 't2', name: 'Task 2', dependsOn: ['t1'] }),
      ])
      const filePath = writeProgress(project, 'TEST-001', data)

      run('hx-progress.ts', ['start', filePath, 't1'], project)
      run('hx-progress.ts', ['done', filePath, 't1', '--output', 't1 done'], project)
      run('hx-progress.ts', ['start', filePath, 't2'], project)
      run('hx-progress.ts', ['done', filePath, 't2', '--output', 't2 done'], project)

      const saved = JSON.parse(readFileSync(filePath, 'utf8'))
      expect(saved.completedAt).not.toBeNull()
      expect(saved.tasks.every((t: { status: string }) => t.status === 'done')).toBe(true)
    })
  })

  describe('start → fail lifecycle', () => {
    it('keeps task in-progress and writes lastRun on fail', () => {
      const project = createTempProject()
      const data = baseProgress('TEST-001', [makeTask({ id: 't1', name: 'Task 1' })])
      const filePath = writeProgress(project, 'TEST-001', data)

      run('hx-progress.ts', ['start', filePath, 't1'], project)

      const failResult = run(
        'hx-progress.ts',
        ['fail', filePath, 't1', '--exit', 'failed', '--reason', 'build error'],
        project,
      )
      expect(failResult.status).toBe(0)
      expect(JSON.parse(failResult.stdout).ok).toBe(true)

      const saved = JSON.parse(readFileSync(filePath, 'utf8'))
      expect(saved.tasks[0].status).toBe('in-progress')
      expect(saved.lastRun.exitStatus).toBe('failed')
      expect(saved.lastRun.exitReason).toBe('build error')
    })
  })

  describe('invalid transitions', () => {
    it('rejects start on a task with unfinished dependency', () => {
      const project = createTempProject()
      const data = baseProgress('TEST-001', [
        makeTask({ id: 't1', name: 'Task 1' }),
        makeTask({ id: 't2', name: 'Task 2', dependsOn: ['t1'] }),
      ])
      const filePath = writeProgress(project, 'TEST-001', data)

      const result = run('hx-progress.ts', ['start', filePath, 't2'], project)

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stderr).ok).toBe(false)
    })

    it('rejects done on a pending task (not started)', () => {
      const project = createTempProject()
      const data = baseProgress('TEST-001', [makeTask({ id: 't1', name: 'Task 1' })])
      const filePath = writeProgress(project, 'TEST-001', data)

      const result = run(
        'hx-progress.ts',
        ['done', filePath, 't1', '--output', 'output'],
        project,
      )

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stderr).ok).toBe(false)
    })

    it('rejects fail on a pending task (not started)', () => {
      const project = createTempProject()
      const data = baseProgress('TEST-001', [makeTask({ id: 't1', name: 'Task 1' })])
      const filePath = writeProgress(project, 'TEST-001', data)

      const result = run(
        'hx-progress.ts',
        ['fail', filePath, 't1', '--exit', 'failed', '--reason', 'reason'],
        project,
      )

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stderr).ok).toBe(false)
    })

    it('rejects start on an already-done task', () => {
      const project = createTempProject()
      const data = baseProgress('TEST-001', [
        makeDoneTask('t1', 'Task 1'),
        makeTask({ id: 't2', name: 'Task 2' }),
      ], {
        lastRun: {
          taskId: 't1',
          taskName: 'Task 1',
          status: 'done',
          exitStatus: 'succeeded',
          exitReason: '',
          ranAt: LATER,
        },
      })
      const filePath = writeProgress(project, 'TEST-001', data)

      const result = run('hx-progress.ts', ['start', filePath, 't1'], project)

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stderr).ok).toBe(false)
    })
  })

  describe('validate', () => {
    it('reports valid for a well-formed progress file', () => {
      const project = createTempProject()
      const data = baseProgress('TEST-001', [makeTask()])
      const filePath = writeProgress(project, 'TEST-001', data)

      const result = run('hx-progress.ts', ['validate', filePath], project)

      expect(result.status).toBe(0)
      const out = JSON.parse(result.stdout)
      expect(out.ok).toBe(true)
      expect(out.valid).toBe(true)
    })

    it('reports invalid and exits 1 for a malformed file', () => {
      const project = createTempProject()
      const filePath = resolve(project, 'docs', 'plans', 'bad-progress.json')
      writeFileSync(filePath, JSON.stringify({ feature: 'BAD' }), 'utf8')

      const result = run('hx-progress.ts', ['validate', filePath], project)

      expect(result.status).toBe(1)
      const out = JSON.parse(result.stdout)
      expect(out.ok).toBe(false)
      expect(out.valid).toBe(false)
    })
  })
})

// ─── hx feature ──────────────────────────────────────────────────────────────

describe('hx feature integration', () => {
  it('parses a valid requirement doc header', () => {
    const project = createTempProject()
    const filePath = writeRequirementDoc(project, 'TEST-001')

    const result = run('hx-feature.ts', ['parse', filePath], project)

    expect(result.status).toBe(0)
    const out = JSON.parse(result.stdout)
    expect(out.ok).toBe(true)
    expect(out.feature).toBe('TEST-001')
    expect(out.displayName).toBe('Test Feature')
    expect(out.sourceId).toBe('TSK-001')
    expect(out.sourceFingerprint).toBe('abc123')
  })

  it('exits 1 for a non-existent file', () => {
    const project = createTempProject()

    const result = run('hx-feature.ts', ['parse', '/nonexistent/file.md'], project)

    expect(result.status).toBe(1)
    expect(JSON.parse(result.stderr).ok).toBe(false)
  })

  it('exits 1 for a doc with missing header fields', () => {
    const project = createTempProject()
    const filePath = resolve(project, 'docs', 'requirement', 'bad.md')
    writeFileSync(filePath, '# Requirement\n\nNo header here.\n', 'utf8')

    const result = run('hx-feature.ts', ['parse', filePath], project)

    expect(result.status).toBe(1)
    expect(JSON.parse(result.stderr).ok).toBe(false)
  })
})

// ─── hx status ───────────────────────────────────────────────────────────────

describe('hx status integration', () => {
  it('shows progress summary for a specific feature', () => {
    const project = createTempProject()
    run('hx-progress.ts', [], project) // ensure script loads fine
    const data = baseProgress('TEST-001', [
      makeTask({ id: 't1', name: 'Task 1' }),
      makeDoneTask('t2', 'Task 2'),
    ], {
      lastRun: {
        taskId: 't2',
        taskName: 'Task 2',
        status: 'done',
        exitStatus: 'succeeded',
        exitReason: '',
        ranAt: LATER,
      },
    })
    writeProgress(project, 'TEST-001', data)

    const result = run('hx-status.ts', ['TEST-001'], project)

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('TEST-001')
    expect(result.stdout).toContain('1/2')
  })

  it('scans all progress files when no feature is specified', () => {
    const project = createTempProject()
    writeProgress(project, 'FEAT-A', baseProgress('FEAT-A', [makeTask()]))
    writeProgress(project, 'FEAT-B', baseProgress('FEAT-B', [makeTask()]))

    const result = run('hx-status.ts', [], project)

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('FEAT-A')
    expect(result.stdout).toContain('FEAT-B')
  })

  it('reports no files when plans dir is empty', () => {
    const project = createTempProject()

    const result = run('hx-status.ts', [], project)

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('暂无进度文件')
  })

  it('exits 1 for a feature with no progress file', () => {
    const project = createTempProject()

    const result = run('hx-status.ts', ['NO-SUCH'], project)

    expect(result.status).toBe(1)
  })
})

// ─── hx archive + hx restore ─────────────────────────────────────────────────

describe('hx archive + hx restore integration', () => {
  it('archives a feature when all tasks are done', () => {
    const project = createTempProject()
    const data = baseProgress('TEST-001', [makeDoneTask('t1', 'Task 1')], {
      completedAt: LATER,
      lastRun: {
        taskId: 't1',
        taskName: 'Task 1',
        status: 'done',
        exitStatus: 'succeeded',
        exitReason: '',
        ranAt: LATER,
      },
    })
    writeProgress(project, 'TEST-001', data)
    writePlanDoc(project, 'TEST-001')

    const result = run('hx-archive.ts', ['TEST-001'], project)

    expect(result.status).toBe(0)
    const out = JSON.parse(result.stdout)
    expect(out.ok).toBe(true)
    expect(out.feature).toBe('TEST-001')
    expect(existsSync(resolve(project, 'docs', 'plans', 'test-001-progress.json'))).toBe(false)
    expect(existsSync(resolve(project, 'docs', 'archive', 'TEST-001', 'test-001-progress.json'))).toBe(true)
  })

  it('rejects archive when tasks are not done', () => {
    const project = createTempProject()
    const data = baseProgress('TEST-001', [makeTask({ id: 't1', name: 'Task 1' })])
    writeProgress(project, 'TEST-001', data)
    writePlanDoc(project, 'TEST-001')

    const result = run('hx-archive.ts', ['TEST-001'], project)

    expect(result.status).toBe(1)
    expect(JSON.parse(result.stderr).ok).toBe(false)
  })

  it('restores archived feature back to plans/', () => {
    const project = createTempProject()
    const data = baseProgress('TEST-001', [makeDoneTask('t1', 'Task 1')], {
      completedAt: LATER,
      lastRun: {
        taskId: 't1',
        taskName: 'Task 1',
        status: 'done',
        exitStatus: 'succeeded',
        exitReason: '',
        ranAt: LATER,
      },
    })
    writeProgress(project, 'TEST-001', data)
    writePlanDoc(project, 'TEST-001')

    run('hx-archive.ts', ['TEST-001'], project)

    expect(existsSync(resolve(project, 'docs', 'plans', 'test-001-progress.json'))).toBe(false)

    const restoreResult = run('hx-restore.ts', ['TEST-001'], project)

    expect(restoreResult.status).toBe(0)
    const out = JSON.parse(restoreResult.stdout)
    expect(out.ok).toBe(true)
    expect(existsSync(resolve(project, 'docs', 'plans', 'test-001-progress.json'))).toBe(true)
  })
})

// ─── hx CLI entrypoint smoke tests ───────────────────────────────────────────

describe('hx CLI entrypoint — workflow commands smoke test', () => {
  it('routes hx progress through bin/hx.js', () => {
    const project = createTempProject()
    const data = baseProgress('TEST-001', [makeTask()])
    const filePath = writeProgress(project, 'TEST-001', data)

    const result = spawnSync(
      process.execPath,
      [resolve(REPO_ROOT, 'bin', 'hx.js'), 'progress', 'validate', filePath],
      { cwd: project, encoding: 'utf8' },
    )

    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout).valid).toBe(true)
  })

  it('routes hx feature through bin/hx.js', () => {
    const project = createTempProject()
    const filePath = writeRequirementDoc(project, 'SMOKE-001')

    const result = spawnSync(
      process.execPath,
      [resolve(REPO_ROOT, 'bin', 'hx.js'), 'feature', 'parse', filePath],
      { cwd: project, encoding: 'utf8' },
    )

    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout).feature).toBe('SMOKE-001')
  })
})
