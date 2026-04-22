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
  'hx-doc',
  'hx-go',
  'hx-init',
  'hx-mr',
  'hx-plan',
  'hx-reset',
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
      expect(content).not.toContain('## 目标')
      expect(content).not.toContain('## 何时使用')
      expect(content).not.toContain('## 输入')
      expect(content).not.toContain('## 成功结果')
      expect(content).not.toContain('## 失败边界')
      expect(content).not.toContain('## 失败处理')
      expect(content).not.toContain('## 注意事项')

      const headings = Array.from(content.matchAll(/^##\s+(.+)$/gm), (match) => match[1])
      expect(headings[0]).toBe('执行步骤')
      expect(headings[headings.length - 1]).toBe('约束')
      expect(headings.every((heading) => ['执行步骤', '下一步', '约束'].includes(heading))).toBe(true)
      if (headings.includes('下一步')) {
        expect(headings).toEqual(['执行步骤', '下一步', '约束'])
      } else {
        expect(headings).toEqual(['执行步骤', '约束'])
      }
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
      expect(content).toContain('bun scripts/tools/')
      expect(content).not.toContain('npx tsx scripts/')
      if (content.includes('## 下一步')) {
        expect(content).toContain('hx ')
        expect(content).toMatch(/## 下一步\s+[-*] `hx [^`]+`/m)
      }
      expect(content).not.toContain('Option A：')
      expect(content).not.toContain('Option B：')
      expect(content).not.toContain('hooks/README.md')
    }
  })

  it('does not keep stale shared contract references', () => {
    const hxGo = readFileSync(resolve(COMMANDS_DIR, 'hx-go.md'), 'utf8')
    const hxDoc = readFileSync(resolve(COMMANDS_DIR, 'hx-doc.md'), 'utf8')

    expect(hxDoc).toContain('先复用后生成')
    expect(hxDoc).toContain('sourceId')
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
    expect(hxDoc).not.toContain('npx tsx')
    expect(hxDoc).toContain('先复用后生成')
    expect(hxDoc).toContain('## 下一步')
    expect(hxDoc).toContain('`hx plan <feature>`')

    expect(hxPlan).toContain('bun scripts/tools/plan.ts context <feature>')
    expect(hxPlan).not.toContain('npx tsx')
    expect(hxPlan).toContain('不重算')
    expect(hxPlan).toContain('每个 task 保持独立可实现、可验证')
    expect(hxPlan).toContain('`hx run <feature>`')
    const hxPlanScript = readFileSync(resolve(TOOLS_DIR, 'plan.ts'), 'utf8')
    expect(hxPlanScript).toContain('parseFeatureHeaderFile')
    expect(hxPlanScript).toContain('loadValidatedProgressFile')
    expect(hxPlanScript).not.toContain('progressSchemaPath')
    expect(hxPlanScript).not.toContain('progressTemplate')

    expect(hxCheck).toContain('bun scripts/tools/check.ts')
    expect(hxCheck).not.toContain('npx tsx')
    expect(hxCheck).toContain('qa')
    expect(hxCheck).not.toContain('## 下一步')
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
    expect(hxRun).not.toContain('npx tsx')
    expect(hxRun).toContain('继续读取下一批任务并执行')
    expect(hxRun).toContain('默认连续执行')
    expect(hxRun).toContain('`hx check <feature>`')
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
    expect(hxGo).not.toContain('npx tsx')
    expect(hxGo).toContain('不得跳过最早未完成 step')
    expect(hxGo).not.toContain('## 下一步')
    const hxGoScript = readFileSync(resolve(TOOLS_DIR, 'go.ts'), 'utf8')
    expect(hxGoScript).toContain('getPipelineFullState')
    expect(hxGoScript).toContain('resolveStartStep')
    expect(hxGoScript).toContain('preHooks')
    expect(hxGoScript).toContain("case 'next'")
    expect(hxGoScript).toContain("case 'state'")

    expect(hxInit).toContain('bun scripts/tools/init.ts')
    expect(hxInit).not.toContain('npx tsx')
    expect(hxInit).toContain('直接完成当前目录或指定目录的初始化阶段')
    expect(hxInit).toContain('多项目根目录初始化为 workspace')
    expect(hxInit).toContain('不允许在同一目录并存')
    expect(hxInit).not.toContain('## 下一步')
    expect(hxInit).toContain('只做初始化')
    expect((hxInit.match(/\n1\./g) ?? []).length).toBe(1)
    expect(hxInit).not.toContain('\n2.')

    expect(hxMr).toContain('不允许在 MR 阶段生成或重算')
    expect(hxMr).toContain('docs/archive/{feature}/')
    expect(hxMr).toContain('未完成 task 存在时直接失败')
    expect(hxMr).toContain('直接基于当前上下文')
    expect(hxMr).toContain('bun scripts/tools/mr.ts archive <feature>')
    expect(hxMr).not.toContain('npx tsx')
    expect(hxMr).not.toContain('## 下一步')
    const hxMrScript = readFileSync(resolve(TOOLS_DIR, 'mr.ts'), 'utf8')
    expect(hxMrScript).toContain('archiveFeature')
    expect(hxMrScript).not.toContain("case 'context'")

    const hxStatus = readFileSync(resolve(COMMANDS_DIR, 'hx-status.md'), 'utf8')
    expect(hxStatus).toContain('bun scripts/tools/status.ts [<feature>]')
    expect(hxStatus).not.toContain('## 下一步')
    expect(hxStatus).toContain('不推测未记录状态')

    const hxReset = readFileSync(resolve(COMMANDS_DIR, 'hx-reset.md'), 'utf8')
    expect(hxReset).toContain('bun scripts/tools/reset.ts <feature> [plan|doc|code]')
    expect(hxReset).not.toContain('## 下一步')
    expect(hxReset).toContain('plan')
    expect(hxReset).toContain('doc')
    expect(hxReset).toContain('code')
    expect(hxReset).toContain('全量重置')
    expect(hxReset).toContain('归档产物')

    const skill = readFileSync(resolve(process.cwd(), 'hxflow', 'SKILL.md'), 'utf8')
    expect(skill).toContain('npx tsx scripts/')
    expect(skill).toContain('全局规则')
    expect(skill).toContain('命令正文只保留')

    expect(readme).toContain('hx')
    expect(readme).not.toContain('| `fix` |')
    expect(readme).not.toContain('| `rules` |')
  })
})
