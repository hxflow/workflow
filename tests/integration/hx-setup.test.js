import { execFileSync } from 'child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'

import { afterEach, describe, expect, it } from 'vitest'

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
    const userCodexDir = createTempDir('hx-codex-')

    const output = runNode([
      'src/scripts/hx-setup.js',
      '--user-hx-dir',
      userHxDir,
      '--user-claude-dir',
      userClaudeDir,
      '--user-codex-dir',
      userCodexDir,
    ], { input: '1,2\n', env: { HX_SETUP_FORCE_PROMPT: '1' } })

    expect(output).toContain('Harness Workflow · setup')
    expect(existsSync(resolve(userHxDir, 'commands'))).toBe(true)
    expect(existsSync(resolve(userHxDir, 'hooks'))).toBe(true)
    expect(existsSync(resolve(userHxDir, 'pipelines'))).toBe(true)
    expect(readFileSync(resolve(userHxDir, 'settings.yaml'), 'utf8')).toContain(`frameworkRoot: ${process.cwd()}`)
    expect(readFileSync(resolve(userHxDir, 'settings.yaml'), 'utf8')).toContain('agents: claude,codex')
    expect(readFileSync(resolve(userClaudeDir, 'skills', 'hx-doc', 'SKILL.md'), 'utf8')).toContain('hx-skill: hx-doc')
    expect(readFileSync(resolve(userCodexDir, 'skills', 'hx-doc', 'SKILL.md'), 'utf8')).toContain('hx-skill: hx-doc')
  })

  it('prunes stale skill entries for commands removed from the framework', () => {
    const userHxDir = createTempDir('hx-user-stale-')
    const userClaudeDir = createTempDir('hx-claude-stale-')
    const userCodexDir = createTempDir('hx-codex-stale-')
    const staleClaudeSkillDir = resolve(userClaudeDir, 'skills', 'hx-setup')
    const staleClaudeSkill = resolve(staleClaudeSkillDir, 'SKILL.md')
    const staleSkillDir = resolve(userCodexDir, 'skills', 'hx-setup')
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
      '--user-codex-dir',
      userCodexDir,
    ], { input: '1,2\n', env: { HX_SETUP_FORCE_PROMPT: '1' } })

    expect(output).toContain('删除:')
    expect(output).toContain('~/.claude/skills/hx-setup/')
    expect(output).toContain('~/.codex/skills/hx-setup/')
    expect(existsSync(staleClaudeSkill)).toBe(false)
    expect(existsSync(staleSkill)).toBe(false)
  })

  it('supports dry-run without writing files', () => {
    const userHxDir = createTempDir('hx-user-dry-')
    const userClaudeDir = createTempDir('hx-claude-dry-')
    const userCodexDir = createTempDir('hx-codex-dry-')

    const output = runNode([
      'src/scripts/hx-setup.js',
      '--agent',
      'claude,codex',
      '--dry-run',
      '--user-hx-dir',
      userHxDir,
      '--user-claude-dir',
      userClaudeDir,
      '--user-codex-dir',
      userCodexDir,
    ])

    expect(output).toContain('[dry-run] 未实际写入。')
    expect(existsSync(resolve(userHxDir, 'settings.yaml'))).toBe(false)
    expect(existsSync(resolve(userClaudeDir, 'skills', 'hx-doc', 'SKILL.md'))).toBe(false)
    expect(existsSync(resolve(userCodexDir, 'skills', 'hx-doc', 'SKILL.md'))).toBe(false)
  })

  it('installs the same workflow skill into additional agent directories', () => {
    const userHxDir = createTempDir('hx-user-gemini-')
    const userGeminiDir = createTempDir('hx-gemini-')

    const output = runNode([
      'src/scripts/hx-setup.js',
      '--agent',
      'gemini',
      '--user-hx-dir',
      userHxDir,
      '--user-gemini-dir',
      userGeminiDir,
    ])

    expect(output).toContain('agents      → gemini')
    expect(readFileSync(resolve(userGeminiDir, 'skills', 'hx-doc', 'SKILL.md'), 'utf8')).toContain('hx-skill: hx-doc')
  })

  it('reuses agents from settings when --agent is omitted', () => {
    const userHxDir = createTempDir('hx-user-settings-')
    const userGeminiDir = createTempDir('hx-gemini-settings-')

    runNode([
      'src/scripts/hx-setup.js',
      '--agent',
      'gemini',
      '--user-hx-dir',
      userHxDir,
      '--user-gemini-dir',
      userGeminiDir,
    ])

    rmSync(resolve(userGeminiDir, 'skills', 'hx-doc'), { recursive: true, force: true })

    const output = runNode([
      'src/scripts/hx-setup.js',
      '--user-hx-dir',
      userHxDir,
      '--user-gemini-dir',
      userGeminiDir,
    ])

    expect(output).toContain('agents      → gemini')
    expect(readFileSync(resolve(userGeminiDir, 'skills', 'hx-doc', 'SKILL.md'), 'utf8')).toContain('hx-skill: hx-doc')
  })
})
