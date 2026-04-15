import { existsSync, lstatSync, mkdtempSync, mkdirSync, readFileSync, readlinkSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'

import { afterEach, describe, expect, it } from 'bun:test'

import {
  generateSkillFilesForAgent,
  SUPPORTED_AGENTS,
  loadCommandSpecs,
  resolveAgentTargets,
} from '../../src/lib/install-utils.ts'

const tempDirs = []

function createTempDir(prefix) {
  const dir = mkdtempSync(resolve(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

function createSummary() {
  return { created: [], updated: [], removed: [], skipped: [], warnings: [] }
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop(), { recursive: true, force: true })
  }
})

describe('install-utils', () => {
  it('resolves agent targets and rejects invalid values', () => {
    expect(resolveAgentTargets()).toEqual(SUPPORTED_AGENTS)
    expect(resolveAgentTargets('claude')).toEqual(['claude'])
    expect(resolveAgentTargets('agents')).toEqual(['agents'])
    expect(resolveAgentTargets('claude,agents,claude')).toEqual(['claude', 'agents'])
    expect(() => resolveAgentTargets('claude,unknown')).toThrow('无效的 agent')
    expect(() => resolveAgentTargets('codex')).toThrow('无效的 agent')
  })

  it('loads command specs from frontmatter (no merge, no protected)', () => {
    const frameworkDir = createTempDir('hx-framework-commands-')

    writeFileSync(resolve(frameworkDir, 'hx-init.md'), [
      '---',
      'name: hx-init',
      'description: Framework Init',
      '---',
      '',
      '# init',
      '',
    ].join('\n'))
    writeFileSync(resolve(frameworkDir, 'hx-doc.md'), [
      '---',
      'description: Framework Doc',
      '---',
      '',
      '# doc',
      '',
    ].join('\n'))
    writeFileSync(resolve(frameworkDir, 'notes.md'), '# ignore\n')

    const specs = loadCommandSpecs(frameworkDir)

    expect(specs).toEqual([
      { name: 'hx-doc', description: 'Framework Doc' },
      { name: 'hx-init', description: 'Framework Init' },
    ])
  })

  it('generates skill files with spec-compliant structure', () => {
    const targetDir = createTempDir('hx-skill-target-')
    const frameworkRoot = resolve(process.cwd(), 'src')
    const summary = createSummary()
    const specs = [
      { name: 'hx-doc', description: 'Doc Command' },
      { name: 'hx-init', description: 'Init Command' },
    ]

    generateSkillFilesForAgent('claude', specs, targetDir, frameworkRoot, summary, { createDir: true })

    const docSkill = readFileSync(resolve(targetDir, 'hx-doc', 'SKILL.md'), 'utf8')
    const initSkill = readFileSync(resolve(targetDir, 'hx-init', 'SKILL.md'), 'utf8')

    // Agent Skills spec frontmatter
    expect(docSkill).toContain('name: hx-doc')
    expect(docSkill).toContain('description:')
    expect(docSkill).toContain('compatibility:')
    expect(docSkill).toContain('metadata:')
    expect(docSkill).toContain('generator: hx-setup')
    // Relative references (progressive disclosure)
    expect(docSkill).toContain('references/runtime-contract.md')
    expect(docSkill).toContain('references/hx-doc.md')
    expect(docSkill).not.toContain('protected')
    expect(initSkill).toContain('name: hx-init')
    expect(summary.created).toContain('~/.claude/skills/hx-doc/SKILL.md')
    expect(summary.created).toContain('~/.claude/skills/hx-init/SKILL.md')

    // references/ symlinks
    expect(lstatSync(resolve(targetDir, 'hx-doc', 'references', 'runtime-contract.md')).isSymbolicLink()).toBe(true)
    expect(readlinkSync(resolve(targetDir, 'hx-doc', 'references', 'runtime-contract.md')))
      .toBe(resolve(frameworkRoot, 'contracts', 'runtime-contract.md'))
    expect(lstatSync(resolve(targetDir, 'hx-doc', 'references', 'hx-doc.md')).isSymbolicLink()).toBe(true)
    expect(readlinkSync(resolve(targetDir, 'hx-doc', 'references', 'hx-doc.md')))
      .toBe(resolve(frameworkRoot, 'commands', 'hx-doc.md'))

    // scripts/ symlink (hx-doc → doc.ts tool exists)
    expect(lstatSync(resolve(targetDir, 'hx-doc', 'scripts', 'doc.ts')).isSymbolicLink()).toBe(true)
    expect(readlinkSync(resolve(targetDir, 'hx-doc', 'scripts', 'doc.ts')))
      .toBe(resolve(frameworkRoot, 'tools', 'doc.ts'))
  })

  it('generates agents skill files with same structure', () => {
    const targetDir = createTempDir('hx-agents-target-')
    const frameworkRoot = resolve(process.cwd(), 'src')
    const summary = createSummary()
    const specs = [{ name: 'hx-doc', description: 'Doc Command' }]

    generateSkillFilesForAgent('agents', specs, targetDir, frameworkRoot, summary, { createDir: true })

    const skill = readFileSync(resolve(targetDir, 'hx-doc', 'SKILL.md'), 'utf8')
    expect(skill).toContain('name: hx-doc')
    expect(skill).toContain('references/runtime-contract.md')
    expect(summary.created).toContain('~/.agents/skills/hx-doc/SKILL.md')
    expect(existsSync(resolve(targetDir, 'hx-doc', 'references'))).toBe(true)
  })

  it('skips writing unchanged skill files', () => {
    const targetDir = createTempDir('hx-claude-skill-repeat-')
    const frameworkRoot = resolve(process.cwd(), 'src')
    const spec = [{ name: 'hx-doc', description: 'Doc Command' }]

    generateSkillFilesForAgent('claude', spec, targetDir, frameworkRoot, createSummary(), { createDir: true })
    const secondSummary = createSummary()
    generateSkillFilesForAgent('claude', spec, targetDir, frameworkRoot, secondSummary, { createDir: true })

    expect(secondSummary.skipped).toContain('~/.claude/skills/hx-doc/SKILL.md (无变化)')
  })

  it('prunes stale managed skill files for removed commands', () => {
    const targetDir = createTempDir('hx-claude-skill-stale-')
    const frameworkRoot = resolve(process.cwd(), 'src')
    const specs = [{ name: 'hx-doc', description: 'Doc Command' }]
    const summary = createSummary()

    mkdirSync(resolve(targetDir, 'hx-setup'), { recursive: true })
    writeFileSync(resolve(targetDir, 'hx-setup', 'SKILL.md'), '<!-- hx-skill: hx-setup — 由 hx setup 自动生成，请勿手动修改 -->\n', 'utf8')

    generateSkillFilesForAgent('claude', specs, targetDir, frameworkRoot, summary, { createDir: true })

    expect(summary.removed).toContain('~/.claude/skills/hx-setup/')
    expect(() => readFileSync(resolve(targetDir, 'hx-setup', 'SKILL.md'), 'utf8')).toThrow()
  })
})
