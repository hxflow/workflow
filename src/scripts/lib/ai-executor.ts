import { spawnSync } from 'child_process'

export type AiTaskKind =
  | 'implement-task'
  | 'quality-check'
  | 'review'
  | 'clean'
  | 'generate-mr'
  | 'generate-plan'
  | 'fix'
  | 'generate-doc'
  | 'update-rules'
  | 'init-project'

export interface RunAiTaskInput {
  kind: AiTaskKind
  feature: string
  payload: unknown
}

export interface RunAiTaskSuccess {
  ok: true
  summary: string
  artifacts?: Record<string, unknown>
  warnings?: string[]
}

export interface RunAiTaskFailure {
  ok: false
  exitStatus: 'failed' | 'aborted' | 'blocked' | 'timeout'
  reason: string
}

export type RunAiTaskResult = RunAiTaskSuccess | RunAiTaskFailure

export function runAiTask(input: RunAiTaskInput): RunAiTaskResult {
  const executorPath = process.env.HXFLOW_AI_EXECUTOR

  if (!executorPath) {
    return {
      ok: false,
      exitStatus: 'blocked',
      reason: '未配置 HXFLOW_AI_EXECUTOR，无法执行 AI 任务',
    }
  }

  const result = spawnSync('bun', [executorPath], {
    encoding: 'utf8',
    input: JSON.stringify(input),
    env: process.env,
    timeout: 300000,
  })

  if (result.status !== 0) {
    return {
      ok: false,
      exitStatus: 'failed',
      reason: (result.stderr || result.stdout || `AI 执行器退出码 ${result.status}`).trim(),
    }
  }

  try {
    const parsed = JSON.parse(result.stdout.trim() || '{}')
    if (parsed?.ok === true && typeof parsed.summary === 'string' && parsed.summary.trim() !== '') {
      return {
        ok: true,
        summary: parsed.summary.trim(),
        artifacts: parsed.artifacts,
        warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
      }
    }

    if (parsed?.ok === false && typeof parsed.reason === 'string' && parsed.reason.trim() !== '') {
      return {
        ok: false,
        exitStatus: isExitStatus(parsed.exitStatus) ? parsed.exitStatus : 'failed',
        reason: parsed.reason.trim(),
      }
    }
  } catch (error) {
    return {
      ok: false,
      exitStatus: 'failed',
      reason: `AI 执行器输出不是合法 JSON：${error instanceof Error ? error.message : String(error)}`,
    }
  }

  return {
    ok: false,
    exitStatus: 'failed',
    reason: 'AI 执行器返回格式无效',
  }
}

function isExitStatus(value: unknown): value is RunAiTaskFailure['exitStatus'] {
  return value === 'failed' || value === 'aborted' || value === 'blocked' || value === 'timeout'
}
