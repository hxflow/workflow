import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const SCRIPT_PATH = resolve(process.cwd(), 'hxflow', 'scripts', 'tools', 'doc.ts')
const tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

function createProject() {
  const projectRoot = mkdtempSync(join(tmpdir(), 'hx-doc-script-'))
  tempDirs.push(projectRoot)
  mkdirSync(join(projectRoot, '.hx', 'rules'), { recursive: true })
  mkdirSync(join(projectRoot, 'docs', 'requirement'), { recursive: true })
  mkdirSync(join(projectRoot, 'specs'), { recursive: true })
  writeFileSync(
    join(projectRoot, '.hx', 'config.yaml'),
    `rules:
  templates:
    requirement: .hx/rules/requirement-template.md
    bugfixRequirement: .hx/rules/bugfix-requirement-template.md
    plan: .hx/rules/plan-template.md
    bugfixPlan: .hx/rules/bugfix-plan-template.md
`,
    'utf8',
  )
  writeFileSync(
    join(projectRoot, '.hx', 'rules', 'requirement-template.md'),
    `# Custom Requirement Template

> Feature: SHOULD-NOT-BE-USED
> Display Name: SHOULD-NOT-BE-USED
> Source ID: SHOULD-NOT-BE-USED
> Source Fingerprint: SHOULD-NOT-BE-USED
> Type: feature

## 背景

- 自定义正文
`,
    'utf8',
  )
  writeFileSync(join(projectRoot, '.hx', 'rules', 'bugfix-requirement-template.md'), '# Custom Bugfix Requirement Template\n', 'utf8')
  writeFileSync(join(projectRoot, 'specs', 'AUTH-001.md'), '# Auth source\n', 'utf8')
  return projectRoot
}

function createWorkspaceWithSourceDocs() {
  const projectRoot = mkdtempSync(join(tmpdir(), 'hx-doc-workspace-'))
  tempDirs.push(projectRoot)
  mkdirSync(join(projectRoot, '.hx', 'rules'), { recursive: true })
  mkdirSync(join(projectRoot, 'docs', 'requirement'), { recursive: true })
  mkdirSync(join(projectRoot, 'console', 'docs', 'product', 'modules'), { recursive: true })
  writeFileSync(
    join(projectRoot, '.hx', 'workspace.yaml'),
    `version: 1

rules:
  templates:
    requirement: .hx/rules/requirement-template.md
    bugfixRequirement: .hx/rules/bugfix-requirement-template.md
    plan: .hx/rules/plan-template.md
    bugfixPlan: .hx/rules/bugfix-plan-template.md

projects:
  - id: console
    path: ./console
    type: unknown
`,
    'utf8',
  )
  writeFileSync(join(projectRoot, '.hx', 'rules', 'requirement-template.md'), '# Requirement Template\n\n## 背景\n', 'utf8')
  writeFileSync(join(projectRoot, '.hx', 'rules', 'bugfix-requirement-template.md'), '# Bugfix Requirement Template\n', 'utf8')
  writeFileSync(
    join(projectRoot, 'console', 'docs', 'product', 'modules', '14-cli-auth.md'),
    '# 14 · CLI Auth（OAuth 2.0 Device Flow）\n\n## 1. 职责边界\n',
    'utf8',
  )
  return projectRoot
}

describe('hx-doc script', () => {
  it('reads requirement template from rules.templates config', () => {
    const projectRoot = createProject()
    const result = spawnSync('bun', [SCRIPT_PATH, 'context', 'AUTH-001'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    const summary = JSON.parse(result.stdout)
    expect(summary.ok).toBe(true)
    expect(summary.headerTemplate).toContain('> Feature: AUTH-001')
    expect(summary.headerTemplate).toContain('> Type: feature')
    expect(summary.templateContent).toContain('# Custom Requirement Template')
    expect(summary.templateContent).toContain('## 背景')
    expect(summary.templateContent).not.toContain('SHOULD-NOT-BE-USED')
  })

  it('fails when rules.templates.requirement is missing', () => {
    const projectRoot = createProject()
    writeFileSync(
      join(projectRoot, '.hx', 'config.yaml'),
      `rules:
  templates:
    bugfixRequirement: .hx/rules/bugfix-requirement-template.md
    plan: .hx/rules/plan-template.md
    bugfixPlan: .hx/rules/bugfix-plan-template.md
`,
      'utf8',
    )

    const result = spawnSync('bun', [SCRIPT_PATH, 'context', 'AUTH-001'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('rules.templates.requirement')
  })

  it('resolves a unique numeric source-file prefix to its source basename in a workspace', () => {
    const projectRoot = createWorkspaceWithSourceDocs()
    const result = spawnSync('bun', [SCRIPT_PATH, 'context', '14'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    const summary = JSON.parse(result.stdout)
    expect(summary.ok).toBe(true)
    expect(summary.requestedFeature).toBe('14')
    expect(summary.feature).toBe('14-cli-auth')
    expect(summary.requirementDoc.endsWith('/docs/requirement/14-cli-auth.md')).toBe(true)
    expect(summary.sourceFile.endsWith('/console/docs/product/modules/14-cli-auth.md')).toBe(true)
    expect(summary.sourceContent).toContain('CLI Auth')
    expect(summary.headerTemplate).toContain('> Feature: 14-cli-auth')
    expect(summary.headerTemplate).toContain('> Source ID: console/docs/product/modules/14-cli-auth.md')
  })

  it('resolves source-file slugs and provides source content', () => {
    const projectRoot = createWorkspaceWithSourceDocs()
    const result = spawnSync('bun', [SCRIPT_PATH, 'context', '14-cli-auth'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    const summary = JSON.parse(result.stdout)
    expect(summary.feature).toBe('14-cli-auth')
    expect(summary.sourceContent).toContain('OAuth 2.0 Device Flow')
    expect(summary.headerTemplate).toContain('> Source ID: console/docs/product/modules/14-cli-auth.md')
  })

  it('uses explicit source-file basename as feature name', () => {
    const projectRoot = createWorkspaceWithSourceDocs()
    const result = spawnSync('bun', [SCRIPT_PATH, 'context', 'ignored-name', '--source-file', 'console/docs/product/modules/14-cli-auth.md'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    const summary = JSON.parse(result.stdout)
    expect(summary.requestedFeature).toBe('ignored-name')
    expect(summary.feature).toBe('14-cli-auth')
    expect(summary.requirementDoc.endsWith('/docs/requirement/14-cli-auth.md')).toBe(true)
  })

  it('fails context when no source file can be resolved', () => {
    const projectRoot = createWorkspaceWithSourceDocs()
    const result = spawnSync('bun', [SCRIPT_PATH, 'context', 'missing-feature'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('未找到需求来源文件')
  })

  it('allows explicit current-context mode with an inferred feature name', () => {
    const projectRoot = createWorkspaceWithSourceDocs()
    const result = spawnSync('bun', [SCRIPT_PATH, 'context', 'inferred-feature', '--from-context'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    const summary = JSON.parse(result.stdout)
    expect(summary.feature).toBe('inferred-feature')
    expect(summary.sourceFile).toBe(null)
    expect(summary.sourceContent).toBe(null)
    expect(summary.requirementDoc.endsWith('/docs/requirement/inferred-feature.md')).toBe(true)
  })

  it('rejects mixing explicit source-file with current-context mode', () => {
    const projectRoot = createWorkspaceWithSourceDocs()
    const result = spawnSync('bun', [SCRIPT_PATH, 'context', '14-cli-auth', '--source-file', 'console/docs/product/modules/14-cli-auth.md', '--from-context'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('--source-file 与 --from-context 不能同时使用')
  })
})
