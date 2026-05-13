import { readFileSync } from 'fs'
import { resolve } from 'path'

import { describe, expect, it } from 'bun:test'

const ROOT = process.cwd()

describe('docs consistency', () => {
  it('removes stale path and config references from updated docs', () => {
    const readme = readFileSync(resolve(ROOT, 'README.md'), 'utf8')
    const agents = readFileSync(resolve(ROOT, 'AGENTS.md'), 'utf8')

    expect(readme).not.toContain('src/agents/')
    expect(readme).not.toContain('~/.hx/config.yaml')
    expect(agents).not.toContain('src/agents/')
  })

  it('documents current skill architecture without runtime contract', () => {
    const readme = readFileSync(resolve(ROOT, 'README.md'), 'utf8')
    const skill = readFileSync(resolve(ROOT, 'hxflow', 'SKILL.md'), 'utf8')

    expect(readme).not.toContain('.hx/commands/')
    expect(readme).not.toContain('.hx/skills/')
    expect(readme).not.toContain('hx setup')
    expect(readme).toContain('hxflow/SKILL.md')
    expect(readme).not.toContain('feature-contract.md')
    expect(readme).toContain('.hx/config.yaml')
    expect(readme).not.toContain('contracts/runtime-contract.md')
    expect(skill).toContain('hx-hook resolve <command>')
    expect(skill).toContain('hx-*')
    expect(skill).toContain('全局规则')
    expect(skill).toContain('先想清楚再执行')
    expect(skill).toContain('简单优先')
    expect(skill).toContain('外科手术式改动')
    expect(skill).toContain('目标可验证')
  })

  it('removes task-id driven wording from the main workflow docs', () => {
    const readme = readFileSync(resolve(ROOT, 'README.md'), 'utf8')
    const skill = readFileSync(resolve(ROOT, 'hxflow', 'SKILL.md'), 'utf8')
    const agents = readFileSync(resolve(ROOT, 'AGENTS.md'), 'utf8')

    expect(readme).not.toContain('--task <id>')
    expect(readme).not.toContain('feature key')
    expect(skill).toContain('preHooks')
    expect(agents).toContain('先想清楚再执行')
    expect(agents).toContain('简单优先')
    expect(agents).toContain('外科手术式改动')
    expect(agents).toContain('目标可验证')
    expect(readme).toContain('read_agent')
    expect(readme).toContain('read_bash')
    expect(agents).toContain('list_agents')
    expect(agents).toContain('write_agent')
  })
})
