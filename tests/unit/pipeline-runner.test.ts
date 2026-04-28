import { describe, expect, it, beforeEach, afterEach } from 'bun:test'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { resolve } from 'path'
import { tmpdir } from 'os'

import {
  parsePipelineYaml,
  loadPipeline,
  commandToToolScript,
  getPipelineFullState,
  resolveStartStep,
} from '../../hxflow/scripts/lib/pipeline-runner.ts'

const TEST_ROOT = resolve(tmpdir(), `hx-pipeline-test-${Date.now()}`)
const PROJECT_ROOT = resolve(TEST_ROOT, 'project')

function ensureDir(dir: string) {
  mkdirSync(dir, { recursive: true })
}

function writeFile(path: string, content: string) {
  ensureDir(resolve(path, '..'))
  writeFileSync(path, content, 'utf8')
}

function writeRuntimeConfig(projectRoot: string, content: string) {
  writeFile(resolve(projectRoot, '.hx', 'config.yaml'), content)
}

describe('pipeline-runner', () => {
  beforeEach(() => {
    ensureDir(PROJECT_ROOT)
    writeRuntimeConfig(PROJECT_ROOT, `runtime:
  hooks:
    doc:
      pre:
        - .hx/hooks/pre_doc.md
  pipelines:
    default: .hx/pipelines/default.yaml
`)
    writeFile(resolve(PROJECT_ROOT, '.hx', 'pipelines', 'default.yaml'), `name: Default
steps:
  - id: doc
    phase: Phase 01
    name: 需求文档
    command: doc
  - id: plan
    name: 执行计划
    command: plan
  - id: run
    name: 执行需求
    command: run
`)
  })

  afterEach(() => {
    rmSync(TEST_ROOT, { recursive: true, force: true })
  })

  describe('parsePipelineYaml', () => {
    it('should parse standard pipeline YAML', () => {
      const yaml = `name: Test Pipeline

steps:
  - id: doc
    phase: Phase 01
    name: 需求文档
    command: doc
    checkpoint:
      message: 审查完整性

  - id: plan
    name: 执行计划
    command: plan

  - id: run
    name: 执行需求
    command: run
    on_fail: stop`

      const result = parsePipelineYaml(yaml)
      expect(result.name).toBe('Test Pipeline')
      expect(result.steps).toHaveLength(3)
      expect(result.steps[0]).toEqual({
        id: 'doc',
        phase: 'Phase 01',
        name: '需求文档',
        command: 'doc',
        checkpoint: { message: '审查完整性' },
      })
      expect(result.steps[1]).toEqual({
        id: 'plan',
        name: '执行计划',
        command: 'plan',
      })
      expect(result.steps[2]).toEqual({
        id: 'run',
        name: '执行需求',
        command: 'run',
        on_fail: 'stop',
      })
    })

    it('should handle comments and empty lines', () => {
      const yaml = `# Comment
name: Simple

# Another comment
steps:
  - id: test
    name: Test
    command: test`

      const result = parsePipelineYaml(yaml)
      expect(result.name).toBe('Simple')
      expect(result.steps).toHaveLength(1)
    })
  })

  describe('commandToToolScript', () => {
    it('should map doc to scripts/tools/doc.ts', () => {
      expect(commandToToolScript('doc')).toBe('scripts/tools/doc.ts')
    })

    it('should map plan to scripts/tools/plan.ts', () => {
      expect(commandToToolScript('plan')).toBe('scripts/tools/plan.ts')
    })

    it('should map reset to scripts/tools/reset.ts', () => {
      expect(commandToToolScript('reset')).toBe('scripts/tools/reset.ts')
    })

    it('should reject hx-prefixed command names', () => {
      expect(() => commandToToolScript('hx-run')).toThrow('pipeline command "hx-run" 无效')
    })
  })

  describe('loadPipeline', () => {
    it('should load default pipeline from runtime config', () => {
      const pipeline = loadPipeline('default', PROJECT_ROOT)
      expect(pipeline).not.toBeNull()
      expect(pipeline!.layer).toBe('project')
      expect(pipeline!.steps.length).toBeGreaterThan(0)
    })

    it('should load registered project pipeline', () => {
      const yaml = `name: Custom
steps:
  - id: custom
    name: Custom Step
    command: test`
      writeFile(resolve(PROJECT_ROOT, '.hx', 'pipelines', 'default.yaml'), yaml)

      const pipeline = loadPipeline('default', PROJECT_ROOT)
      expect(pipeline).not.toBeNull()
      expect(pipeline!.layer).toBe('project')
      expect(pipeline!.name).toBe('Custom')
    })

    it('should return null for non-existent pipeline', () => {
      const pipeline = loadPipeline('nonexistent', PROJECT_ROOT)
      expect(pipeline).toBeNull()
    })

    it('should return null when default is not registered in runtime config', () => {
      writeRuntimeConfig(PROJECT_ROOT, `runtime:
  hooks: {}
  pipelines: {}
`)

      const pipeline = loadPipeline('default', PROJECT_ROOT)
      expect(pipeline).toBeNull()
    })
  })

  describe('getPipelineFullState', () => {
    it('should return full state with tool script paths', () => {
      const state = getPipelineFullState(PROJECT_ROOT, 'TEST-001')
      expect(state).not.toBeNull()
      expect(state!.feature).toBe('TEST-001')
      expect(state!.steps.length).toBeGreaterThan(0)

      // 第一步应该是 pending（没有 doc 文件）
      expect(state!.steps[0].status).toBe('pending')
      expect(state!.steps[0].toolScript).toBe('scripts/tools/doc.ts')
      expect(state!.steps[0].preHooks).toEqual(['.hx/hooks/pre_doc.md'])
      expect(state!.nextStep).toBe('doc')
    })

    it('should mark doc as done when requirement file exists', () => {
      // 创建需求文件
      writeFile(resolve(PROJECT_ROOT, 'docs', 'requirement', 'FEAT-001.md'), '# Requirement')

      const state = getPipelineFullState(PROJECT_ROOT, 'FEAT-001')
      expect(state).not.toBeNull()

      const docStep = state!.steps.find((s) => s.id === 'doc')
      expect(docStep!.status).toBe('done')
      expect(state!.nextStep).toBe('plan')
    })
  })

  describe('resolveStartStep', () => {
    it('should start from doc when nothing is done', () => {
      const result = resolveStartStep(PROJECT_ROOT, 'TEST-001')
      expect(result.stepId).toBe('doc')
      expect(result.toolScript).toBe('scripts/tools/doc.ts')
      expect(result.preHooks).toEqual(['.hx/hooks/pre_doc.md'])
    })

    it('should respect --from parameter', () => {
      const result = resolveStartStep(PROJECT_ROOT, 'TEST-001', 'plan')
      expect(result.stepId).toBe('plan')
      expect(result.toolScript).toBe('scripts/tools/plan.ts')
      expect(result.preHooks).toEqual([])
    })

    it('should throw for invalid --from step', () => {
      expect(() => {
        resolveStartStep(PROJECT_ROOT, 'TEST-001', 'invalid')
      }).toThrow('不是有效的 step')
    })

    it('should throw for non-existent pipeline', () => {
      expect(() => {
        resolveStartStep(PROJECT_ROOT, 'TEST-001', undefined, 'nonexistent')
      }).toThrow('未找到')
    })
  })
})
