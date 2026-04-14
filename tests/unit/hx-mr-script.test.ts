import { afterEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const SCRIPT_PATH = resolve(process.cwd(), 'src/tools/mr.ts')
const tempDirs: string[] = []

function normalizeTmpPath(value: string) {
  return value.replace(/^\/private(?=\/var\/folders\/)/, '')
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

function createProject(taskStatus: 'done' | 'pending') {
  const projectRoot = mkdtempSync(join(tmpdir(), 'hx-mr-script-'))
  tempDirs.push(projectRoot)

  mkdirSync(join(projectRoot, 'docs', 'plans'), { recursive: true })
  mkdirSync(join(projectRoot, 'docs', 'requirement'), { recursive: true })

  writeFileSync(
    join(projectRoot, 'docs', 'requirement', 'AUTH-001.md'),
    `# Requirement

> Feature: AUTH-001
> Display Name: 用户登录
> Source ID: TS-1
> Source Fingerprint: fp-1

## 背景

需要补齐登录接口。
`,
    'utf8',
  )

  writeFileSync(join(projectRoot, 'docs', 'plans', 'AUTH-001.md'), '# Plan\n', 'utf8')
  writeFileSync(
    join(projectRoot, 'docs', 'plans', 'AUTH-001-progress.json'),
    JSON.stringify(
      {
        feature: 'AUTH-001',
        requirementDoc: 'docs/requirement/AUTH-001.md',
        planDoc: 'docs/plans/AUTH-001.md',
        createdAt: '2026-04-13T10:00:00Z',
        updatedAt: '2026-04-13T10:10:00Z',
        completedAt: taskStatus === 'done' ? '2026-04-13T10:10:00Z' : null,
        lastRun: null,
        tasks: [
          {
            id: 'TASK-1',
            name: '实现登录接口',
            status: taskStatus,
            dependsOn: [],
            parallelizable: false,
            output: taskStatus === 'done' ? '已完成' : '',
            startedAt: taskStatus === 'done' ? '2026-04-13T10:00:00Z' : null,
            completedAt: taskStatus === 'done' ? '2026-04-13T10:10:00Z' : null,
            durationSeconds: taskStatus === 'done' ? 600 : null,
          },
        ],
      },
      null,
      2,
    ) + '\n',
    'utf8',
  )

  return projectRoot
}

describe('hx-mr script', () => {
  it('context subcommand outputs flat MR facts when all tasks done', () => {
    const projectRoot = createProject('done')
    const result = spawnSync('bun', [SCRIPT_PATH, 'context', 'AUTH-001'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    const summary = JSON.parse(result.stdout)
    expect(summary.ok).toBe(true)
    expect(summary.feature).toBe('AUTH-001')
    expect(summary.displayName).toBe('用户登录')
    expect(summary.sourceId).toBe('TS-1')
    expect(summary.allDone).toBe(true)
    expect(summary.pendingIds).toEqual([])
    expect(summary.progress.doneCount).toBe(1)
    expect(summary.progress.totalCount).toBe(1)
    expect(summary.git).toBeDefined()
    expect(summary.git.targetBranch).toBeDefined()
    expect(summary.git.currentBranch).toBeDefined()
  })

  it('archive subcommand moves active artifacts to archive dir', () => {
    const projectRoot = createProject('done')
    const result = spawnSync('bun', [SCRIPT_PATH, 'archive', 'AUTH-001'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    const summary = JSON.parse(result.stdout)
    expect(summary.ok).toBe(true)
    expect(summary.feature).toBe('AUTH-001')
    expect(summary.performed).toBe(true)
    expect(summary.archived.map((item: string) => normalizeTmpPath(item))).toEqual([
      normalizeTmpPath(join(projectRoot, 'docs', 'archive', 'AUTH-001', 'AUTH-001.md')),
      normalizeTmpPath(join(projectRoot, 'docs', 'archive', 'AUTH-001', 'AUTH-001-progress.json')),
    ])

    // archive moved the files
    expect(existsSync(join(projectRoot, 'docs', 'plans', 'AUTH-001.md'))).toBe(false)
    expect(existsSync(join(projectRoot, 'docs', 'plans', 'AUTH-001-progress.json'))).toBe(false)
    expect(existsSync(join(projectRoot, 'docs', 'archive', 'AUTH-001', 'AUTH-001.md'))).toBe(true)
  })

  it('context subcommand reports pending tasks when progress has unfinished work', () => {
    const projectRoot = createProject('pending')
    const result = spawnSync('bun', [SCRIPT_PATH, 'context', 'AUTH-001'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    const summary = JSON.parse(result.stdout)
    expect(summary.ok).toBe(true)
    expect(summary.feature).toBe('AUTH-001')
    expect(summary.allDone).toBe(false)
    expect(summary.pendingIds).toEqual(['TASK-1'])
    expect(summary.progress.doneCount).toBe(0)
    expect(summary.progress.totalCount).toBe(1)
    expect(normalizeTmpPath(summary.progressFile)).toBe(
      normalizeTmpPath(join(projectRoot, 'docs', 'plans', 'AUTH-001-progress.json')),
    )
  })
})
