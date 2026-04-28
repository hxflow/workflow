import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const SCRIPT_PATH = resolve(process.cwd(), 'hxflow', 'scripts', 'tools', 'check.ts')
const tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

function setupProject(testGateCommand: string) {
  const projectRoot = mkdtempSync(join(tmpdir(), 'hx-check-script-'))
  tempDirs.push(projectRoot)

  mkdirSync(join(projectRoot, '.hx', 'rules'), { recursive: true })
  writeFileSync(
    join(projectRoot, '.hx', 'config.yaml'),
    `paths:
  src: src
gates:
  test: ${testGateCommand}
`,
    'utf8',
  )

  return projectRoot
}

function writeHxConfig(projectRoot: string, testGateCommand: string) {
  mkdirSync(join(projectRoot, '.hx', 'rules'), { recursive: true })
  writeFileSync(
    join(projectRoot, '.hx', 'config.yaml'),
    `paths:\n  src: src\ngates:\n  test: ${testGateCommand}\n`,
    'utf8',
  )
}

function configureGitIdentity(projectRoot: string) {
  spawnSync('git', ['config', 'user.name', 'Test User'], { cwd: projectRoot, encoding: 'utf8' })
  spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: projectRoot, encoding: 'utf8' })
}

function setupGitProject(branch: string, testGateCommand = 'echo qa-pass') {
  const projectRoot = mkdtempSync(join(tmpdir(), 'hx-check-branch-'))
  tempDirs.push(projectRoot)

  // init a real git repo on the desired branch
  spawnSync('git', ['init', '-b', branch], { cwd: projectRoot, encoding: 'utf8' })
  spawnSync('git', ['config', 'user.name', 'hx-check-test'], { cwd: projectRoot, encoding: 'utf8' })
  spawnSync('git', ['config', 'user.email', 'hx-check-test@example.com'], { cwd: projectRoot, encoding: 'utf8' })
  spawnSync('git', ['commit', '--allow-empty', '-m', 'init'], { cwd: projectRoot, encoding: 'utf8' })

  writeHxConfig(projectRoot, testGateCommand)

  return projectRoot
}

function setupUnbornGitProject(branch: string, testGateCommand = 'echo qa-pass') {
  const projectRoot = mkdtempSync(join(tmpdir(), 'hx-check-branch-unborn-'))
  tempDirs.push(projectRoot)

  spawnSync('git', ['init', '-b', branch], { cwd: projectRoot, encoding: 'utf8' })
  configureGitIdentity(projectRoot)

  writeHxConfig(projectRoot, testGateCommand)

  return projectRoot
}

function setupWorkspaceProject() {
  const projectRoot = mkdtempSync(join(tmpdir(), 'hx-check-workspace-'))
  tempDirs.push(projectRoot)

  mkdirSync(join(projectRoot, '.hx'), { recursive: true })
  mkdirSync(join(projectRoot, 'docs', 'plans'), { recursive: true })
  mkdirSync(join(projectRoot, 'apps', 'admin', '.hx'), { recursive: true })
  mkdirSync(join(projectRoot, 'apps', 'h5', '.hx'), { recursive: true })

  writeFileSync(
    join(projectRoot, '.hx', 'workspace.yaml'),
    `version: 1
gates:
  test: echo workspace-test
projects:
  - id: admin
    path: ./apps/admin
    type: node
  - id: h5
    path: ./apps/h5
    type: node
`,
    'utf8',
  )
  writeFileSync(
    join(projectRoot, 'apps', 'admin', '.hx', 'config.yaml'),
    `paths:
  src: app
  requirementDoc: ignored.md
gates:
  test: echo admin-test
runtime:
  hooks:
    run:
      pre:
        - ignored
`,
    'utf8',
  )
  writeFileSync(
    join(projectRoot, 'apps', 'h5', '.hx', 'config.yaml'),
    `paths:
  src: src
gates:
  lint: echo h5-lint
`,
    'utf8',
  )
  writeFileSync(
    join(projectRoot, 'docs', 'plans', 'AUTH-001.md'),
    `# Plan

## 任务拆分

### TASK-1

- 目标: 管理端改造
- 执行服务: admin
- 执行目录: apps/admin
- 修改范围: app

### TASK-2

- 目标: H5 改造
- 执行服务: h5
- 执行目录: apps/h5
- 修改范围: src
`,
    'utf8',
  )
  writeFileSync(
    join(projectRoot, 'docs', 'plans', 'AUTH-001-progress.json'),
    JSON.stringify({
      feature: 'AUTH-001',
      requirementDoc: 'docs/requirement/AUTH-001.md',
      planDoc: 'docs/plans/AUTH-001.md',
      createdAt: '2026-04-21T00:00:00Z',
      updatedAt: '2026-04-21T00:00:00Z',
      completedAt: null,
      lastRun: null,
      tasks: [
        {
          id: 'TASK-1',
          name: '管理端改造',
          status: 'pending',
          dependsOn: [],
          parallelizable: false,
          output: '',
          startedAt: null,
          completedAt: null,
          durationSeconds: null,
        },
        {
          id: 'TASK-2',
          name: 'H5 改造',
          status: 'pending',
          dependsOn: [],
          parallelizable: false,
          output: '',
          startedAt: null,
          completedAt: null,
          durationSeconds: null,
        },
      ],
    }, null, 2) + '\n',
    'utf8',
  )

  return projectRoot
}

describe('checkBranchName via hx-check --scope qa', () => {
  it.each([
    ['feat/my-feature', true],
    ['fix/issue-42', true],
    ['bugfix/login-crash', true],
    ['refactor/user-model', true],
    ['chore/update-deps', true],
    ['docs/api-guide', true],
    ['test/e2e-setup', true],
    ['hotfix/critical-bug', true],
    ['main', true],
    ['master', true],
    ['develop', true],
  ])('branch "%s" should pass branchCheck (ok: %s)', (branch, expectedOk) => {
    const projectRoot = setupGitProject(branch)
    const result = spawnSync('bun', [SCRIPT_PATH, '--scope', 'qa'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })
    const summary = JSON.parse(result.stdout)
    expect(summary.qa.branchCheck.ok).toBe(expectedOk)
    expect(summary.qa.branchCheck.branch).toBe(branch)
    expect(summary.qa.branchCheck.reason).toBeNull()
  })

  it.each([
    'my-feature',
    'FEAT/my-feature',
    'feature/my-feature',
  ])('non-compliant branch "%s" should fail branchCheck but not fail qa', (branch) => {
    const projectRoot = setupGitProject(branch)
    const result = spawnSync('bun', [SCRIPT_PATH, '--scope', 'qa'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })
    expect(result.status).toBe(0) // qa.ok still true
    const summary = JSON.parse(result.stdout)
    expect(summary.ok).toBe(true)
    expect(summary.qa.ok).toBe(true)
    expect(summary.qa.branchCheck.ok).toBe(false)
    expect(typeof summary.qa.branchCheck.reason).toBe('string')
    expect(summary.qa.branchCheck.reason.length).toBeGreaterThan(0)
  })

  it('detects branch name for unborn branch repositories', () => {
    const branch = 'feat/unborn'
    const projectRoot = setupUnbornGitProject(branch)
    const result = spawnSync('bun', [SCRIPT_PATH, '--scope', 'qa'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })
    expect(result.status).toBe(0)
    const summary = JSON.parse(result.stdout)
    expect(summary.qa.branchCheck.ok).toBe(true)
    expect(summary.qa.branchCheck.branch).toBe(branch)
    expect(summary.qa.branchCheck.reason).toBeNull()
  })
})

describe('hx-check script', () => {
  it('runs qa gates directly and returns a structured summary', () => {
    const projectRoot = setupProject('echo qa-pass')
    const result = spawnSync('bun', [SCRIPT_PATH, 'AUTH-001', '--scope', 'qa'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout)).toEqual({
      ok: true,
      feature: 'AUTH-001',
      scope: 'qa',
      qa: {
        enabled: true,
        ok: true,
        summary: 'test 全部通过',
        reason: null,
        gates: [
          {
            name: 'test',
            command: 'echo qa-pass',
            projectRoot: expect.stringContaining('hx-check-script-'),
            cwd: '',
            source: 'project',
            ok: true,
            exitCode: 0,
            stdout: 'qa-pass',
            stderr: '',
          },
        ],
        branchCheck: { ok: true, branch: '(unknown)', reason: null },
      },
      review: {
        enabled: false,
        ok: true,
        needsAiReview: false,
        context: null,
        summary: '未执行 review',
        reason: null,
      },
      clean: {
        enabled: false,
        ok: true,
        needsAiReview: false,
        context: null,
        summary: '未执行 clean',
        reason: null,
      },
    })
  })

  it('runs workspace feature gates in each task execution project', () => {
    const projectRoot = setupWorkspaceProject()
    const result = spawnSync('bun', [SCRIPT_PATH, 'AUTH-001', '--scope', 'qa'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    const summary = JSON.parse(result.stdout)
    expect(summary.qa.gates).toMatchObject([
      {
        name: 'test',
        command: 'echo admin-test',
        projectRoot: expect.stringContaining('/apps/admin'),
        cwd: 'apps/admin',
        source: 'project',
        stdout: 'admin-test',
      },
      {
        name: 'lint',
        command: 'echo h5-lint',
        projectRoot: expect.stringContaining('/apps/h5'),
        cwd: 'apps/h5',
        source: 'project',
        stdout: 'h5-lint',
      },
      {
        name: 'test',
        command: 'echo workspace-test',
        projectRoot: expect.stringContaining('/apps/h5'),
        cwd: 'apps/h5',
        source: 'workspace',
        stdout: 'workspace-test',
      },
    ])
  })

  it('outputs needsAiReview context for review and clean scopes', () => {
    const projectRoot = setupProject('echo qa-pass')
    const result = spawnSync('bun', [SCRIPT_PATH, 'AUTH-001', '--scope', 'all'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(1)
    const summary = JSON.parse(result.stdout)
    expect(summary.ok).toBe(false)
    expect(summary.feature).toBe('AUTH-001')
    expect(summary.scope).toBe('all')
    expect(summary.qa.ok).toBe(true)
    expect(summary.review).toMatchObject({
      enabled: true,
      ok: true,
      needsAiReview: true,
    })
    expect(summary.clean).toMatchObject({
      enabled: true,
      ok: true,
      needsAiReview: true,
    })
    expect(summary.review.context).toBeDefined()
    expect(summary.review.context.kind).toBe('review')
    expect(summary.clean.context).toBeDefined()
    expect(summary.clean.context.kind).toBe('clean')
  })
})
