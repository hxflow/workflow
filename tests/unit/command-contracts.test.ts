import { readFileSync, readdirSync } from 'fs'
import { resolve } from 'path'

import { describe, expect, it } from 'bun:test'

const COMMANDS_DIR = resolve(process.cwd(), 'hxflow', 'commands')
const TOOLS_DIR = resolve(process.cwd(), 'hxflow', 'scripts', 'tools')
const commandFiles = readdirSync(COMMANDS_DIR)
  .filter((file) => file.startsWith('hx-') && file.endsWith('.md'))
  .sort()

const ALL_COMMANDS = [
  'hx-check',
  'hx-codereview',
  'hx-doc',
  'hx-go',
  'hx-init',
  'hx-mr',
  'hx-plan',
  'hx-run',
  'hx-status',
]

describe('command contracts', () => {
  it('keeps filename and minimal structure aligned', () => {
    expect(commandFiles.map((file) => file.replace(/\.md$/, ''))).toEqual(ALL_COMMANDS)

    for (const file of commandFiles) {
      const content = readFileSync(resolve(COMMANDS_DIR, file), 'utf8')
      expect(content.startsWith('---')).toBe(false)
      expect(content).toContain('## 执行步骤')
      expect(content).toContain('## 下一步')
      expect(content).toContain('## 约束')
      expect(content).not.toContain('## 目标')
      expect(content).not.toContain('## 何时使用')
      expect(content).not.toContain('## 输入')
      expect(content).not.toContain('## 成功结果')
      expect(content).not.toContain('## 失败边界')
      expect(content).not.toContain('## 失败处理')
    }
  })

  it('does not use command frontmatter', () => {
    for (const file of commandFiles) {
      const content = readFileSync(resolve(COMMANDS_DIR, file), 'utf8')
      expect(content.startsWith('---')).toBe(false)
    }
  })

  it('routes execution steps to scripts and keeps next steps as hx commands', () => {
    for (const file of commandFiles) {
      const content = readFileSync(resolve(COMMANDS_DIR, file), 'utf8')
      expect(content).toContain('hx ')
      expect(content).toContain('bun scripts/tools/')
      expect(content).toMatch(/## 下一步\s+[-*] `hx [^`]+`/m)
      expect(content).not.toContain('Option A：')
      expect(content).not.toContain('Option B：')
      expect(content).not.toContain('hooks/README.md')
    }
  })

  it('does not keep stale shared contract references', () => {
    const hxGo = readFileSync(resolve(COMMANDS_DIR, 'hx-go.md'), 'utf8')
    const hxDoc = readFileSync(resolve(COMMANDS_DIR, 'hx-doc.md'), 'utf8')

    expect(hxDoc).toContain('先复用后生成')
    expect(hxDoc).toContain('displayName')
    expect(hxDoc).not.toContain('contracts/feature-contract.md')
    expect(hxGo).not.toContain('contracts/resolution-contract.md')
  })

  it('keeps the main-chain prompts minimal and aligned', () => {
    const hxDoc = readFileSync(resolve(COMMANDS_DIR, 'hx-doc.md'), 'utf8')
    const hxCheck = readFileSync(resolve(COMMANDS_DIR, 'hx-check.md'), 'utf8')
    const hxGo = readFileSync(resolve(COMMANDS_DIR, 'hx-go.md'), 'utf8')
    const hxInit = readFileSync(resolve(COMMANDS_DIR, 'hx-init.md'), 'utf8')
    const hxRun = readFileSync(resolve(COMMANDS_DIR, 'hx-run.md'), 'utf8')
    const hxPlan = readFileSync(resolve(COMMANDS_DIR, 'hx-plan.md'), 'utf8')
    const hxMr = readFileSync(resolve(COMMANDS_DIR, 'hx-mr.md'), 'utf8')
    const readme = readFileSync(resolve(process.cwd(), 'README.md'), 'utf8')

    expect(hxDoc).not.toContain('--task <task-id>')
    expect(hxDoc).toContain('bun scripts/tools/doc.ts context <feature>')
    expect(hxDoc).toContain('先复用后生成')
    expect(hxDoc).toContain('displayName')
    expect(hxDoc).toContain('新开一个子 agent')

    expect(hxPlan).toContain('bun scripts/tools/plan.ts context <feature>')
    expect(hxPlan).toContain('不重算')
    expect(hxPlan).toContain('每个 task 保持独立可实现、可验证')
    const hxPlanScript = readFileSync(resolve(TOOLS_DIR, 'plan.ts'), 'utf8')
    expect(hxPlanScript).toContain('parseFeatureHeaderFile')
    expect(hxPlanScript).toContain('validateProgressFile')
    expect(hxPlanScript).not.toContain('progressSchemaPath')
    expect(hxPlanScript).not.toContain('progressTemplate')

    expect(hxCheck).toContain('bun scripts/tools/check.ts')
    expect(hxCheck).toContain('qa')
    expect(hxCheck).not.toContain('review-checklist.md')
    expect(hxCheck).not.toContain('hx fix')
    const hxCheckScript = readFileSync(resolve(TOOLS_DIR, 'check.ts'), 'utf8')
    expect(hxCheckScript).toContain('readGatesConfig')
    expect(hxCheckScript).toContain('GATE_ORDER')
    expect(hxCheckScript).toContain("runSemanticScope('review'")
    expect(hxCheckScript).toContain("runSemanticScope('clean'")

    expect(hxRun).not.toContain('--task <task-id>')
    expect(hxRun).toContain('bun scripts/tools/run.ts next <feature>')
    expect(hxRun).toContain('bun scripts/lib/progress.ts')
    expect(hxRun).toContain('显式指定的 task')
    expect(hxRun).not.toContain('golden-rules.md')
    const hxRunScript = readFileSync(resolve(TOOLS_DIR, 'run.ts'), 'utf8')
    expect(hxRunScript).toContain('getScheduledBatch')
    expect(hxRunScript).toContain('loadFeatureProgress')
    expect(hxRunScript).toContain('buildTaskContext')
    expect(hxRunScript).toContain("case 'next'")
    expect(hxRunScript).toContain("case 'validate'")
    expect(hxRunScript).toContain("if (batch.mode === 'done')")

    expect(hxGo).not.toContain('--task <task-id>')
    expect(hxGo).toContain('bun scripts/tools/go.ts next <feature>')
    expect(hxGo).toContain('不得跳过最早未完成 step')
    expect(hxGo).toContain('`.hx/config.yaml`')
    expect(hxGo).toContain('`default`')
    const hxGoScript = readFileSync(resolve(TOOLS_DIR, 'go.ts'), 'utf8')
    expect(hxGoScript).toContain('getPipelineFullState')
    expect(hxGoScript).toContain('resolveStartStep')
    expect(hxGoScript).toContain('preHooks')
    expect(hxGoScript).toContain("case 'next'")
    expect(hxGoScript).toContain("case 'state'")

    expect(hxInit).toContain('bun scripts/tools/init.ts')
    expect(hxInit).toContain('直接完成当前初始化阶段')
    expect((hxInit.match(/\n1\./g) ?? []).length).toBe(1)
    expect(hxInit).not.toContain('\n2.')

    expect(hxMr).toContain('不允许在 MR 阶段生成或重算')
    expect(hxMr).toContain('docs/archive/{feature}/')
    expect(hxMr).toContain('未完成 task 存在时直接失败')
    expect(hxMr).toContain('直接基于当前上下文')
    expect(hxMr).toContain('bun scripts/tools/mr.ts archive <feature>')
    const hxMrScript = readFileSync(resolve(TOOLS_DIR, 'mr.ts'), 'utf8')
    expect(hxMrScript).toContain('archiveFeature')
    expect(hxMrScript).not.toContain("case 'context'")

    expect(readme).toContain('hx')
    expect(readme).not.toContain('| `fix` |')
    expect(readme).not.toContain('| `rules` |')
  })
})
