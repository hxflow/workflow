import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const SCRIPT_PATH = resolve(process.cwd(), 'src/tools/check.ts')
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
  writeFileSync(join(projectRoot, '.hx', 'rules', 'review-checklist.md'), '# Review Checklist\n', 'utf8')
  writeFileSync(join(projectRoot, '.hx', 'rules', 'golden-rules.md'), '# Golden Rules\n', 'utf8')

  return projectRoot
}


function setupGitProject(branch: string, testGateCommand = 'echo qa-pass') {
  const projectRoot = mkdtempSync(join(tmpdir(), 'hx-check-branch-'))
  tempDirs.push(projectRoot)

  // init a real git repo on the desired branch
  spawnSync('git', ['init', '-b', branch], { cwd: projectRoot })
  spawnSync('git', ['commit', '--allow-empty', '-m', 'init'], { cwd: projectRoot })

  mkdirSync(join(projectRoot, '.hx', 'rules'), { recursive: true })
  writeFileSync(
    join(projectRoot, '.hx', 'config.yaml'),
    `paths:\n  src: src\ngates:\n  test: ${testGateCommand}\n`,
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
