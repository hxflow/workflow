import { execFileSync, spawnSync } from 'child_process'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'

import { afterEach, describe, expect, it } from 'bun:test'

const tempDirs = []

function createTempDir(prefix) {
  const dir = mkdtempSync(resolve(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

function runNode(args) {
  return execFileSync(process.execPath, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
  })
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop(), { recursive: true, force: true })
  }
})

describe('hx cli integration', () => {
  it('prints help and version', () => {
    const help = runNode(['bin/hx.js', '--help'])
    expect(help).toContain('Harness Workflow CLI')
    expect(help).toContain('migrate')
    expect(help).toContain('upgrade')
    expect(help).toContain('uninstall')
    expect(help).toContain('本地工作流命令')
    expect(help).toContain('plan')
    expect(help).toContain('go')
    expect(runNode(['bin/hx.js', 'version'])).toMatch(/hx v\d+\.\d+\.\d+/)
  })

  it('runs uninstall and shows preview without --force', () => {
    const userHxDir = createTempDir('hx-uninstall-user-')

    const result = spawnSync(
      process.execPath,
      ['bin/hx.js', 'uninstall', '--user-hx-dir', userHxDir],
      { cwd: process.cwd(), encoding: 'utf8' }
    )

    expect(result.status).toBe(0)
  })

  it('runs upgrade with dry-run', () => {
    const result = spawnSync(
      process.execPath,
      ['bin/hx.js', 'upgrade', '--dry-run'],
      { cwd: process.cwd(), encoding: 'utf8' }
    )

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Harness Workflow · upgrade (dry-run)')
    expect(result.stdout).toContain('[dry-run] npm install -g')
    expect(result.stdout).toContain('[dry-run] hx setup')
  })

  it('runs migrate with current default targets', () => {
    const userHxDir = createTempDir('hx-migrate-user-')
    const userClaudeDir = createTempDir('hx-migrate-claude-')
    const userAgentsDir = createTempDir('hx-migrate-agents-')

    const result = spawnSync(
      process.execPath,
      [
        'bin/hx.js',
        'migrate',
        '--dry-run',
        '--user-hx-dir',
        userHxDir,
        '--user-claude-dir',
        userClaudeDir,
        '--user-agents-dir',
        userAgentsDir,
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      }
    )

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Harness Workflow · migrate')
    expect(result.stdout).toContain('source      → default')
    expect(result.stdout).toContain('targets     → claude, agents')
  })

  it('runs migrate when the original cwd has been removed', () => {
    const userHxDir = createTempDir('hx-migrate-deleted-user-')
    const userClaudeDir = createTempDir('hx-migrate-deleted-claude-')
    const userAgentsDir = createTempDir('hx-migrate-deleted-agents-')
    const removedCwd = createTempDir('hx-migrate-removed-cwd-')

    const entryPath = resolve(process.cwd(), 'bin', 'hx.js')
    const script = `
      import { rmSync } from 'node:fs'
      import { chdir } from 'node:process'
      import { pathToFileURL } from 'node:url'

      chdir(${JSON.stringify(removedCwd)})
      rmSync(${JSON.stringify(removedCwd)}, { recursive: true, force: true })
      process.argv = [
        process.execPath,
        ${JSON.stringify(entryPath)},
        'migrate',
        '--dry-run',
        '--user-hx-dir',
        ${JSON.stringify(userHxDir)},
        '--user-claude-dir',
        ${JSON.stringify(userClaudeDir)},
        '--user-agents-dir',
        ${JSON.stringify(userAgentsDir)},
      ]
      await import(pathToFileURL(${JSON.stringify(entryPath)}).href)
    `

    const isBun = typeof Bun !== 'undefined'
    const evalArgs = isBun ? ['--eval', script] : ['--input-type=module', '-e', script]
    const result = spawnSync(process.execPath, evalArgs, {
      cwd: process.cwd(),
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Harness Workflow · migrate')
    expect(result.stdout).toContain('Harness Workflow · setup (dry-run)')
  })

  it('reports agent contract commands without executing local scripts', () => {
    const result = spawnSync(process.execPath, ['bin/hx.js', 'hx-init'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('"hx-init" 是 agent command contract')
  })

  it('runs local workflow commands through the CLI entrypoint', () => {
    const projectRoot = createTempDir('hx-go-entry-')
    const entryPath = resolve(process.cwd(), 'bin', 'hx.js')
    const result = spawnSync(process.execPath, [entryPath, 'go', 'AUTH-001'], {
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
    expect(parsed.executedSteps[0]).toMatchObject({ id: 'doc', ok: true })
  })

  it('reports unknown commands', () => {
    const result = spawnSync(process.execPath, ['bin/hx.js', 'unknown-command'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('未知命令: unknown-command')
    expect(result.stderr).toContain('当前 CLI 可直接执行: setup, migrate, upgrade, uninstall, version, progress, feature, archive, restore, status, plan, run, check, mr, go')
  })
})
