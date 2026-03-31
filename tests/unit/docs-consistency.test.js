import { readFileSync } from 'fs'
import { resolve } from 'path'

import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()
const DOC_FILES = [
  'docs/guide/hx-command-index.html',
  'docs/guide/hx-config-reference.html',
  'docs/guide/hx-deep-dive.html',
  'docs/guide/hx-guide.html',
  'docs/guide/hx-onboarding.html',
  'docs/guide/hx-quickstart.html',
  'docs/design/hx-rules-refactor.md',
  'docs/design/hx-extensibility.md',
  'docs/design/hx-extension-rule-pack.md',
]

describe('docs consistency', () => {
  it('removes stale path and config references from updated docs', () => {
    for (const file of DOC_FILES) {
      const content = readFileSync(resolve(ROOT, file), 'utf8')
      expect(content).not.toContain('src/agents/')
      expect(content).not.toContain('~/.hx/config.yaml')
    }
  })

  it('documents current install/runtime boundaries', () => {
    const readme = readFileSync(resolve(ROOT, 'README.md'), 'utf8')
    const quickstart = readFileSync(resolve(ROOT, 'docs/guide/hx-quickstart.html'), 'utf8')
    const guide = readFileSync(resolve(ROOT, 'docs/guide/hx-guide.html'), 'utf8')
    const configReference = readFileSync(resolve(ROOT, 'docs/guide/hx-config-reference.html'), 'utf8')
    const commandIndex = readFileSync(resolve(ROOT, 'docs/guide/hx-command-index.html'), 'utf8')

    expect(readme).toContain('.hx/commands/')
    expect(readme).not.toContain('.hx/skills/')
    expect(readme).not.toContain('hx setup [--agent')
    expect(quickstart).toContain('src/commands/')
    expect(quickstart).toContain('~/.hx/settings.yaml')
    expect(guide).toContain('2 个内置命令（setup / version）')
    expect(configReference).toContain('~/.hx/settings.yaml')
    expect(configReference).toContain('.hx/config.yaml')
    expect(guide).toContain('~/.claude/skills/')
    expect(guide).not.toContain('~/.claude/commands/')
    expect(commandIndex).not.toContain('hx setup [--agent')
  })

  it('removes task-id driven wording from the main workflow docs', () => {
    const readme = readFileSync(resolve(ROOT, 'README.md'), 'utf8')
    const quickstart = readFileSync(resolve(ROOT, 'docs/guide/hx-quickstart.html'), 'utf8')
    const guide = readFileSync(resolve(ROOT, 'docs/guide/hx-guide.html'), 'utf8')
    const commandIndex = readFileSync(resolve(ROOT, 'docs/guide/hx-command-index.html'), 'utf8')
    const configReference = readFileSync(resolve(ROOT, 'docs/guide/hx-config-reference.html'), 'utf8')

    expect(readme).not.toContain('--task <id>')
    expect(readme).not.toContain('feature key')
    expect(quickstart).not.toContain('/hx-go --task 12345')
    expect(guide).not.toContain('[--task &lt;id&gt;]')
    expect(commandIndex).toContain('--plan-task &lt;TASK-ID&gt;')
    expect(configReference).not.toContain('{taskId}')
  })
})
