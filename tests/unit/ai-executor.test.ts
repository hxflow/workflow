import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { runAiTask } from '../../src/scripts/lib/ai-executor.ts'

const tempDirs: string[] = []

beforeEach(() => {
  delete process.env.HXFLOW_AI_EXECUTOR
})

afterEach(() => {
  delete process.env.HXFLOW_AI_EXECUTOR
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

function createExecutor(source: string) {
  const dir = mkdtempSync(join(tmpdir(), 'hx-ai-executor-'))
  tempDirs.push(dir)
  const executorPath = join(dir, 'executor.ts')
  writeFileSync(executorPath, source, 'utf8')
  return executorPath
}

describe('runAiTask', () => {
  it('returns blocked when executor is not configured', () => {
    const result = runAiTask({
      kind: 'implement-task',
      feature: 'AUTH-001',
      payload: { task: { id: 'TASK-1' } },
    })

    expect(result).toEqual({
      ok: false,
      exitStatus: 'blocked',
      reason: '未配置 HXFLOW_AI_EXECUTOR，无法执行 AI 任务',
    })
  })

  it('parses a successful executor response', () => {
    process.env.HXFLOW_AI_EXECUTOR = createExecutor(`
const raw = await new Response(process.stdin).text()
const input = JSON.parse(raw)
console.log(JSON.stringify({ ok: true, summary: input.payload.task.id + ' 完成' }))
`)

    const result = runAiTask({
      kind: 'implement-task',
      feature: 'AUTH-001',
      payload: { task: { id: 'TASK-1' } },
    })

    expect(result).toEqual({
      ok: true,
      summary: 'TASK-1 完成',
      artifacts: undefined,
      warnings: [],
    })
  })

  it('parses a failed executor response', () => {
    process.env.HXFLOW_AI_EXECUTOR = createExecutor(`
console.log(JSON.stringify({ ok: false, exitStatus: 'blocked', reason: '缺少接口字段' }))
`)

    const result = runAiTask({
      kind: 'implement-task',
      feature: 'AUTH-001',
      payload: { task: { id: 'TASK-1' } },
    })

    expect(result).toEqual({
      ok: false,
      exitStatus: 'blocked',
      reason: '缺少接口字段',
    })
  })
})
