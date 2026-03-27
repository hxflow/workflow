import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

import { loadCommandSpecs } from '../../src/scripts/lib/install-utils.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const COMMANDS_DIR = resolve(ROOT, 'src/agents/commands')
const INIT_COMMAND_PATH = resolve(COMMANDS_DIR, 'hx-init.md')

describe('hx-init command contract', () => {
  it('exposes canonical metadata', () => {
    const specs = loadCommandSpecs(COMMANDS_DIR)
    const initSpec = specs.find((spec) => spec.name === 'hx-init')

    expect(initSpec).toMatchObject({
      name: 'hx-init',
      usage: 'hx-init [--profile <name>]',
      claude: '/hx-init',
      codex: 'hx-init',
    })
  })

  it('requires writing project scaffolding files and config samples', () => {
    const content = readFileSync(INIT_COMMAND_PATH, 'utf8')

    expect(content).toContain('`.hx/config.yaml`')
    expect(content).toContain('`.hx/commands/README.md`')
    expect(content).toContain('`.hx/commands/hx-your-command.md.example`')
    expect(content).toContain('`.hx/hooks/README.md`')
    expect(content).toContain('`.hx/hooks/run-pre.md.example`')
    expect(content).toContain('`.hx/hooks/run-post.md.example`')
    expect(content).toContain('`.hx/pipelines/default.yaml`')
  })

  it('keeps the explicit config template and CLAUDE.md marker requirements', () => {
    const content = readFileSync(INIT_COMMAND_PATH, 'utf8')

    expect(content).toContain('defaultProfile: <profile 名称>')
    expect(content).toContain('requirementDoc: <实际值，默认 docs/requirement/{feature}.md>')
    expect(content).toContain('planDoc: <实际值，默认 docs/plans/{feature}.md>')
    expect(content).toContain('progressFile: <实际值，默认 docs/plans/{feature}-progress.json>')
    expect(content).toContain('<!-- hxflow:start -->')
    expect(content).toContain('<!-- hxflow:end -->')
  })
})
