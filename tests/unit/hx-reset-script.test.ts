import { afterEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const SCRIPT_PATH = resolve(process.cwd(), 'hxflow', 'scripts', 'tools', 'reset.ts')
const tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

function createProgressData() {
  return {
    feature: 'AUTH-001',
    requirementDoc: 'docs/requirement/AUTH-001.md',
    planDoc: 'docs/plans/AUTH-001.md',
    createdAt: '2026-04-21T00:00:00Z',
    updatedAt: '2026-04-21T00:10:00Z',
    completedAt: '2026-04-21T00:10:00Z',
    lastRun: {
      taskId: 'TASK-2',
      taskName: '接入登录页',
      status: 'done',
      exitStatus: 'succeeded',
      exitReason: '',
      ranAt: '2026-04-21T00:10:00Z',
    },
    tasks: [
      {
        id: 'TASK-1',
        name: '实现登录接口',
        status: 'done',
        dependsOn: [],
        parallelizable: false,
        output: '已完成',
        startedAt: '2026-04-21T00:00:00Z',
        completedAt: '2026-04-21T00:05:00Z',
        durationSeconds: 300,
      },
      {
        id: 'TASK-2',
        name: '接入登录页',
        status: 'done',
        dependsOn: ['TASK-1'],
        parallelizable: true,
        output: '已完成',
        startedAt: '2026-04-21T00:05:00Z',
        completedAt: '2026-04-21T00:10:00Z',
        durationSeconds: 300,
      },
    ],
  }
}

function createProject() {
  const projectRoot = mkdtempSync(join(tmpdir(), 'hx-reset-script-'))
  tempDirs.push(projectRoot)

  mkdirSync(join(projectRoot, '.hx'), { recursive: true })
  mkdirSync(join(projectRoot, 'docs', 'requirement'), { recursive: true })
  mkdirSync(join(projectRoot, 'docs', 'plans'), { recursive: true })
  mkdirSync(join(projectRoot, 'docs', 'archive', 'AUTH-001'), { recursive: true })
  writeFileSync(join(projectRoot, '.hx', 'config.yaml'), 'paths:\n  src: src\n', 'utf8')
  writeFileSync(join(projectRoot, 'docs', 'requirement', 'AUTH-001.md'), '# Requirement\n', 'utf8')
  writeFileSync(join(projectRoot, 'docs', 'plans', 'AUTH-001.md'), '# Plan\n', 'utf8')
  writeFileSync(
    join(projectRoot, 'docs', 'plans', 'AUTH-001-progress.json'),
    JSON.stringify(createProgressData(), null, 2) + '\n',
    'utf8',
  )
  writeFileSync(join(projectRoot, 'docs', 'archive', 'AUTH-001', 'AUTH-001.md'), '# Archived Plan\n', 'utf8')
  writeFileSync(
    join(projectRoot, 'docs', 'archive', 'AUTH-001', 'AUTH-001-progress.json'),
    JSON.stringify(createProgressData(), null, 2) + '\n',
    'utf8',
  )

  return projectRoot
}

function runGit(projectRoot: string, ...args: string[]) {
  const result = spawnSync('git', args, {
    cwd: projectRoot,
    encoding: 'utf8',
  })

  expect(result.status).toBe(0)
  return result.stdout.trim()
}

function createGitProject() {
  const projectRoot = mkdtempSync(join(tmpdir(), 'hx-reset-git-script-'))
  tempDirs.push(projectRoot)

  mkdirSync(join(projectRoot, '.hx'), { recursive: true })
  mkdirSync(join(projectRoot, 'docs', 'requirement'), { recursive: true })
  mkdirSync(join(projectRoot, 'docs', 'plans'), { recursive: true })
  mkdirSync(join(projectRoot, 'src'), { recursive: true })

  runGit(projectRoot, 'init', '-b', 'feat/auth-001')
  runGit(projectRoot, 'config', 'user.name', 'Test User')
  runGit(projectRoot, 'config', 'user.email', 'test@example.com')

  writeFileSync(join(projectRoot, '.hx', 'config.yaml'), 'paths:\n  src: src\n', 'utf8')
  writeFileSync(join(projectRoot, 'src', 'feature.ts'), 'export const version = 1\n', 'utf8')
  runGit(projectRoot, 'add', '.')
  runGit(projectRoot, 'commit', '-m', 'base')

  writeFileSync(join(projectRoot, 'docs', 'requirement', 'AUTH-001.md'), '# Requirement\n', 'utf8')
  runGit(projectRoot, 'add', 'docs/requirement/AUTH-001.md')
  runGit(projectRoot, 'commit', '-m', 'add requirement')

  writeFileSync(join(projectRoot, 'docs', 'plans', 'AUTH-001.md'), '# Plan\n', 'utf8')
  writeFileSync(
    join(projectRoot, 'docs', 'plans', 'AUTH-001-progress.json'),
    JSON.stringify(createProgressData(), null, 2) + '\n',
    'utf8',
  )
  writeFileSync(join(projectRoot, 'src', 'feature.ts'), 'export const version = 2\n', 'utf8')
  runGit(projectRoot, 'add', '.')
  runGit(projectRoot, 'commit', '-m', 'feature progress')

  writeFileSync(join(projectRoot, 'src', 'feature.ts'), 'export const version = 3\n', 'utf8')
  writeFileSync(join(projectRoot, 'src', 'scratch.ts'), 'export const scratch = true\n', 'utf8')

  return projectRoot
}

function createWorkspaceGitProject() {
  const workspaceRoot = mkdtempSync(join(tmpdir(), 'hx-reset-workspace-script-'))
  tempDirs.push(workspaceRoot)

  const appRoot = join(workspaceRoot, 'apps', 'admin')
  mkdirSync(join(workspaceRoot, '.hx'), { recursive: true })
  mkdirSync(join(workspaceRoot, 'docs', 'requirement'), { recursive: true })
  mkdirSync(join(workspaceRoot, 'docs', 'plans'), { recursive: true })
  mkdirSync(join(appRoot, 'src'), { recursive: true })

  runGit(workspaceRoot, 'init', '-b', 'feat/auth-001')
  runGit(workspaceRoot, 'config', 'user.name', 'Test User')
  runGit(workspaceRoot, 'config', 'user.email', 'test@example.com')

  writeFileSync(join(workspaceRoot, '.hx', 'workspace.yaml'), [
    'version: 1',
    'projects:',
    '  - id: admin',
    '    path: ./apps/admin',
    '    type: node',
    '',
  ].join('\n'), 'utf8')
  writeFileSync(join(appRoot, 'src', 'feature.ts'), 'export const version = 1\n', 'utf8')
  runGit(workspaceRoot, 'add', '.')
  runGit(workspaceRoot, 'commit', '-m', 'base')

  writeFileSync(join(workspaceRoot, 'docs', 'requirement', 'AUTH-001.md'), '# Requirement\n', 'utf8')
  runGit(workspaceRoot, 'add', 'docs/requirement/AUTH-001.md')
  runGit(workspaceRoot, 'commit', '-m', 'add requirement')

  writeFileSync(join(workspaceRoot, 'docs', 'plans', 'AUTH-001.md'), '# Plan\n', 'utf8')
  writeFileSync(
    join(workspaceRoot, 'docs', 'plans', 'AUTH-001-progress.json'),
    JSON.stringify(createProgressData(), null, 2) + '\n',
    'utf8',
  )
  writeFileSync(join(appRoot, 'src', 'feature.ts'), 'export const version = 2\n', 'utf8')
  runGit(workspaceRoot, 'add', '.')
  runGit(workspaceRoot, 'commit', '-m', 'feature progress')

  writeFileSync(join(appRoot, 'src', 'feature.ts'), 'export const version = 3\n', 'utf8')
  writeFileSync(join(appRoot, 'src', 'scratch.ts'), 'export const scratch = true\n', 'utf8')

  return { workspaceRoot, appRoot }
}

describe('hx-reset script', () => {
  it('resets code doc and plan artifacts by default', () => {
    const projectRoot = createGitProject()
    const result = spawnSync('bun', [SCRIPT_PATH, 'AUTH-001'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    const summary = JSON.parse(result.stdout)
    expect(summary.ok).toBe(true)
    expect(summary.target).toBe('all')
    expect(summary.codeReset.upstream).toBeNull()
    expect(typeof summary.codeReset.resetTo).toBe('string')
    expect(summary.codeReset.cleaned).toContain('src/scratch.ts')
    expect(summary.removed).toContain('docs/requirement/AUTH-001.md')
    expect(summary.removed).toContain('docs/plans/AUTH-001.md')
    expect(summary.removed).toContain('docs/plans/AUTH-001-progress.json')
    expect(readFileSync(join(projectRoot, 'src', 'feature.ts'), 'utf8')).toBe('export const version = 1\n')
    expect(existsSync(join(projectRoot, 'src', 'scratch.ts'))).toBe(false)
    expect(existsSync(join(projectRoot, 'docs', 'requirement', 'AUTH-001.md'))).toBe(false)
    expect(existsSync(join(projectRoot, 'docs', 'plans', 'AUTH-001.md'))).toBe(false)
    expect(existsSync(join(projectRoot, 'docs', 'plans', 'AUTH-001-progress.json'))).toBe(false)
  })

  it('resets workspace-managed feature artifacts while code lives in child projects', () => {
    const { workspaceRoot, appRoot } = createWorkspaceGitProject()
    const result = spawnSync('bun', [SCRIPT_PATH, 'AUTH-001'], {
      cwd: workspaceRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    const summary = JSON.parse(result.stdout)
    expect(summary.ok).toBe(true)
    expect(summary.target).toBe('all')
    expect(summary.codeReset.cleaned).toContain('apps/admin/src/scratch.ts')
    expect(summary.removed).toContain('docs/requirement/AUTH-001.md')
    expect(summary.removed).toContain('docs/plans/AUTH-001.md')
    expect(summary.removed).toContain('docs/plans/AUTH-001-progress.json')
    expect(readFileSync(join(appRoot, 'src', 'feature.ts'), 'utf8')).toBe('export const version = 1\n')
    expect(existsSync(join(appRoot, 'src', 'scratch.ts'))).toBe(false)
    expect(existsSync(join(workspaceRoot, 'docs', 'requirement', 'AUTH-001.md'))).toBe(false)
    expect(existsSync(join(workspaceRoot, 'docs', 'plans', 'AUTH-001.md'))).toBe(false)
    expect(existsSync(join(workspaceRoot, 'docs', 'plans', 'AUTH-001-progress.json'))).toBe(false)
  })

  it('resets only plan artifacts for plan target', () => {
    const projectRoot = createProject()
    const result = spawnSync('bun', [SCRIPT_PATH, 'AUTH-001', 'plan'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    const summary = JSON.parse(result.stdout)
    expect(summary.ok).toBe(true)
    expect(summary.target).toBe('plan')
    expect(summary.removed).toContain('docs/plans/AUTH-001.md')
    expect(summary.removed).toContain('docs/plans/AUTH-001-progress.json')
    expect(summary.removed).not.toContain('docs/requirement/AUTH-001.md')
    expect(readFileSync(join(projectRoot, 'docs', 'requirement', 'AUTH-001.md'), 'utf8')).toBe('# Requirement\n')
  })

  it('resets doc target and clears downstream plan artifacts', () => {
    const projectRoot = createProject()
    const result = spawnSync('bun', [SCRIPT_PATH, 'AUTH-001', 'doc'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    const summary = JSON.parse(result.stdout)
    expect(summary.ok).toBe(true)
    expect(summary.target).toBe('doc')
    expect(summary.removed).toContain('docs/requirement/AUTH-001.md')
    expect(summary.removed).toContain('docs/plans/AUTH-001.md')
    expect(summary.removed).toContain('docs/plans/AUTH-001-progress.json')
  })

  it('rolls back code changes and keeps doc/plan for code target', () => {
    const projectRoot = createGitProject()
    const result = spawnSync('bun', [SCRIPT_PATH, 'AUTH-001', 'code'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    const summary = JSON.parse(result.stdout)
    expect(summary.ok).toBe(true)
    expect(summary.target).toBe('code')
    expect(summary.codeReset.upstream).toBeNull()
    expect(typeof summary.codeReset.resetTo).toBe('string')
    expect(summary.codeReset.cleaned).toContain('src/scratch.ts')
    expect(summary.removed).toEqual([])
    expect(summary.updated).toEqual(['docs/plans/AUTH-001-progress.json'])
    expect(summary.restored).toContain('docs/requirement/AUTH-001.md')
    expect(summary.restored).toContain('docs/plans/AUTH-001.md')
    expect(summary.restored).toContain('docs/plans/AUTH-001-progress.json')
    expect(readFileSync(join(projectRoot, 'src', 'feature.ts'), 'utf8')).toBe('export const version = 1\n')
    expect(existsSync(join(projectRoot, 'src', 'scratch.ts'))).toBe(false)
    expect(runGit(projectRoot, 'rev-parse', 'HEAD')).toBe(summary.codeReset.resetTo)
    expect(readFileSync(join(projectRoot, 'docs', 'requirement', 'AUTH-001.md'), 'utf8')).toBe('# Requirement\n')
    expect(readFileSync(join(projectRoot, 'docs', 'plans', 'AUTH-001.md'), 'utf8')).toBe('# Plan\n')

    const progress = JSON.parse(readFileSync(join(projectRoot, 'docs', 'plans', 'AUTH-001-progress.json'), 'utf8'))
    expect(progress.completedAt).toBeNull()
    expect(progress.lastRun).toBeNull()
    expect(progress.tasks).toEqual([
      {
        id: 'TASK-1',
        name: '实现登录接口',
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
        name: '接入登录页',
        status: 'pending',
        dependsOn: ['TASK-1'],
        parallelizable: true,
        output: '',
        startedAt: null,
        completedAt: null,
        durationSeconds: null,
      },
    ])
  })

  it('fails code target outside git repository', () => {
    const projectRoot = createProject()
    const result = spawnSync('bun', [SCRIPT_PATH, 'AUTH-001', 'code'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('当前项目不是 git 仓库')
  })

  it('fails for invalid reset target', () => {
    const projectRoot = createProject()
    const result = spawnSync('bun', [SCRIPT_PATH, 'AUTH-001', 'invalid'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('未知重置目标')
  })
})
