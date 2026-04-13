import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const SCRIPT_PATH = resolve(process.cwd(), 'src/scripts/hx-go.ts')
const tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

function createProject() {
  const projectRoot = mkdtempSync(join(tmpdir(), 'hx-go-script-'))
  tempDirs.push(projectRoot)

  mkdirSync(join(projectRoot, '.hx', 'rules'), { recursive: true })
  mkdirSync(join(projectRoot, 'docs', 'requirement'), { recursive: true })
  mkdirSync(join(projectRoot, 'docs', 'plans'), { recursive: true })

  writeFileSync(
    join(projectRoot, '.hx', 'config.yaml'),
    `paths:
  src: src
gates:
  test: echo qa-pass
`,
    'utf8',
  )
  writeFileSync(join(projectRoot, '.hx', 'rules', 'review-checklist.md'), '# Review Checklist\n', 'utf8')
  writeFileSync(join(projectRoot, '.hx', 'rules', 'golden-rules.md'), '# Golden Rules\n', 'utf8')

  return projectRoot
}

function writeRequirementDoc(projectRoot: string) {
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
}

describe('hx-go script', () => {
  it('blocks on doc step with actionRequired when requirementDoc is missing', () => {
    const projectRoot = createProject()
    const result = spawnSync('bun', [SCRIPT_PATH, 'AUTH-001'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    const parsed = JSON.parse(result.stdout)
    expect(parsed).toMatchObject({
      ok: false,
      actionRequired: true,
      feature: 'AUTH-001',
      pipeline: 'default',
      startStep: 'doc',
      blockedStep: 'doc',
    })
    expect(parsed.executedSteps).toHaveLength(1)
    expect(parsed.executedSteps[0]).toMatchObject({
      id: 'doc',
      ok: true,
      result: expect.objectContaining({ ok: true, actionRequired: true, feature: 'AUTH-001', docType: 'feature' }),
    })
  })

  it('advances past plan and run when all files exist and blocks at check with actionRequired', () => {
    const projectRoot = createProject()
    writeRequirementDoc(projectRoot)
    // Pre-create plan + progress with all tasks done (simulates AI having completed these steps)
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
        updatedAt: '2026-04-13T10:10:00Z',
        completedAt: '2026-04-13T10:10:00Z',
        lastRun: null,
        tasks: [
          {
            id: 'TASK-1',
            name: '实现登录接口',
            status: 'done',
            dependsOn: [],
            parallelizable: false,
            output: '已完成',
            startedAt: '2026-04-13T10:00:00Z',
            completedAt: '2026-04-13T10:10:00Z',
            durationSeconds: 600,
          },
        ],
      }, null, 2) + '\n',
      'utf8',
    )

    const result = spawnSync('bun', [SCRIPT_PATH, 'AUTH-001', '--from', 'plan'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    // hx-go exits 0 when it blocks on actionRequired
    expect(result.status).toBe(0)
    const summary = JSON.parse(result.stdout)
    expect(summary.ok).toBe(false)
    expect(summary.actionRequired).toBe(true)
    expect(summary.feature).toBe('AUTH-001')
    expect(summary.pipeline).toBe('default')
    expect(summary.startStep).toBe('plan')
    expect(summary.blockedStep).toBe('check')

    // plan and run completed, check blocked with actionRequired
    const steps = summary.executedSteps.map((s: { id: string; ok: boolean }) => [s.id, s.ok])
    expect(steps).toEqual([
      ['plan', true],
      ['run', true],
      ['check', false],
    ])
  })
})
