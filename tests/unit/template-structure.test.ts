import { existsSync, readFileSync, readdirSync } from 'fs'
import { resolve } from 'path'

import { describe, expect, it } from 'bun:test'
import { PROGRESS_LAST_RUN_KEYS, PROGRESS_SCHEMA, PROGRESS_TASK_KEYS, PROGRESS_TOP_LEVEL_KEYS } from '../../hxflow/scripts/lib/progress-schema.ts'

const ROOT = process.cwd()

describe('template structure', () => {
  it('keeps config template comments and required placeholders', () => {
    const configTemplate = readFileSync(resolve(ROOT, 'hxflow', 'templates/config.yaml'), 'utf8')

    expect(configTemplate).toContain('# 项目内主要路径。')
    expect(configTemplate).toContain('src: src')
    expect(configTemplate).toContain('requirementDoc: docs/requirement/{feature}.md')
    expect(configTemplate).toContain('planDoc: docs/plans/{feature}.md')
    expect(configTemplate).toContain('progressFile: docs/plans/{feature}-progress.json')
    expect(configTemplate).toContain('lint:')
    expect(configTemplate).toContain('test:')

  })

  it('keeps progress schema facts fixed in TS', () => {
    expect(PROGRESS_SCHEMA.additionalProperties).toBe(false)
    expect(PROGRESS_TOP_LEVEL_KEYS).toEqual(PROGRESS_SCHEMA.required)
    expect(PROGRESS_LAST_RUN_KEYS).toEqual(PROGRESS_SCHEMA.properties.lastRun.anyOf[1].required)
    expect(PROGRESS_TASK_KEYS).toEqual(PROGRESS_SCHEMA.properties.tasks.items.required)
  })

  it('keeps the minimal rule templates under hxflow/templates/rules', () => {
    const rulesDir = resolve(ROOT, 'hxflow', 'templates/rules')
    const files = readdirSync(rulesDir).sort()

    expect(files).toEqual([
      'bugfix-plan-template.md',
      'bugfix-requirement-template.md',
      'plan-template.md',
      'requirement-template.md',
    ])

    for (const file of files) {
      const content = readFileSync(resolve(rulesDir, file), 'utf8')
      expect(content.trim().length).toBeGreaterThan(0)
    }

    const requirementTemplate = readFileSync(resolve(rulesDir, 'requirement-template.md'), 'utf8')
    expect(requirementTemplate).not.toContain('> Feature:')
    expect(requirementTemplate).not.toContain('> Display Name:')
    expect(requirementTemplate).not.toContain('> Source ID:')
    expect(requirementTemplate).not.toContain('> Source Fingerprint:')
    expect(requirementTemplate).not.toContain('> Type:')
  })

  it('keeps config template runtime registration blocks present', () => {
    const configTemplate = readFileSync(resolve(ROOT, 'hxflow', 'templates/config.yaml'), 'utf8')

    expect(configTemplate).toContain('runtime:')
    expect(configTemplate).toContain('hooks:')
    expect(configTemplate).toContain('pipelines:')
    expect(configTemplate).toContain('default: .hx/pipelines/default.yaml')
  })

  it('keeps the built-in default pipeline template present', () => {
    const pipelinePath = resolve(ROOT, 'hxflow', 'templates', 'pipelines', 'default.yaml')
    expect(existsSync(pipelinePath)).toBe(true)

    const pipelineTemplate = readFileSync(pipelinePath, 'utf8')
    expect(pipelineTemplate).toContain('name: Default')
    expect(pipelineTemplate).toContain('command: doc')
    expect(pipelineTemplate).toContain('command: plan')
    expect(pipelineTemplate).toContain('command: run')
    expect(pipelineTemplate).toContain('command: check')
    expect(pipelineTemplate).toContain('command: mr')
    expect(pipelineTemplate).not.toContain('command: hx-')
  })
})
