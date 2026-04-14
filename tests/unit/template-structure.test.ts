import { readFileSync, readdirSync } from 'fs'
import { resolve } from 'path'

import { describe, expect, it } from 'bun:test'

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

  it('keeps progress json template as the single fixed schema sample', () => {
    const progressTemplate = readFileSync(resolve(ROOT, 'src/templates/progress.json'), 'utf8')
    const progressSchema = readFileSync(resolve(ROOT, 'src/templates/progress.schema.json'), 'utf8')

    expect(progressTemplate).toContain('"feature": "{{feature}}"')
    expect(progressTemplate).toContain('"requirementDoc": "{{requirementDoc}}"')
    expect(progressTemplate).toContain('"planDoc": "{{planDoc}}"')
    expect(progressTemplate).toContain('"lastRun": null')
    expect(progressTemplate).toContain('"dependsOn": []')
    expect(progressTemplate).toContain('"parallelizable": false')
    expect(progressTemplate).toContain('"durationSeconds": null')
    expect(progressSchema).toContain('"additionalProperties": false')
    expect(progressSchema).toContain('"taskId"')
    expect(progressSchema).toContain('"ranAt"')
  })

  it('keeps skill entry templates complete', () => {
    const forwarderDir = resolve(ROOT, 'src/templates/forwarders')
    const files = readdirSync(forwarderDir).sort()

    expect(files).toEqual(['skill-layered.md', 'skill-protected.md'])

    for (const file of files) {
      const content = readFileSync(resolve(forwarderDir, file), 'utf8')
      expect(content).toContain('{{name}}')
      expect(content).toContain('{{runtimePath}}')
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

  it('keeps framework hook files aligned with command hook conventions', () => {
    const hooksDir = resolve(ROOT, 'src/hooks')
    const hookContract = readFileSync(resolve(ROOT, 'src/contracts/hook-contract.md'), 'utf8')
    const files = readdirSync(hooksDir).sort()

    expect(files).toEqual([
      'pre_doc.md',
      'pre_fix.md',
    ])

    expect(hookContract).toContain('pre_<command>.md')
    expect(hookContract).toContain('post_<command>.md')
    expect(hookContract).toContain('### 基础公共字段')
    expect(hookContract).toContain('### `pre_*` Hook 输入')
    expect(hookContract).toContain('### `post_*` Hook 输入')
    expect(hookContract).toContain('`phase: "pre"`')
    expect(hookContract).toContain('`phase: "post"`')
    expect(hookContract).toContain('`result`: 主命令结构化结果')
    expect(hookContract).toContain('`arguments`: 当前命令参数对象')
    expect(hookContract).toContain('`raw`: 原始参数字符串')
    expect(hookContract).toContain('`positional`: 位置参数数组')
    expect(hookContract).toContain('`options`: 选项参数对象')
    expect(hookContract).toContain('`result.artifacts`、`result.issues`、`result.nextAction`')
  })

  it('keeps rule templates under hx auto/manual block conventions', () => {
    const rulesDir = resolve(ROOT, 'src/templates/rules')
    const files = readdirSync(rulesDir).sort()

    expect(files).toEqual([
      'bugfix-plan-template.md',
      'bugfix-requirement-template.md',
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

    const goldenRulesTemplate = readFileSync(resolve(rulesDir, 'golden-rules.md'), 'utf8')
    expect(goldenRulesTemplate).toContain('> Rules Version:')
    expect(goldenRulesTemplate).toContain('> Updated At:')

    const requirementTemplate = readFileSync(resolve(rulesDir, 'requirement-template.md'), 'utf8')
    expect(requirementTemplate).toContain('> Feature:')
    expect(requirementTemplate).toContain('> Display Name:')
    expect(requirementTemplate).toContain('> Source ID:')
    expect(requirementTemplate).toContain('> Source Fingerprint:')

    const reviewChecklist = readFileSync(resolve(rulesDir, 'review-checklist.md'), 'utf8')
    expect(reviewChecklist).toContain('## 机验项')
    expect(reviewChecklist).toContain('## 人工审查项')
    expect(reviewChecklist).toContain('`progressFile` 是否能通过固定 schema 校验')
    expect(reviewChecklist).toContain('### 范围与一致性')
  })

  it('keeps default pipeline aligned with command names and pipeline rules', () => {
    const commandFiles = readdirSync(resolve(ROOT, 'src/commands'))
      .filter((file) => file.startsWith('hx-') && file.endsWith('.md'))
      .map((file) => file.replace(/\.md$/, ''))
    const pipelineRules = readFileSync(resolve(ROOT, 'src/contracts/pipeline-contract.md'), 'utf8')
    const defaultPipeline = readFileSync(resolve(ROOT, 'src/pipelines/default.yaml'), 'utf8')
    const ids = [...defaultPipeline.matchAll(/^\s*- id:\s*(\S+)\s*$/gm)].map((match) => match[1])
    const commands = [...defaultPipeline.matchAll(/^\s*command:\s*(hx-[\w-]+)\s*$/gm)].map((match) => match[1])

    expect(pipelineRules).toContain('顶层必须包含 `name` 和 `steps`')
    expect(pipelineRules).toContain('`command`：非空字符串，值必须是 `hx-*` 命令名')
    expect(pipelineRules).toContain('`id` 同时是 `bun src/tools/go.ts --from <step-id>` 的恢复锚点')
    expect(pipelineRules).toContain('自动恢复位置')
    expect(pipelineRules).toContain('没有耐久完成标记的 step')
    expect(pipelineRules).toContain('checkpoint.message')
    expect(pipelineRules).toContain('src/contracts/checkpoint-contract.md')
    expect(defaultPipeline).toContain('name: 全自动流水线（主路径）')
    expect(ids.length).toBeGreaterThan(0)
    expect(new Set(ids).size).toBe(ids.length)

    for (const commandName of commands) {
      expect(commandFiles).toContain(commandName)
    }
  })
})
