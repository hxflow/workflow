import { describe, expect, it, afterEach } from 'bun:test'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const SCRIPT_PATH = resolve(process.cwd(), 'src/tools/run.ts')
const tempDirs = []

function makeProgressData() {
  return {
    feature: 'AUTH-001',
    requirementDoc: 'docs/requirement/AUTH-001.md',
    planDoc: 'docs/plans/AUTH-001.md',
    createdAt: '2026-04-10T10:00:00Z',
    updatedAt: '2026-04-10T10:00:00Z',
    completedAt: null,
    lastRun: {
      taskId: 'TASK-0',
      taskName: '准备接口字段',
      status: 'done',
      exitStatus: 'succeeded',
      exitReason: '',
      ranAt: '2026-04-10T10:00:00Z',
    },
    tasks: [
      {
        id: 'TASK-0',
        name: '准备接口字段',
        status: 'done',
        dependsOn: [],
        parallelizable: false,
        output: '字段已准备完成',
        startedAt: '2026-04-10T09:50:00Z',
        completedAt: '2026-04-10T10:00:00Z',
        durationSeconds: 600,
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
  }
}

function setupProject(progressData = makeProgressData()) {
  const projectRoot = mkdtempSync(join(tmpdir(), 'hx-run-script-'))
  tempDirs.push(projectRoot)

  mkdirSync(join(projectRoot, '.hx'), { recursive: true })
  mkdirSync(join(projectRoot, 'docs', 'plans'), { recursive: true })
  mkdirSync(join(projectRoot, 'docs', 'requirement'), { recursive: true })

  writeFileSync(
    join(projectRoot, '.hx', 'config.yaml'),
    `paths:
  src: src
  requirementDoc: docs/requirement/{feature}.md
  planDoc: docs/plans/{feature}.md
  progressFile: docs/plans/{feature}-progress.json
gates:
  test: ''
`,
    'utf8',
  )
  writeFileSync(
    join(projectRoot, 'docs', 'requirement', 'AUTH-001.md'),
    `# Requirement

> Feature: AUTH-001
> Display Name: 用户登录
> Source ID: TS-1
> Source Fingerprint: fp-1

## 背景

需要实现登录接口。
`,
    'utf8',
  )
  writeFileSync(
    join(projectRoot, 'docs', 'plans', 'AUTH-001.md'),
    `# Plan

## 任务拆分

### TASK-1

- 目标: 实现登录接口
- 修改范围: src/api/auth.ts
- 实施要点: 新增登录接口
- 验收标准: 接口可调用
- 验证方式: bun test tests/unit/auth.test.ts
`,
    'utf8',
  )
  writeFileSync(
    join(projectRoot, 'docs', 'plans', 'AUTH-001-progress.json'),
    JSON.stringify(progressData, null, 2) + '\n',
    'utf8',
  )

  return projectRoot
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('hx-run script', () => {
  it('outputs next-batch context for AI when tasks are pending', () => {
    const projectRoot = setupProject()
    const result = spawnSync('bun', [SCRIPT_PATH, 'next', 'AUTH-001'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    const summary = JSON.parse(result.stdout)
    expect(summary.ok).toBe(true)
    expect(summary.completed).toBe(false)
    expect(summary.feature).toBe('AUTH-001')
    expect(summary.mode).toBe('run')
    expect(summary.tasks).toEqual([
      { id: 'TASK-1', name: '实现登录接口', status: 'pending', dependsOn: ['TASK-0'] },
    ])
    expect(summary.tasksContext).toBeDefined()
    expect(Array.isArray(summary.tasksContext)).toBe(true)
    expect(summary.tasksContext.length).toBe(1)
  })

  it('rejects --plan-task for a done task', () => {
    const projectRoot = setupProject()
    const result = spawnSync('bun', [SCRIPT_PATH, 'next', 'AUTH-001', '--plan-task', 'TASK-0'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('已为 done')
  })
})
