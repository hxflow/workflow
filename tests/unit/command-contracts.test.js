import { readFileSync, readdirSync } from 'fs'
import { resolve } from 'path'

import { describe, expect, it } from 'vitest'

const COMMANDS_DIR = resolve(process.cwd(), 'src', 'commands')
const commandFiles = readdirSync(COMMANDS_DIR)
  .filter((file) => file.startsWith('hx-') && file.endsWith('.md'))
  .sort()

const PROTECTED_COMMANDS = [
  'hx-doctor',
  'hx-init',
  'hx-issue',
  'hx-status',
  'hx-uninstall',
  'hx-upgrade',
]

const HOOKED_COMMANDS = [
  'hx-clean',
  'hx-doc',
  'hx-fix',
  'hx-mr',
  'hx-plan',
  'hx-review',
  'hx-run',
]

const FAILURE_HANDLING_COMMANDS = [
  'hx-doctor',
  'hx-issue',
  'hx-uninstall',
  'hx-upgrade',
]

const ALL_COMMANDS = [
  'hx-clean',
  'hx-ctx',
  'hx-doc',
  'hx-doctor',
  'hx-fix',
  'hx-go',
  'hx-init',
  'hx-issue',
  'hx-mr',
  'hx-plan',
  'hx-qa',
  'hx-review',
  'hx-rules',
  'hx-run',
  'hx-status',
  'hx-uninstall',
  'hx-upgrade',
]

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/)
  if (!match) {
    return {}
  }

  const metadata = {}
  let currentKey = null

  for (const rawLine of match[1].split('\n')) {
    const line = rawLine.trimEnd()
    const keyMatch = line.match(/^([a-zA-Z][\w-]*):\s*(.*)$/)

    if (keyMatch) {
      currentKey = keyMatch[1]
      const value = keyMatch[2].trim()

      if (value === '') {
        metadata[currentKey] = []
      } else {
        metadata[currentKey] = value.replace(/^['"]|['"]$/g, '')
      }
      continue
    }

    const listMatch = line.match(/^\s*-\s*(.+)$/)
    if (listMatch && currentKey) {
      metadata[currentKey].push(listMatch[1].trim())
    }
  }

  return metadata
}

describe('command contracts', () => {
  it('keeps filename, frontmatter, and structure aligned', () => {
    expect(commandFiles.map((file) => file.replace(/\.md$/, ''))).toEqual(ALL_COMMANDS)

    for (const file of commandFiles) {
      const commandName = file.replace(/\.md$/, '')
      const content = readFileSync(resolve(COMMANDS_DIR, file), 'utf8')
      const metadata = parseFrontmatter(content)

      expect(metadata.name).toBe(commandName)
      expect(typeof metadata.description).toBe('string')
      expect(metadata.description.length).toBeGreaterThan(0)
      expect(typeof metadata.usage).toBe('string')
      expect(metadata.usage.length).toBeGreaterThan(0)
      expect(content).toContain('## 执行步骤')
      expect(content).toContain('## 约束')
    }
  })

  it('locks the protected and hook-capable command sets', () => {
    const protectedCommands = []
    const hookedCommands = []

    for (const file of commandFiles) {
      const commandName = file.replace(/\.md$/, '')
      const content = readFileSync(resolve(COMMANDS_DIR, file), 'utf8')
      const metadata = parseFrontmatter(content)

      if (metadata.protected === 'true') {
        protectedCommands.push(commandName)
      }

      if (Array.isArray(metadata.hooks) && metadata.hooks.length > 0) {
        hookedCommands.push(commandName)
        expect(metadata.hooks).toEqual(['pre', 'post'])
      }
    }

    expect(protectedCommands).toEqual(PROTECTED_COMMANDS)
    expect(hookedCommands).toEqual(HOOKED_COMMANDS)
  })

  it('keeps command section usage consistent', () => {
    const failureHandlingCommands = []

    for (const file of commandFiles) {
      const commandName = file.replace(/\.md$/, '')
      const content = readFileSync(resolve(COMMANDS_DIR, file), 'utf8')

      if (content.includes('## 失败处理')) {
        failureHandlingCommands.push(commandName)
      }

      if (HOOKED_COMMANDS.includes(commandName)) {
        expect(content).not.toContain('src/hooks/README.md')
      }
    }

    expect(failureHandlingCommands).toEqual(FAILURE_HANDLING_COMMANDS)
  })

  it('keeps hx-go and common docs wired to shared resolution rules', () => {
    const commandsReadme = readFileSync(resolve(COMMANDS_DIR, 'README.md'), 'utf8')
    const resolution = readFileSync(resolve(COMMANDS_DIR, 'resolution.md'), 'utf8')
    const hxGo = readFileSync(resolve(COMMANDS_DIR, 'hx-go.md'), 'utf8')

    expect(commandsReadme).toContain('src/commands/resolution.md')
    expect(hxGo).toContain('src/commands/resolution.md')
    expect(resolution).toContain('`protected: true` 的命令只允许读取框架层实体文件。')
    expect(resolution).toContain('~/.claude/commands/*.md')
    expect(resolution).toContain('~/.codex/skills/*/SKILL.md')
  })

  it('keeps the main-chain parameter model aligned', () => {
    const hxDoc = readFileSync(resolve(COMMANDS_DIR, 'hx-doc.md'), 'utf8')
    const hxGo = readFileSync(resolve(COMMANDS_DIR, 'hx-go.md'), 'utf8')
    const hxRun = readFileSync(resolve(COMMANDS_DIR, 'hx-run.md'), 'utf8')
    const hxPlan = readFileSync(resolve(COMMANDS_DIR, 'hx-plan.md'), 'utf8')
    const hxMr = readFileSync(resolve(COMMANDS_DIR, 'hx-mr.md'), 'utf8')

    expect(hxDoc).not.toContain('--task <task-id>')
    expect(hxDoc).toContain('usage: hx-doc')
    expect(hxDoc).not.toContain('[<title>]')
    expect(hxGo).not.toContain('--task <task-id>')
    expect(hxRun).toContain('--plan-task <task-id>')
    expect(hxRun).not.toContain('--task <task-id>')
    expect(hxGo).toContain('usage: hx-go [<feature>] [--from <step-id>] [--pipeline <name>]')
    expect(hxDoc).toContain('优先使用中文')
    expect(hxDoc).toContain('基于需求详情总结生成')
    expect(hxDoc).toContain('建议控制在 2 到 8 个中文字符')
    expect(hxDoc).toContain('docs/requirement/{feature}.md')
    expect(hxPlan).toContain('docs/requirement/{feature}.md')
    expect(hxPlan).toContain('docs/plans/{feature}.md')
    expect(hxPlan).toContain('docs/plans/{feature}-progress.json')
    expect(hxRun).toContain('docs/requirement/{feature}.md')
    expect(hxRun).toContain('docs/plans/{feature}.md')
    expect(hxRun).toContain('docs/plans/{feature}-progress.json')
    expect(hxPlan).toContain('不允许在本阶段重算')
    expect(hxRun).toContain('不生成、不改写、不重算')
    expect(hxMr).toContain('不允许在 MR 阶段重算')
  })
})
