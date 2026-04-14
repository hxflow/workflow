import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const SCRIPT_PATH = resolve(process.cwd(), 'src/tools/plan.ts')
const tempDirs: string[] = []

function normalizeTmpPath(value: string) {
  return value.replace(/^\/private(?=\/var\/folders\/)/, '')
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

function createProject() {
  const projectRoot = mkdtempSync(join(tmpdir(), 'hx-plan-script-'))
  tempDirs.push(projectRoot)

  mkdirSync(join(projectRoot, 'docs', 'requirement'), { recursive: true })
  mkdirSync(join(projectRoot, 'docs', 'plans'), { recursive: true })

  writeFileSync(
    join(projectRoot, 'docs', 'requirement', 'AUTH-001.md'),
    `# Requirement

> Feature: AUTH-001
> Display Name: 用户登录
> Source ID: TS-1
> Source Fingerprint: fp-1

## 背景

需要补齐登录接口与页面联动。
`,
    'utf8',
  )

  return projectRoot
}

describe('hx-plan script', () => {
  it('outputs context for AI when plan does not exist (phase 1)', () => {
    const projectRoot = createProject()
    const result = spawnSync('bun', [SCRIPT_PATH, 'context', 'AUTH-001'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    const summary = JSON.parse(result.stdout)
    expect(summary.ok).toBe(true)
    expect(summary.feature).toBe('AUTH-001')
    expect(normalizeTmpPath(summary.planDoc)).toBe(
      normalizeTmpPath(join(projectRoot, 'docs', 'plans', 'AUTH-001.md')),
    )
    expect(normalizeTmpPath(summary.progressFile)).toBe(
      normalizeTmpPath(join(projectRoot, 'docs', 'plans', 'AUTH-001-progress.json')),
    )
    expect(summary.requirementContent).toContain('AUTH-001')
    expect(summary.planTemplate).toBeTruthy()
  })

  it('validates progressFile and reports tasks when plan and progress exist (phase 2)', () => {
    const projectRoot = createProject()
    // AI writes these files after phase 1
    writeFileSync(
      join(projectRoot, 'docs', 'plans', 'AUTH-001.md'),
      '# Plan\n\n## 任务拆分\n\n### TASK-1\n\n- 目标: 实现登录接口\n',
      'utf8',
    )
    writeFileSync(
      join(projectRoot, 'docs', 'plans', 'AUTH-001-progress.json'),
      JSON.stringify({
        feature: 'AUTH-001',
        requirementDoc: 'docs/requirement/AUTH-001.md',
        planDoc: 'docs/plans/AUTH-001.md',
        createdAt: '2026-04-13T10:00:00Z',
        updatedAt: '2026-04-13T10:00:00Z',
        completedAt: null,
        lastRun: null,
        tasks: [
          { id: 'TASK-1', name: '实现登录接口', status: 'pending', dependsOn: [], parallelizable: false, output: '', startedAt: null, completedAt: null, durationSeconds: null },
          { id: 'TASK-2', name: '接入登录页', status: 'pending', dependsOn: ['TASK-1'], parallelizable: true, output: '', startedAt: null, completedAt: null, durationSeconds: null },
        ],
      }, null, 2) + '\n',
      'utf8',
    )

    const result = spawnSync('bun', [SCRIPT_PATH, 'validate', 'AUTH-001'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    const summary = JSON.parse(result.stdout)
    expect(summary.ok).toBe(true)
    expect(summary.feature).toBe('AUTH-001')
    expect(summary.errors).toEqual([])
    expect(summary.tasks).toEqual([
      { id: 'TASK-1', name: '实现登录接口', status: 'pending', dependsOn: [], parallelizable: false },
      { id: 'TASK-2', name: '接入登录页', status: 'pending', dependsOn: ['TASK-1'], parallelizable: true },
    ])
  })

  it('fails with structured output when progressFile has invalid schema', () => {
    const projectRoot = createProject()
    // Write plan but malformed progress
    writeFileSync(join(projectRoot, 'docs', 'plans', 'AUTH-001.md'), '# Plan\n', 'utf8')
    writeFileSync(
      join(projectRoot, 'docs', 'plans', 'AUTH-001-progress.json'),
      JSON.stringify({ feature: 'AUTH-001', tasks: [{ name: '缺少 id' }] }, null, 2) + '\n',
      'utf8',
    )

    const result = spawnSync('bun', [SCRIPT_PATH, 'validate', 'AUTH-001'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(1)
    const summary = JSON.parse(result.stdout)
    expect(summary.ok).toBe(false)
    expect(summary.errors.length).toBeGreaterThan(0)
  })
})
