import { afterEach, describe, expect, it } from 'vitest'
import { existsSync, lstatSync, mkdtempSync, readFileSync, readlinkSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const tempDirs = []

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop(), { recursive: true, force: true })
  }
})

describe('workflow cli integration', () => {
  it('installs framework assets including .claude and .CLAUDE.md entrypoint', () => {
    const targetRoot = makeTempDir('hx-install-integration-')
    const result = runCli(ROOT, 'scripts/hx-install.cjs', [targetRoot, '--yes', '--profile', 'mobile:ios', '--skip-install'])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Harness Workflow Framework 安装完成')
    expect(readlinkSync(resolve(targetRoot, '.CLAUDE.md'))).toBe('AGENTS.md')
    expect(existsSync(resolve(targetRoot, '.claude/commands/hx-run.md'))).toBe(true)
    expect(existsSync(resolve(targetRoot, '.claude/skills/gitlab/SKILL.md'))).toBe(true)

    const config = JSON.parse(readFileSync(resolve(targetRoot, 'harness.config.json'), 'utf8'))
    expect(config.defaultProfile).toBe('mobile:ios')
  })

  it('runs doc, plan, review and ctx scripts against an installed project', () => {
    const targetRoot = makeTempDir('hx-workflow-integration-')
    const install = runCli(ROOT, 'scripts/hx-install.cjs', [targetRoot, '--yes', '--profile', 'backend', '--skip-install'])
    expect(install.status).toBe(0)

    const doc = runCli(targetRoot, 'scripts/hx-new-doc.js', ['order-search'])
    expect(doc.status).toBe(0)
    expect(doc.stdout).toContain('docs/requirement/order-search.md')

    const plan = runCli(targetRoot, 'scripts/hx-new-plan.js', ['order-search'])
    expect(plan.status).toBe(0)
    expect(plan.stdout).toContain('docs/plans/order-search.md')

    const progress = JSON.parse(readFileSync(resolve(targetRoot, 'docs/plans/order-search-progress.json'), 'utf8'))
    expect(progress.profile).toBe('backend')
    expect(progress.requirementDoc).toBe('docs/requirement/order-search.md')
    expect(progress.tasks.length).toBeGreaterThan(0)

    const review = runCli(targetRoot, 'scripts/hx-review-checklist.js', [])
    expect(review.status).toBe(0)
    expect(review.stdout).toContain('服务端')

    const ctx = runCli(targetRoot, 'scripts/hx-ctx-check.js', [])
    expect(ctx.status).toBe(0)
    expect(ctx.stdout).toContain('全部通过')

    expect(lstatSync(resolve(targetRoot, '.CLAUDE.md')).isSymbolicLink()).toBe(true)
  })
})

function runCli(cwd, scriptPath, args) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      FORCE_COLOR: '0'
    }
  })
}

function makeTempDir(prefix) {
  const dir = mkdtempSync(resolve(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}
