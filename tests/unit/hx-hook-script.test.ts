import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const SCRIPT_PATH = resolve(process.cwd(), 'hxflow', 'scripts', 'lib', 'hook.ts')
const tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

function createProject() {
  const projectRoot = mkdtempSync(join(tmpdir(), 'hx-hook-script-'))
  tempDirs.push(projectRoot)
  mkdirSync(join(projectRoot, '.hx'), { recursive: true })
  return projectRoot
}

function writeGuardConfig(projectRoot: string) {
  writeFileSync(
    join(projectRoot, '.hx', 'config.yaml'),
    `paths:
  src: src
`,
    'utf8',
  )
}

function writeGuardArtifacts(projectRoot: string) {
  mkdirSync(join(projectRoot, 'docs', 'requirement'), { recursive: true })
  mkdirSync(join(projectRoot, 'docs', 'plans'), { recursive: true })
  mkdirSync(join(projectRoot, 'src', 'api'), { recursive: true })
  writeFileSync(join(projectRoot, 'docs', 'requirement', 'AUTH-001.md'), '# Requirement\n', 'utf8')
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
    JSON.stringify({
      feature: 'AUTH-001',
      requirementDoc: 'docs/requirement/AUTH-001.md',
      planDoc: 'docs/plans/AUTH-001.md',
      createdAt: '2026-04-10T10:00:00Z',
      updatedAt: '2026-04-10T10:00:00Z',
      completedAt: null,
      lastRun: null,
      tasks: [
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
      ],
    }, null, 2),
    'utf8',
  )
}

function writeGuardArtifactsFor(projectRoot: string, feature: string) {
  mkdirSync(join(projectRoot, 'docs', 'requirement'), { recursive: true })
  mkdirSync(join(projectRoot, 'docs', 'plans'), { recursive: true })
  writeFileSync(join(projectRoot, 'docs', 'requirement', `${feature}.md`), '# Requirement\n', 'utf8')
  writeFileSync(join(projectRoot, 'docs', 'plans', `${feature}.md`), '# Plan\n', 'utf8')
  writeFileSync(
    join(projectRoot, 'docs', 'plans', `${feature}-progress.json`),
    JSON.stringify({
      feature,
      requirementDoc: `docs/requirement/${feature}.md`,
      planDoc: `docs/plans/${feature}.md`,
      createdAt: '2026-04-10T10:00:00Z',
      updatedAt: '2026-04-10T10:00:00Z',
      completedAt: null,
      lastRun: null,
      tasks: [
        {
          id: 'TASK-1',
          name: '实现功能',
          status: 'pending',
          dependsOn: [],
          parallelizable: false,
          output: '',
          startedAt: null,
          completedAt: null,
          durationSeconds: null,
        },
      ],
    }, null, 2),
    'utf8',
  )
}

function writeGuardProgressOnly(projectRoot: string, feature: string) {
  mkdirSync(join(projectRoot, 'docs', 'plans'), { recursive: true })
  writeFileSync(
    join(projectRoot, 'docs', 'plans', `${feature}-progress.json`),
    JSON.stringify({
      feature,
      requirementDoc: `docs/requirement/${feature}.md`,
      planDoc: `docs/plans/${feature}.md`,
      createdAt: '2026-04-10T10:00:00Z',
      updatedAt: '2026-04-10T10:00:00Z',
      completedAt: null,
      lastRun: null,
      tasks: [
        {
          id: 'TASK-1',
          name: '实现功能',
          status: 'pending',
          dependsOn: [],
          parallelizable: false,
          output: '',
          startedAt: null,
          completedAt: null,
          durationSeconds: null,
        },
      ],
    }, null, 2),
    'utf8',
  )
}

describe('hx-hook script', () => {
  it('resolves configured pre-hook for doc', () => {
    const projectRoot = createProject()
    writeFileSync(
      join(projectRoot, '.hx', 'config.yaml'),
      `runtime:
  hooks:
    doc:
      pre:
        - .hx/hooks/pre_doc.md
`,
      'utf8',
    )
    const result = spawnSync('bun', [SCRIPT_PATH, 'resolve', 'doc'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    const parsed = JSON.parse(result.stdout)
    expect(parsed.ok).toBe(true)
    expect(parsed.command).toBe('doc')
    expect(parsed.preHooks).toEqual([
      { scope: 'project', phase: 'pre', path: '.hx/hooks/pre_doc.md' },
    ])
    expect(parsed.postHooks).toEqual([])
  })

  it('returns empty hook lists for commands without hook files', () => {
    const projectRoot = createProject()
    const result = spawnSync('bun', [SCRIPT_PATH, 'resolve', 'plan'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    const parsed = JSON.parse(result.stdout)
    expect(parsed.ok).toBe(true)
    expect(parsed.command).toBe('plan')
    expect(parsed.preHooks).toEqual([])
    expect(parsed.postHooks).toEqual([])
  })

  it('resolves configured post-hook for doc', () => {
    const projectRoot = createProject()
    writeFileSync(
      join(projectRoot, '.hx', 'config.yaml'),
      `runtime:
  hooks:
    doc:
      post:
        - .hx/hooks/post_doc.md
`,
      'utf8',
    )
    const result = spawnSync('bun', [SCRIPT_PATH, 'resolve', 'doc'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    const parsed = JSON.parse(result.stdout)
    expect(parsed.ok).toBe(true)
    expect(parsed.preHooks).toEqual([])
    expect(parsed.postHooks).toEqual([
      { scope: 'project', phase: 'post', path: '.hx/hooks/post_doc.md' },
    ])
  })

  it('rejects hx-prefixed command names', () => {
    const projectRoot = createProject()
    const result = spawnSync('bun', [SCRIPT_PATH, 'resolve', 'hx-doc'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('hx-doc')
    expect(result.stderr).toContain('无效')
  })

  it('rejects retired check command names', () => {
    const projectRoot = createProject()
    const result = spawnSync('bun', [SCRIPT_PATH, 'resolve', 'check'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('check')
    expect(result.stderr).toContain('无效')
  })

  it('rejects hx-prefixed hook config keys', () => {
    const projectRoot = createProject()
    writeFileSync(
      join(projectRoot, '.hx', 'config.yaml'),
      `runtime:
  hooks:
    hx-doc:
      pre:
        - .hx/hooks/pre_doc.md
`,
      'utf8',
    )

    const result = spawnSync('bun', [SCRIPT_PATH, 'resolve', 'doc'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('runtime.hooks.hx-doc 无效')
  })

  it('rejects retired check hook config keys', () => {
    const projectRoot = createProject()
    writeFileSync(
      join(projectRoot, '.hx', 'config.yaml'),
      `runtime:
  hooks:
    check:
      pre:
        - .hx/hooks/pre_check.md
`,
      'utf8',
    )

    const result = spawnSync('bun', [SCRIPT_PATH, 'resolve', 'doc'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('runtime.hooks.check 无效')
  })

  it('skips guard-write for non-source paths', () => {
    const projectRoot = createProject()
    const result = spawnSync('bun', [SCRIPT_PATH, 'guard-write', 'README.md'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    const parsed = JSON.parse(result.stdout)
    expect(parsed.ok).toBe(true)
    expect(parsed.applies).toBe(false)
  })

  it('skips guard-write when source writes have no hxflow context', () => {
    const projectRoot = createProject()
    const result = spawnSync('bun', [SCRIPT_PATH, 'guard-write', 'src/api/auth.ts'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    const parsed = JSON.parse(result.stdout)
    expect(parsed.ok).toBe(true)
    expect(parsed.applies).toBe(false)
  })

  it('blocks source writes before hx init when a feature is explicit', () => {
    const projectRoot = createProject()
    const result = spawnSync('bun', [SCRIPT_PATH, 'guard-write', '--feature', 'AUTH-001', 'src/api/auth.ts'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(1)
    const parsed = JSON.parse(result.stderr)
    expect(parsed.ok).toBe(false)
    expect(parsed.errors).toContain('未找到 .hx/config.yaml 或 .hx/workspace.yaml，不能直接写源码')
  })

  it('blocks source writes before hx init in strict mode', () => {
    const projectRoot = createProject()
    const result = spawnSync('bun', [SCRIPT_PATH, 'guard-write', 'src/api/auth.ts'], {
      cwd: projectRoot,
      encoding: 'utf8',
      env: { ...process.env, HXFLOW_GUARD_MODE: 'strict' },
    })

    expect(result.status).toBe(1)
    const parsed = JSON.parse(result.stderr)
    expect(parsed.ok).toBe(false)
    expect(parsed.errors).toContain('没有找到可对应当前上下文的 feature 文档组，不能判断当前源码变更属于哪个 hxflow feature')
  })

  it('skips guard-write when .hx exists but no active hxflow feature is inferable', () => {
    const projectRoot = createProject()
    writeGuardConfig(projectRoot)
    const result = spawnSync('bun', [SCRIPT_PATH, 'guard-write', 'src/api/auth.ts'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    const parsed = JSON.parse(result.stdout)
    expect(parsed.ok).toBe(true)
    expect(parsed.applies).toBe(false)
  })

  it('skips guard-write when progress lacks matching requirement and plan docs', () => {
    const projectRoot = createProject()
    writeGuardConfig(projectRoot)
    writeGuardProgressOnly(projectRoot, 'AUTH-001')

    const result = spawnSync('bun', [SCRIPT_PATH, 'guard-write', 'src/api/auth.ts'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    const parsed = JSON.parse(result.stdout)
    expect(parsed.ok).toBe(true)
    expect(parsed.applies).toBe(false)
  })

  it('infers hxflow context from a single complete active feature artifact group', () => {
    const projectRoot = createProject()
    writeGuardConfig(projectRoot)
    writeGuardArtifacts(projectRoot)

    const result = spawnSync('bun', [SCRIPT_PATH, 'guard-write', 'src/api/auth.ts'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    const parsed = JSON.parse(result.stdout)
    expect(parsed.ok).toBe(true)
    expect(parsed.applies).toBe(true)
    expect(parsed.feature).toBe('AUTH-001')
  })

  it('blocks when multiple complete active feature artifact groups make hxflow context ambiguous', () => {
    const projectRoot = createProject()
    writeGuardConfig(projectRoot)
    writeGuardArtifactsFor(projectRoot, 'AUTH-001')
    writeGuardArtifactsFor(projectRoot, 'BILLING-001')

    const result = spawnSync('bun', [SCRIPT_PATH, 'guard-write', 'src/api/auth.ts'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(1)
    const parsed = JSON.parse(result.stderr)
    expect(parsed.ok).toBe(false)
    expect(parsed.errors[0]).toContain('存在多个活跃 feature')
  })

  it('allows source writes when hxflow artifacts and runnable task scope match', () => {
    const projectRoot = createProject()
    writeGuardConfig(projectRoot)
    writeGuardArtifacts(projectRoot)

    const result = spawnSync('bun', [SCRIPT_PATH, 'guard-write', '--feature', 'AUTH-001', 'src/api/auth.ts'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    const parsed = JSON.parse(result.stdout)
    expect(parsed.ok).toBe(true)
    expect(parsed.feature).toBe('AUTH-001')
    expect(parsed.allowedTasks).toEqual([
      { id: 'TASK-1', name: '实现登录接口', status: 'pending' },
    ])
  })

  it('blocks source writes outside the current task scope', () => {
    const projectRoot = createProject()
    writeGuardConfig(projectRoot)
    writeGuardArtifacts(projectRoot)

    const result = spawnSync('bun', [SCRIPT_PATH, 'guard-write', '--feature', 'AUTH-001', 'src/api/profile.ts'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(1)
    const parsed = JSON.parse(result.stderr)
    expect(parsed.ok).toBe(false)
    expect(parsed.errors).toContain('源码路径不在当前可执行任务修改范围内：src/api/profile.ts')
  })
})
