import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  getPipelineState,
  isDocDone,
  isPlanDone,
  isRunDone,
  resolvePipelineStartStep,
} from '../../src/scripts/lib/pipeline-state.ts'

const tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

function createProject() {
  const projectRoot = mkdtempSync(join(tmpdir(), 'hx-pipeline-state-'))
  tempDirs.push(projectRoot)
  mkdirSync(join(projectRoot, 'docs', 'plans'), { recursive: true })
  mkdirSync(join(projectRoot, 'docs', 'requirement'), { recursive: true })
  return projectRoot
}

describe('pipeline-state', () => {
  it('marks doc, plan, and run as pending when no feature artifacts exist', () => {
    const projectRoot = createProject()

    expect(isDocDone(projectRoot, 'AUTH-001')).toBe(false)
    expect(isPlanDone(projectRoot, 'AUTH-001')).toBe(false)
    expect(isRunDone(projectRoot, 'AUTH-001')).toBe(false)
    expect(getPipelineState(projectRoot, 'AUTH-001')).toEqual([
      { id: 'doc', name: '需求文档', command: 'hx doc', persistent: true, status: 'pending' },
      { id: 'plan', name: '执行计划', command: 'hx plan', persistent: true, status: 'pending' },
      { id: 'run', name: '执行需求', command: 'hx run', persistent: true, status: 'pending' },
      { id: 'check', name: '核心检查', command: 'hx check', persistent: false, status: 'rerun' },
      { id: 'mr', name: 'MR 描述', command: 'hx mr', persistent: false, status: 'rerun' },
    ])
    expect(resolvePipelineStartStep(projectRoot, 'AUTH-001')).toBe('doc')
  })

  it('treats an existing progress file with all tasks done as run complete', () => {
    const projectRoot = createProject()

    writeFileSync(
      join(projectRoot, 'docs', 'requirement', 'AUTH-001.md'),
      '# Requirement\n',
      'utf8',
    )
    writeFileSync(
      join(projectRoot, 'docs', 'plans', 'AUTH-001-progress.json'),
      JSON.stringify(
        {
          feature: 'AUTH-001',
          requirementDoc: 'docs/requirement/AUTH-001.md',
          planDoc: 'docs/plans/AUTH-001.md',
          createdAt: '2026-04-13T10:00:00Z',
          updatedAt: '2026-04-13T10:10:00Z',
          completedAt: '2026-04-13T10:10:00Z',
          lastRun: null,
          tasks: [
            {
              id: 'TASK-1',
              name: '实现登录接口',
              status: 'done',
              dependsOn: [],
              parallelizable: false,
              output: '已完成',
              startedAt: '2026-04-13T10:00:00Z',
              completedAt: '2026-04-13T10:10:00Z',
              durationSeconds: 600,
            },
          ],
        },
        null,
        2,
      ) + '\n',
      'utf8',
    )

    expect(isDocDone(projectRoot, 'AUTH-001')).toBe(true)
    expect(isPlanDone(projectRoot, 'AUTH-001')).toBe(true)
    expect(isRunDone(projectRoot, 'AUTH-001')).toBe(true)
    expect(resolvePipelineStartStep(projectRoot, 'AUTH-001')).toBe('check')
  })

  it('accepts a valid --from step and rejects an invalid step', () => {
    const projectRoot = createProject()

    expect(resolvePipelineStartStep(projectRoot, 'AUTH-001', 'run')).toBe('run')
    expect(() => resolvePipelineStartStep(projectRoot, 'AUTH-001', 'deploy')).toThrow(
      '--from "deploy" 不是有效的 step',
    )
  })
})
