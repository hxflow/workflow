import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const SCRIPT_PATH = resolve(process.cwd(), 'src/tools/go.ts')
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
  it('next subcommand returns doc step when requirementDoc is missing', () => {
    const projectRoot = createProject()
    const result = spawnSync('bun', [SCRIPT_PATH, 'next', 'AUTH-001'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    const parsed = JSON.parse(result.stdout)
    expect(parsed.ok).toBe(true)
    expect(parsed.feature).toBe('AUTH-001')
    expect(parsed.nextStep).toBe('doc')
    expect(parsed.command).toBe('hx doc')
    expect(Array.isArray(parsed.state)).toBe(true)
    expect(parsed.state[0]).toMatchObject({ id: 'doc', status: 'pending' })
  })

  it('next subcommand with --from plan returns check step when doc/plan/run are done', () => {
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

    const result = spawnSync('bun', [SCRIPT_PATH, 'next', 'AUTH-001', '--from', 'plan'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    const summary = JSON.parse(result.stdout)
    expect(summary.ok).toBe(true)
    expect(summary.feature).toBe('AUTH-001')
    // --from plan forces start at plan step
    expect(summary.nextStep).toBe('plan')
    expect(summary.command).toBe('hx plan')

    // state reflects doc/plan/run done, check/mr rerun
    const stateMap = Object.fromEntries(
      summary.state.map((s: { id: string; status: string }) => [s.id, s.status]),
    )
    expect(stateMap.doc).toBe('done')
    expect(stateMap.plan).toBe('done')
    expect(stateMap.run).toBe('done')
    expect(stateMap.check).toBe('rerun')
    expect(stateMap.mr).toBe('rerun')
  })

  it('state subcommand returns full pipeline state', () => {
    const projectRoot = createProject()
    writeRequirementDoc(projectRoot)

    const result = spawnSync('bun', [SCRIPT_PATH, 'state', 'AUTH-001'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    const summary = JSON.parse(result.stdout)
    expect(summary.ok).toBe(true)
    expect(summary.feature).toBe('AUTH-001')
    expect(summary.allDone).toBe(false)
    expect(summary.nextStep).toBe('plan')
    expect(Array.isArray(summary.steps)).toBe(true)
    expect(summary.steps).toHaveLength(5)
    expect(summary.steps[0]).toMatchObject({ id: 'doc', status: 'done' })
    expect(summary.steps[1]).toMatchObject({ id: 'plan', status: 'pending' })
  })
})
