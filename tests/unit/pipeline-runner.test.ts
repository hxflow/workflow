import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { resolve } from 'path'
import { tmpdir } from 'os'

import {
  parsePipelineYaml,
  loadPipeline,
  commandToToolScript,
  getPipelineFullState,
  resolveStartStep,
} from '../../src/lib/pipeline-runner.ts'

const TEST_ROOT = resolve(tmpdir(), `hx-pipeline-test-${Date.now()}`)
const PROJECT_ROOT = resolve(TEST_ROOT, 'project')

function ensureDir(dir: string) {
  mkdirSync(dir, { recursive: true })
}

function writeFile(path: string, content: string) {
  ensureDir(resolve(path, '..'))
  writeFileSync(path, content, 'utf8')
}

describe('pipeline-runner', () => {
  beforeEach(() => {
    ensureDir(PROJECT_ROOT)
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
    command: hx-doc
    checkpoint:
      message: 审查完整性

  - id: plan
    name: 执行计划
    command: hx-plan

  - id: run
    name: 执行需求
    command: hx-run
    on_fail: stop`

      const result = parsePipelineYaml(yaml)
      expect(result.name).toBe('Test Pipeline')
      expect(result.steps).toHaveLength(3)
      expect(result.steps[0]).toEqual({
        id: 'doc',
        phase: 'Phase 01',
        name: '需求文档',
        command: 'hx-doc',
        checkpoint: { message: '审查完整性' },
      })
      expect(result.steps[1]).toEqual({
        id: 'plan',
        name: '执行计划',
        command: 'hx-plan',
      })
      expect(result.steps[2]).toEqual({
        id: 'run',
        name: '执行需求',
        command: 'hx-run',
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
    command: hx-test`

      const result = parsePipelineYaml(yaml)
      expect(result.name).toBe('Simple')
      expect(result.steps).toHaveLength(1)
    })
  })

  describe('commandToToolScript', () => {
    it('should map hx-doc to src/tools/doc.ts', () => {
      expect(commandToToolScript('hx-doc')).toBe('src/tools/doc.ts')
    })

    it('should map hx-plan to src/tools/plan.ts', () => {
      expect(commandToToolScript('hx-plan')).toBe('src/tools/plan.ts')
    })

    it('should handle "hx run" format', () => {
      expect(commandToToolScript('hx run')).toBe('src/tools/run.ts')
    })
  })

  describe('loadPipeline', () => {
    it('should load default pipeline from framework', () => {
      const pipeline = loadPipeline('default', PROJECT_ROOT)
      expect(pipeline).not.toBeNull()
      expect(pipeline!.layer).toBe('framework')
      expect(pipeline!.steps.length).toBeGreaterThan(0)
    })

    it('should load project pipeline over framework', () => {
      const yaml = `name: Custom
steps:
  - id: custom
    name: Custom Step
    command: hx-test`
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
  })

  describe('getPipelineFullState', () => {
    it('should return full state with tool script paths', () => {
      const state = getPipelineFullState(PROJECT_ROOT, 'TEST-001')
      expect(state).not.toBeNull()
      expect(state!.feature).toBe('TEST-001')
      expect(state!.steps.length).toBeGreaterThan(0)

      // 第一步应该是 pending（没有 doc 文件）
      expect(state!.steps[0].status).toBe('pending')
      expect(state!.steps[0].toolScript).toBe('src/tools/doc.ts')
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
      expect(result.toolScript).toBe('src/tools/doc.ts')
    })

    it('should respect --from parameter', () => {
      const result = resolveStartStep(PROJECT_ROOT, 'TEST-001', 'plan')
      expect(result.stepId).toBe('plan')
      expect(result.toolScript).toBe('src/tools/plan.ts')
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
