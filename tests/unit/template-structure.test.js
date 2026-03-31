import { readFileSync, readdirSync } from 'fs'
import { resolve } from 'path'

import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()

describe('template structure', () => {
  it('keeps config template comments and required placeholders', () => {
    const configTemplate = readFileSync(resolve(ROOT, 'src/templates/config.yaml'), 'utf8')

    expect(configTemplate).toContain('# 项目内主要路径。')
    expect(configTemplate).toContain('src: {{paths.src}}')
    expect(configTemplate).toContain('requirementDoc: {{paths.requirementDoc}}')
    expect(configTemplate).toContain('planDoc: {{paths.planDoc}}')
    expect(configTemplate).toContain('progressFile: {{paths.progressFile}}')
    expect(configTemplate).toContain('lint: {{gates.lint}}')
    expect(configTemplate).toContain('test: {{gates.test}}')
  })

  it('keeps skill entry templates complete', () => {
    const forwarderDir = resolve(ROOT, 'src/templates/forwarders')
    const files = readdirSync(forwarderDir).sort()

    expect(files).toEqual(['skill-layered.md', 'skill-protected.md'])

    for (const file of files) {
      const content = readFileSync(resolve(forwarderDir, file), 'utf8')
      expect(content).toContain('{{name}}')
      expect(content).toContain('{{systemPath}}')
      expect(content).toContain('skill 实体文件未找到')

      if (file.includes('layered')) {
        expect(content).toContain('{{userCommandPath}}')
        expect(content).toContain('<项目根>/.hx/commands/{{name}}.md')
      } else {
        expect(content).toContain('protected: 此 skill 由框架锁定')
      }
    }
  })

  it('keeps rule templates under hx auto/manual block conventions', () => {
    const rulesDir = resolve(ROOT, 'src/templates/rules')
    const files = readdirSync(rulesDir).sort()

    expect(files).toEqual([
      'golden-rules.md',
      'plan-template.md',
      'requirement-template.md',
      'review-checklist.md',
    ])

    for (const file of files) {
      const content = readFileSync(resolve(rulesDir, file), 'utf8')
      expect(content).toContain('<!-- hx:auto:start -->')
      expect(content).toContain('<!-- hx:auto:end -->')
    }

    expect(readFileSync(resolve(rulesDir, 'review-checklist.md'), 'utf8')).toContain('<!-- hx:manual:start -->')
  })

  it('keeps default pipeline aligned with command names and pipeline rules', () => {
    const commandFiles = readdirSync(resolve(ROOT, 'src/commands'))
      .filter((file) => file.startsWith('hx-') && file.endsWith('.md'))
      .map((file) => file.replace(/\.md$/, ''))
    const pipelineRules = readFileSync(resolve(ROOT, 'src/pipelines/README.md'), 'utf8')
    const defaultPipeline = readFileSync(resolve(ROOT, 'src/pipelines/default.yaml'), 'utf8')
    const ids = [...defaultPipeline.matchAll(/^\s*- id:\s*(\S+)\s*$/gm)].map((match) => match[1])
    const commands = [...defaultPipeline.matchAll(/^\s*command:\s*(hx-[\w-]+)\s*$/gm)].map((match) => match[1])

    expect(pipelineRules).toContain('顶层必须包含 `name` 和 `steps`')
    expect(pipelineRules).toContain('`command`：非空字符串，值必须是 `hx-*` 命令名')
    expect(defaultPipeline).toContain('name: 全自动流水线（主路径）')
    expect(ids.length).toBeGreaterThan(0)
    expect(new Set(ids).size).toBe(ids.length)

    for (const commandName of commands) {
      expect(commandFiles).toContain(commandName)
    }
  })
})
