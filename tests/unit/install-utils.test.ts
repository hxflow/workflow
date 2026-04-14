import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'

import { afterEach, describe, expect, it } from 'bun:test'

import {
  generateSkillFilesForAgent,
  generateClaudeSkillFiles,
  generateCodexSkillFiles,
  SUPPORTED_AGENTS,
  loadCommandSpecs,
  mergeCommandSpecs,
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

  it('loads command specs from frontmatter and merges with protected precedence', () => {
    const frameworkDir = createTempDir('hx-framework-commands-')
    const userDir = createTempDir('hx-user-commands-')
    const projectDir = createTempDir('hx-project-commands-')

    writeFileSync(resolve(frameworkDir, 'hx-init.md'), [
      '---',
      'name: hx-init',
      'description: Framework Init',
      'protected: true',
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
    writeFileSync(resolve(userDir, 'hx-doc.md'), [
      '---',
      'description: User Doc',
      '---',
      '',
      '# doc',
      '',
    ].join('\n'))
    writeFileSync(resolve(projectDir, 'hx-doc.md'), [
      '---',
      'description: Project Doc',
      '---',
      '',
      '# doc',
      '',
    ].join('\n'))
    writeFileSync(resolve(projectDir, 'notes.md'), '# ignore\n')

    const merged = mergeCommandSpecs(
      loadCommandSpecs(frameworkDir),
      loadCommandSpecs(userDir),
      loadCommandSpecs(projectDir)
    )

    expect(merged).toEqual([
      { name: 'hx-doc', description: 'Project Doc', protected: false },
      { name: 'hx-init', description: 'Framework Init', protected: true },
    ])
  })

  it('generates claude and codex skill files from templates', () => {
    const targetDir = createTempDir('hx-adapter-target-')
    const codexDir = createTempDir('hx-codex-target-')
    const frameworkRoot = resolve(process.cwd(), 'src')
    const userHxDir = '/tmp/hx-user'
    const summary = createSummary()
    const codexSummary = createSummary()
    const specs = [
      { name: 'hx-doc', description: 'Doc Command', protected: false },
      { name: 'hx-init', description: 'Init Command', protected: true },
    ]

    generateClaudeSkillFiles(specs, targetDir, frameworkRoot, userHxDir, summary, { createDir: true })
    generateCodexSkillFiles(specs, codexDir, frameworkRoot, userHxDir, codexSummary, { createDir: true })

    const claudeSkill = readFileSync(resolve(targetDir, 'hx-doc', 'SKILL.md'), 'utf8')
    const protectedClaudeSkill = readFileSync(resolve(targetDir, 'hx-init', 'SKILL.md'), 'utf8')
    const codexSkill = readFileSync(resolve(codexDir, 'hx-doc', 'SKILL.md'), 'utf8')
    const protectedCodexSkill = readFileSync(resolve(codexDir, 'hx-init', 'SKILL.md'), 'utf8')

    expect(claudeSkill).toContain('hx-skill: hx-doc')
    expect(claudeSkill).toContain(`\`${frameworkRoot}/contracts/runtime-contract.md\``)
    expect(claudeSkill).toContain('按以下优先级找到第一个存在的文件')
    expect(claudeSkill).toContain('`.hx/config.yaml` 或 `.git`')
    expect(claudeSkill).toContain('`/tmp/hx-user/commands/hx-doc.md`')
    expect(claudeSkill).toContain(`\`${frameworkRoot}/commands/hx-doc.md\``)
    expect(claudeSkill).toContain('`<项目根>/.hx/commands/hx-doc.md`')
    expect(claudeSkill).not.toContain('protected: 此 skill 由框架锁定')
    expect(protectedClaudeSkill).toContain('protected: 此 skill 由框架锁定')
    expect(protectedClaudeSkill).toContain(`\`${frameworkRoot}/contracts/runtime-contract.md\``)
    expect(protectedClaudeSkill).toContain(`\`${frameworkRoot}/commands/hx-init.md\``)
    expect(protectedClaudeSkill).not.toContain('/tmp/hx-user/commands/hx-init.md')
    expect(protectedClaudeSkill).not.toContain('<项目根>/.hx/commands/hx-init.md')
    expect(codexSkill).toContain('hx-skill: hx-doc')
    expect(codexSkill).toContain('name: hx-doc')
    expect(codexSkill).toContain(`\`${frameworkRoot}/contracts/runtime-contract.md\``)
    expect(codexSkill).toContain('按以下优先级找到第一个存在的文件')
    expect(codexSkill).toContain(`\`${frameworkRoot}/commands/hx-doc.md\``)
    expect(protectedCodexSkill).toContain('hx-skill: hx-init')
    expect(protectedCodexSkill).toContain('protected: 此 skill 由框架锁定')
    expect(protectedCodexSkill).toContain(`\`${frameworkRoot}/commands/hx-init.md\``)
    expect(protectedCodexSkill).not.toContain('/tmp/hx-user/commands/hx-init.md')
    expect(summary.created).toContain('~/.claude/skills/hx-doc/SKILL.md')
    expect(codexSummary.created).toContain('~/.agents/skills/hx-doc/SKILL.md')
  })

  it('skips writing unchanged skill files', () => {
    const targetDir = createTempDir('hx-claude-skill-repeat-')
    const frameworkRoot = resolve(process.cwd(), 'src')
    const userHxDir = '/tmp/hx-user'
    const spec = [{ name: 'hx-doc', description: 'Doc Command', protected: false }]

    generateClaudeSkillFiles(spec, targetDir, frameworkRoot, userHxDir, createSummary(), { createDir: true })
    const secondSummary = createSummary()
    generateClaudeSkillFiles(spec, targetDir, frameworkRoot, userHxDir, secondSummary, { createDir: true })

    expect(secondSummary.skipped).toContain('~/.claude/skills/hx-doc/SKILL.md (无变化)')
  })

  it('prunes stale managed skill files for removed commands', () => {
    const targetDir = createTempDir('hx-claude-skill-stale-')
    const codexDir = createTempDir('hx-codex-stale-')
    const frameworkRoot = resolve(process.cwd(), 'src')
    const userHxDir = '/tmp/hx-user'
    const specs = [{ name: 'hx-doc', description: 'Doc Command', protected: false }]
    const claudeSummary = createSummary()
    const codexSummary = createSummary()

    mkdirSync(resolve(targetDir, 'hx-setup'), { recursive: true })
    writeFileSync(resolve(targetDir, 'hx-setup', 'SKILL.md'), '<!-- hx-skill: hx-setup — 由 hx setup 自动生成，请勿手动修改 -->\n', 'utf8')
    mkdirSync(resolve(codexDir, 'hx-setup'), { recursive: true })
    writeFileSync(
      resolve(codexDir, 'hx-setup', 'SKILL.md'),
      '<!-- hx-skill: hx-setup — 由 hx setup 自动生成，请勿手动修改 -->\n',
      'utf8'
    )

    generateClaudeSkillFiles(specs, targetDir, frameworkRoot, userHxDir, claudeSummary, { createDir: true })
    generateCodexSkillFiles(specs, codexDir, frameworkRoot, userHxDir, codexSummary, { createDir: true })

    expect(claudeSummary.removed).toContain('~/.claude/skills/hx-setup/')
    expect(codexSummary.removed).toContain('~/.agents/skills/hx-setup/')
    expect(() => readFileSync(resolve(targetDir, 'hx-setup', 'SKILL.md'), 'utf8')).toThrow()
    expect(() => readFileSync(resolve(codexDir, 'hx-setup', 'SKILL.md'), 'utf8')).toThrow()
  })

  it('supports additional agent skill directories with the same template', () => {
    const targetDir = createTempDir('hx-gemini-target-')
    const frameworkRoot = resolve(process.cwd(), 'src')
    const userHxDir = '/tmp/hx-user'
    const summary = createSummary()
    const specs = [{ name: 'hx-doc', description: 'Doc Command', protected: false }]

    generateSkillFilesForAgent('gemini', specs, targetDir, frameworkRoot, userHxDir, summary, { createDir: true })

    const geminiSkill = readFileSync(resolve(targetDir, 'hx-doc', 'SKILL.md'), 'utf8')
    expect(geminiSkill).toContain('hx-skill: hx-doc')
    expect(geminiSkill).toContain('`<项目根>/.hx/commands/hx-doc.md`')
    expect(summary.created).toContain('~/.agents/skills/hx-doc/SKILL.md')
  })
})
