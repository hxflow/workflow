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
})
