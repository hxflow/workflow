import { afterEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const SCRIPT_PATH = resolve(process.cwd(), 'src/scripts/hx-mr.ts')
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
  it('outputs actionRequired context for MR generation and archives active artifacts', () => {
    const projectRoot = createProject('done')
    const result = spawnSync('bun', [SCRIPT_PATH, 'AUTH-001'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    const summary = JSON.parse(result.stdout)
    expect(summary.ok).toBe(true)
    expect(summary.actionRequired).toBe(true)
    expect(summary.feature).toBe('AUTH-001')
    expect(summary.progressSummary).toBe('1/1 个任务完成')
    expect(summary.archive).toMatchObject({ performed: true })
    expect(summary.archive.archived.map((item: string) => normalizeTmpPath(item))).toEqual([
      normalizeTmpPath(join(projectRoot, 'docs', 'archive', 'AUTH-001', 'AUTH-001.md')),
      normalizeTmpPath(join(projectRoot, 'docs', 'archive', 'AUTH-001', 'AUTH-001-progress.json')),
    ])
    expect(summary.context).toBeDefined()
    expect(summary.context.git).toBeDefined()
    expect(summary.context.progress.doneCount).toBe(1)
    expect(summary.context.progress.totalCount).toBe(1)
    expect(summary.nextAction).toBe('hx mr AUTH-001')

    // archive moved the files
    expect(existsSync(join(projectRoot, 'docs', 'plans', 'AUTH-001.md'))).toBe(false)
    expect(existsSync(join(projectRoot, 'docs', 'plans', 'AUTH-001-progress.json'))).toBe(false)
    expect(existsSync(join(projectRoot, 'docs', 'archive', 'AUTH-001', 'AUTH-001.md'))).toBe(true)
  })

  it('fails before calling AI when progress still has pending tasks', () => {
    const projectRoot = createProject('pending')
    const result = spawnSync('bun', [SCRIPT_PATH, 'AUTH-001'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(1)
    const summary = JSON.parse(result.stdout)
    expect(summary).toEqual({
      ok: false,
      feature: 'AUTH-001',
      progressFile: summary.progressFile,
      progressSummary: '0/1 个任务完成',
      currentBranch: '（尚未执行）',
      targetBranch: 'main',
      mr: null,
      archive: {
        performed: false,
        archived: [],
      },
      nextAction: 'hx run AUTH-001',
      reason: '存在未完成任务: TASK-1',
    })
    expect(normalizeTmpPath(summary.progressFile)).toBe(
      normalizeTmpPath(join(projectRoot, 'docs', 'plans', 'AUTH-001-progress.json')),
    )
  })
})
