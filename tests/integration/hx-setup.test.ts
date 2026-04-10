import { execFileSync } from 'child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'

import { afterEach, describe, expect, it } from 'bun:test'

const tempDirs = []

function createTempDir(prefix) {
  const dir = mkdtempSync(resolve(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

function runNode(args, options = {}) {
  const { env = {}, ...rest } = options
  return execFileSync(process.execPath, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      ...env,
    },
    ...rest,
  })
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop(), { recursive: true, force: true })
  }
})

describe('hx setup integration', () => {
  it('creates user skeleton, settings, and skill entries', () => {
    const userHxDir = createTempDir('hx-user-')
    const userClaudeDir = createTempDir('hx-claude-')
    const userAgentsDir = createTempDir('hx-agents-')

    const output = runNode([
      'src/scripts/hx-setup.js',
      '--user-hx-dir',
      userHxDir,
      '--user-claude-dir',
      userClaudeDir,
      '--user-agents-dir',
      userAgentsDir,
    ])

    expect(output).toContain('Harness Workflow · setup')
    expect(existsSync(resolve(userHxDir, 'commands'))).toBe(true)
    expect(existsSync(resolve(userHxDir, 'hooks'))).toBe(true)
    expect(existsSync(resolve(userHxDir, 'pipelines'))).toBe(true)
    expect(readFileSync(resolve(userHxDir, 'settings.yaml'), 'utf8')).toContain(`frameworkRoot: ${process.cwd()}`)
    expect(readFileSync(resolve(userHxDir, 'settings.yaml'), 'utf8')).not.toContain('agents:')
    expect(readFileSync(resolve(userClaudeDir, 'skills', 'hx-doc', 'SKILL.md'), 'utf8')).toContain('hx-skill: hx-doc')
    expect(readFileSync(resolve(userAgentsDir, 'skills', 'hx-doc', 'SKILL.md'), 'utf8')).toContain('hx-skill: hx-doc')
  })

  it('prunes stale skill entries for commands removed from the framework', () => {
    const userHxDir = createTempDir('hx-user-stale-')
    const userClaudeDir = createTempDir('hx-claude-stale-')
    const userAgentsDir = createTempDir('hx-agents-stale-')
    const staleClaudeSkillDir = resolve(userClaudeDir, 'skills', 'hx-setup')
    const staleClaudeSkill = resolve(staleClaudeSkillDir, 'SKILL.md')
    const staleSkillDir = resolve(userAgentsDir, 'skills', 'hx-setup')
    const staleSkill = resolve(staleSkillDir, 'SKILL.md')

    mkdirSync(staleClaudeSkillDir, { recursive: true })
    mkdirSync(staleSkillDir, { recursive: true })
    writeFileSync(staleClaudeSkill, '<!-- hx-skill: hx-setup — stale -->\n', 'utf8')
    writeFileSync(staleSkill, '<!-- hx-skill: hx-setup — stale -->\n', 'utf8')

    const output = runNode([
      'src/scripts/hx-setup.js',
      '--user-hx-dir',
      userHxDir,
      '--user-claude-dir',
      userClaudeDir,
      '--user-agents-dir',
      userAgentsDir,
    ])

    expect(output).toContain('删除:')
    expect(output).toContain('~/.claude/skills/hx-setup/')
    expect(output).toContain('~/.agents/skills/hx-setup/')
    expect(existsSync(staleClaudeSkill)).toBe(false)
    expect(existsSync(staleSkill)).toBe(false)
  })

  it('supports dry-run without writing files', () => {
    const userHxDir = createTempDir('hx-user-dry-')
    const userClaudeDir = createTempDir('hx-claude-dry-')
    const userAgentsDir = createTempDir('hx-agents-dry-')

    const output = runNode([
      'src/scripts/hx-setup.js',
      '--dry-run',
      '--user-hx-dir',
      userHxDir,
      '--user-claude-dir',
      userClaudeDir,
      '--user-agents-dir',
      userAgentsDir,
    ])

    expect(output).toContain('[dry-run] 未实际写入。')
    expect(existsSync(resolve(userHxDir, 'settings.yaml'))).toBe(false)
    expect(existsSync(resolve(userClaudeDir, 'skills', 'hx-doc', 'SKILL.md'))).toBe(false)
    expect(existsSync(resolve(userAgentsDir, 'skills', 'hx-doc', 'SKILL.md'))).toBe(false)
  })

  it('supports installing only the shared agent target', () => {
    const userHxDir = createTempDir('hx-user-agents-')
    const userAgentsDir = createTempDir('hx-agents-only-')

    const output = runNode([
      'src/scripts/hx-setup.js',
      '--agent',
      'agents',
      '--user-hx-dir',
      userHxDir,
      '--user-agents-dir',
      userAgentsDir,
    ])

    expect(output).toContain('targets     → agents')
    expect(readFileSync(resolve(userAgentsDir, 'skills', 'hx-doc', 'SKILL.md'), 'utf8')).toContain('hx-skill: hx-doc')
  })

  it('installs claude and shared agent targets by default', () => {
    const userHxDir = createTempDir('hx-user-defaults-')
    const userClaudeDir = createTempDir('hx-claude-defaults-')
    const userAgentsDir = createTempDir('hx-agents-defaults-')

    const output = runNode([
      'src/scripts/hx-setup.js',
      '--user-hx-dir',
      userHxDir,
      '--user-claude-dir',
      userClaudeDir,
      '--user-agents-dir',
      userAgentsDir,
    ])

    expect(output).toContain('targets     → claude, agents')
    expect(readFileSync(resolve(userClaudeDir, 'skills', 'hx-doc', 'SKILL.md'), 'utf8')).toContain('hx-skill: hx-doc')
    expect(readFileSync(resolve(userAgentsDir, 'skills', 'hx-doc', 'SKILL.md'), 'utf8')).toContain('hx-skill: hx-doc')
  })
})
