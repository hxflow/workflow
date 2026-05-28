import { afterEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const SCRIPT_PATH = resolve(process.cwd(), 'hxflow', 'scripts', 'tools', 'server.ts')
const tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

function createProject() {
  const projectRoot = mkdtempSync(join(tmpdir(), 'hx-server-script-'))
  tempDirs.push(projectRoot)
  return projectRoot
}

describe('hx-server script', () => {
  it('returns discovery mode when no server is recorded', () => {
    const projectRoot = createProject()
    writeFileSync(
      join(projectRoot, 'package.json'),
      JSON.stringify({
        scripts: {
          build: 'vite build',
          dev: 'vite --host 0.0.0.0',
        },
      }),
      'utf8',
    )
    writeFileSync(join(projectRoot, 'bun.lock'), '', 'utf8')

    const result = spawnSync('bun', [SCRIPT_PATH], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    const summary = JSON.parse(result.stdout)
    expect(summary.ok).toBe(false)
    expect(summary.mode).toBe('discover')
    expect(summary.needsAiDiscovery).toBe(true)
    expect(summary.discovery.goal).toBe('分析项目并找到可真实启动的服务命令')
    expect(summary.discovery.saveAfterSuccess).toBe(true)
  })

  it('saves and reads a verified server command', () => {
    const projectRoot = createProject()
    mkdirSync(join(projectRoot, '.hx'), { recursive: true })

    const saveResult = spawnSync('bun', [
      SCRIPT_PATH,
      'save',
      'web',
      '--cwd',
      '.',
      '--command',
      'bun run dev',
      '--type',
      'frontend',
      '--url',
      'http://localhost:5173',
    ], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(saveResult.status).toBe(0)
    const saveSummary = JSON.parse(saveResult.stdout)
    expect(saveSummary.ok).toBe(true)
    expect(saveSummary.record.command).toBe('bun run dev')
    expect(existsSync(join(projectRoot, '.hx', 'config.yaml'))).toBe(true)
    expect(readFileSync(join(projectRoot, '.hx', 'config.yaml'), 'utf8')).toContain('servers:')

    const readResult = spawnSync('bun', [SCRIPT_PATH], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(readResult.status).toBe(0)
    const readSummary = JSON.parse(readResult.stdout)
    expect(readSummary.ok).toBe(true)
    expect(readSummary.mode).toBe('recorded')
    expect(readSummary.recommended).toEqual({
      id: 'web',
      cwd: '.',
      command: 'bun run dev',
      type: 'frontend',
      url: 'http://localhost:5173',
    })
  })

  it('filters recorded servers by id or cwd', () => {
    const projectRoot = createProject()
    mkdirSync(join(projectRoot, '.hx'), { recursive: true })
    writeFileSync(
      join(projectRoot, '.hx', 'config.yaml'),
      `servers:
  - id: admin
    path: ./apps/admin
    cwd: apps/admin
    command: pnpm dev
    type: frontend
  - id: api
    cwd: services/api
    command: go run .
    type: backend
`,
      'utf8',
    )

    const byId = spawnSync('bun', [SCRIPT_PATH, 'api'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })
    const byCwd = spawnSync('bun', [SCRIPT_PATH, 'apps/admin'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(JSON.parse(byId.stdout).recommended.command).toBe('go run .')
    expect(JSON.parse(byCwd.stdout).recommended.command).toBe('pnpm dev')
  })

  it('uses workspace config for saved server records', () => {
    const projectRoot = createProject()
    mkdirSync(join(projectRoot, '.hx'), { recursive: true })
    writeFileSync(join(projectRoot, '.hx', 'workspace.yaml'), 'projects: []\n', 'utf8')

    const result = spawnSync('bun', [
      SCRIPT_PATH,
      'save',
      'api',
      '--cwd',
      'services/api',
      '--command',
      'go run .',
      '--type',
      'backend',
    ], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    expect(existsSync(join(projectRoot, '.hx', 'config.yaml'))).toBe(false)
    expect(readFileSync(join(projectRoot, '.hx', 'workspace.yaml'), 'utf8')).toContain('id: "api"')
  })

  it('returns discovery mode without guessing when no record exists', () => {
    const projectRoot = createProject()
    writeFileSync(join(projectRoot, 'README.md'), '# empty\n', 'utf8')

    const result = spawnSync('bun', [SCRIPT_PATH], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    const summary = JSON.parse(result.stdout)
    expect(summary.ok).toBe(false)
    expect(summary.needsAiDiscovery).toBe(true)
    expect(summary.discovery).not.toBeNull()
  })
})
