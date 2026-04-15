import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
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

  it('generates skill files pointing directly to framework', () => {
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

    expect(docSkill).toContain('hx-skill: hx-doc')
    expect(docSkill).toContain(`\`${frameworkRoot}/contracts/runtime-contract.md\``)
    expect(docSkill).toContain(`\`${frameworkRoot}/commands/hx-doc.md\``)
    expect(docSkill).not.toContain('protected')
    expect(docSkill).not.toContain('优先级')
    expect(initSkill).toContain('hx-skill: hx-init')
    expect(initSkill).toContain(`\`${frameworkRoot}/commands/hx-init.md\``)
    expect(summary.created).toContain('~/.claude/skills/hx-doc/SKILL.md')
    expect(summary.created).toContain('~/.claude/skills/hx-init/SKILL.md')
  })

  it('generates agents skill files with same template', () => {
    const targetDir = createTempDir('hx-agents-target-')
    const frameworkRoot = resolve(process.cwd(), 'src')
    const summary = createSummary()
    const specs = [{ name: 'hx-doc', description: 'Doc Command' }]

    generateSkillFilesForAgent('agents', specs, targetDir, frameworkRoot, summary, { createDir: true })

    const skill = readFileSync(resolve(targetDir, 'hx-doc', 'SKILL.md'), 'utf8')
    expect(skill).toContain('hx-skill: hx-doc')
    expect(skill).toContain(`\`${frameworkRoot}/contracts/runtime-contract.md\``)
    expect(summary.created).toContain('~/.agents/skills/hx-doc/SKILL.md')
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
