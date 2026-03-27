import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

import { loadCommandSpecs } from '../../src/scripts/lib/install-utils.js'
import { parseSimpleYaml } from '../../src/scripts/lib/profile-utils.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const COMMANDS_DIR = resolve(ROOT, 'src/agents/commands')
const PIPELINE_PATH = resolve(ROOT, 'src/pipelines/default.yaml')

describe('workflow contract integration', () => {
  it('默认主路径引用的命令都存在且顺序正确', () => {
    const pipeline = parseSimpleYaml(readFileSync(PIPELINE_PATH, 'utf8'))
    const specs = loadCommandSpecs(COMMANDS_DIR)
    const availableCommands = new Set(specs.map((spec) => spec.name))

    expect(pipeline.steps).toHaveLength(5)
    expect(pipeline.steps.map((step) => step.id)).toEqual(['doc', 'plan', 'run', 'qa', 'mr'])
    expect(pipeline.steps.map((step) => step.command)).toEqual(['hx-doc', 'hx-plan', 'hx-run', 'hx-qa', 'hx-mr'])

    for (const step of pipeline.steps) {
      expect(availableCommands.has(step.command), `${step.command} 应存在于命令契约中`).toBe(true)
    }
  })

  it('默认主路径保持 canonical phase 编号', () => {
    const pipeline = parseSimpleYaml(readFileSync(PIPELINE_PATH, 'utf8'))
    const phasesById = Object.fromEntries(pipeline.steps.map((step) => [step.id, step.phase]))

    expect(phasesById).toEqual({
      doc: 'Phase 01',
      plan: 'Phase 02',
      run: 'Phase 04',
      qa: 'Phase 06',
      mr: 'Phase 08',
    })
  })

  it('默认只在 doc 和 plan 阶段设置 checkpoint', () => {
    const pipeline = parseSimpleYaml(readFileSync(PIPELINE_PATH, 'utf8'))
    const checkpointSteps = pipeline.steps
      .filter((step) => step.checkpoint?.message)
      .map((step) => step.id)

    expect(checkpointSteps).toEqual(['doc', 'plan'])
  })
})
