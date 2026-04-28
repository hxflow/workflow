import { afterEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const SCRIPT_PATH = resolve(process.cwd(), 'hxflow', 'scripts', 'tools', 'init.ts')
const tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

function createProject() {
  const projectRoot = mkdtempSync(join(tmpdir(), 'hx-init-script-'))
  tempDirs.push(projectRoot)
  return projectRoot
}

describe('hx-init script', () => {
  it('materializes all rule templates into .hx/rules for user customization', () => {
    const projectRoot = createProject()
    const result = spawnSync('bun', [SCRIPT_PATH], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)

    const summary = JSON.parse(result.stdout)
    expect(summary.ok).toBe(true)
    expect(summary.status).toBe('initialized')
    expect(summary.written.some((file: string) => file.endsWith('.hx/config.yaml'))).toBe(true)
    expect(summary.written.some((file: string) => file.endsWith('.hx/rules/requirement-template.md'))).toBe(true)
    expect(summary.written.some((file: string) => file.endsWith('.hx/rules/plan-template.md'))).toBe(true)
    expect(summary.written.some((file: string) => file.endsWith('.hx/rules/bugfix-requirement-template.md'))).toBe(true)
    expect(summary.written.some((file: string) => file.endsWith('.hx/rules/bugfix-plan-template.md'))).toBe(true)
    expect(summary.written.some((file: string) => file.endsWith('.hx/pipelines/default.yaml'))).toBe(true)
    expect(summary.missing).toEqual([])
    expect(summary.nextAction).toBe('hx doc <feature>')

    const rulesDir = join(projectRoot, '.hx', 'rules')
    const configYaml = readFileSync(join(projectRoot, '.hx', 'config.yaml'), 'utf8')
    expect(configYaml).toContain('src: src')
    expect(configYaml).toContain('default: .hx/pipelines/default.yaml')
    expect(existsSync(join(rulesDir, 'requirement-template.md'))).toBe(true)
    expect(existsSync(join(rulesDir, 'plan-template.md'))).toBe(true)
    expect(existsSync(join(rulesDir, 'bugfix-requirement-template.md'))).toBe(true)
    expect(existsSync(join(rulesDir, 'bugfix-plan-template.md'))).toBe(true)
    expect(existsSync(join(projectRoot, '.hx', 'hooks'))).toBe(false)
    expect(existsSync(join(projectRoot, '.hx', 'pipelines', 'default.yaml'))).toBe(true)
  })

  it('keeps existing customized template content untouched', () => {
    const projectRoot = createProject()
    const rulesDir = join(projectRoot, '.hx', 'rules')
    mkdirSync(rulesDir, { recursive: true })
    writeFileSync(join(rulesDir, 'requirement-template.md'), '# Custom Requirement Template\n', 'utf8')

    const result = spawnSync('bun', [SCRIPT_PATH], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    expect(readFileSync(join(rulesDir, 'requirement-template.md'), 'utf8')).toBe('# Custom Requirement Template\n')
  })

  it('adds default pipeline registration to existing config without replacing custom values', () => {
    const projectRoot = createProject()
    mkdirSync(join(projectRoot, '.hx'), { recursive: true })
    writeFileSync(
      join(projectRoot, '.hx', 'config.yaml'),
      `paths:
  src: services
runtime:
  hooks: {}
  pipelines: {}
`,
      'utf8',
    )

    const result = spawnSync('bun', [SCRIPT_PATH], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)

    const configYaml = readFileSync(join(projectRoot, '.hx', 'config.yaml'), 'utf8')
    expect(configYaml).toContain('src: services')
    expect(configYaml).toContain('default: .hx/pipelines/default.yaml')
    expect(existsSync(join(projectRoot, '.hx', 'pipelines', 'default.yaml'))).toBe(true)
  })

  it('keeps an existing custom default pipeline registration', () => {
    const projectRoot = createProject()
    mkdirSync(join(projectRoot, '.hx'), { recursive: true })
    writeFileSync(
      join(projectRoot, '.hx', 'config.yaml'),
      `runtime:
  hooks: {}
  pipelines:
    default: .hx/pipelines/custom.yaml
`,
      'utf8',
    )

    const result = spawnSync('bun', [SCRIPT_PATH], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)

    const configYaml = readFileSync(join(projectRoot, '.hx', 'config.yaml'), 'utf8')
    expect(configYaml).toContain('default: .hx/pipelines/custom.yaml')
    expect(configYaml).not.toContain('default: .hx/pipelines/default.yaml')
    expect(existsSync(join(projectRoot, '.hx', 'pipelines', 'default.yaml'))).toBe(true)
  })

  it('initializes a workspace when the current directory contains multiple projects', () => {
    const workspaceRoot = createProject()
    mkdirSync(join(workspaceRoot, 'admin-web'), { recursive: true })
    mkdirSync(join(workspaceRoot, 'order-service', '.git'), { recursive: true })
    writeFileSync(join(workspaceRoot, 'admin-web', 'package.json'), '{}\n', 'utf8')

    const result = spawnSync('bun', [SCRIPT_PATH], {
      cwd: workspaceRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)

    const summary = JSON.parse(result.stdout)
    expect(summary.ok).toBe(true)
    expect(summary.mode).toBe('workspace')
    expect(summary.status).toBe('initialized')
    expect(summary.written.some((file: string) => file.endsWith('.hx/workspace.yaml'))).toBe(true)
    expect(summary.written.some((file: string) => file.endsWith('.hx/rules/requirement-template.md'))).toBe(true)
    expect(summary.written.some((file: string) => file.endsWith('.hx/pipelines/default.yaml'))).toBe(true)
    expect(existsSync(join(workspaceRoot, '.hx', 'workspace.yaml'))).toBe(true)
    expect(existsSync(join(workspaceRoot, '.hx', 'config.yaml'))).toBe(false)
    expect(existsSync(join(workspaceRoot, '.hx', 'rules', 'requirement-template.md'))).toBe(true)
    expect(existsSync(join(workspaceRoot, '.hx', 'pipelines', 'default.yaml'))).toBe(true)
    expect(summary.projects.map((project: { id: string }) => project.id)).toEqual(['admin-web', 'order-service'])

    const workspaceYaml = readFileSync(join(workspaceRoot, '.hx', 'workspace.yaml'), 'utf8')
    expect(workspaceYaml).toContain('projects:')
    expect(workspaceYaml).toContain('id: admin-web')
    expect(workspaceYaml).toContain('path: ./admin-web')
    expect(workspaceYaml).toContain('id: order-service')
    expect(workspaceYaml).toContain('default: .hx/pipelines/default.yaml')
    expect(workspaceYaml).toContain('rules:')
    expect(workspaceYaml).toContain('requirement: .hx/rules/requirement-template.md')
  })

  it('initializes an explicit child target as a project from a workspace directory', () => {
    const workspaceRoot = createProject()
    mkdirSync(join(workspaceRoot, 'order-service'), { recursive: true })

    const result = spawnSync('bun', [SCRIPT_PATH, './order-service'], {
      cwd: workspaceRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)

    const summary = JSON.parse(result.stdout)
    expect(summary.ok).toBe(true)
    expect(summary.mode).toBe('project')
    expect(existsSync(join(workspaceRoot, 'order-service', '.hx', 'config.yaml'))).toBe(true)
    expect(existsSync(join(workspaceRoot, '.hx', 'workspace.yaml'))).toBe(false)
  })

  it('rejects directories that contain both workspace and project config files', () => {
    const projectRoot = createProject()
    mkdirSync(join(projectRoot, '.hx'), { recursive: true })
    writeFileSync(join(projectRoot, '.hx', 'config.yaml'), 'paths:\n  src: src\n', 'utf8')
    writeFileSync(join(projectRoot, '.hx', 'workspace.yaml'), 'version: 1\nprojects: []\n', 'utf8')

    const result = spawnSync('bun', [SCRIPT_PATH], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('同时存在 .hx/config.yaml 与 .hx/workspace.yaml')
  })
})
