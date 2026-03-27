import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

import { loadCommandSpecs } from '../../src/scripts/lib/install-utils.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const COMMANDS_DIR = resolve(ROOT, 'src/agents/commands')
const PLAN_COMMAND_PATH = resolve(COMMANDS_DIR, 'hx-plan.md')

describe('hx-plan command contract', () => {
  it('暴露 canonical metadata', () => {
    const specs = loadCommandSpecs(COMMANDS_DIR)
    const planSpec = specs.find((spec) => spec.name === 'hx-plan')

    expect(planSpec).toMatchObject({
      name: 'hx-plan',
      usage: 'hx-plan [<feature-key>] [--profile <name>]',
      claude: '/hx-plan',
      codex: 'hx-plan',
    })
    expect(planSpec?.description).toContain('Phase 02')
  })

  it('要求从需求文档生成计划和 progress 文件，并提示下一步 hx-run', () => {
    const content = readFileSync(PLAN_COMMAND_PATH, 'utf8')

    expect(content).toContain('paths.requirementDoc')
    expect(content).toContain('paths.planDoc')
    expect(content).toContain('paths.progressFile')
    expect(content).toContain('写入 `planDoc`')
    expect(content).toContain('写入 `progressFile`')
    expect(content).toContain('默认提示下一步 `hx-run`')
  })

  it('保留关键执行约束，避免覆盖已有计划并约束 TASK 格式', () => {
    const content = readFileSync(PLAN_COMMAND_PATH, 'utf8')

    expect(content).toContain('不覆盖已存在的计划文件')
    expect(content).toContain('每个 TASK 必须包含')
    expect(content).toContain('TASK-id 格式')
    expect(content).toContain('TASK-<TEAM>-<NN>')
  })
})
