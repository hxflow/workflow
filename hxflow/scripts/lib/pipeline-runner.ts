/**
 * pipeline-runner.ts — Pipeline 解析与步骤编排
 *
 * 读取 pipeline YAML（框架层 + 项目层），解析步骤定义，
 * 结合文件系统状态判断每步完成情况，返回结构化流水线状态。
 */

import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

import { parse as parseYaml } from 'yaml'

import { getActiveProgressFilePath, getArchiveDirPath, getRequirementDocPath } from './file-paths.ts'
import { resolveCommandHooks } from './hook-resolver.ts'
import { readRuntimeConfig } from './runtime-config.ts'
import { validateProgressData } from './progress-schema.ts'

// ── Types ───────────────────────────────────────────────────

export interface PipelineStep {
  id: string
  phase?: string
  name: string
  command: string
  checkpoint?: { message: string }
  on_fail?: 'stop'
}

export interface Pipeline {
  name: string
  steps: PipelineStep[]
  filePath: string
  layer: string
}

export interface PipelineStepStatus {
  id: string
  phase?: string
  name: string
  command: string
  toolScript: string
  preHooks: string[]
  status: 'done' | 'pending' | 'rerun'
  checkpoint?: { message: string }
}

export interface PipelineState {
  pipeline: string
  layer: string
  feature: string
  allDone: boolean
  nextStep: string | null
  steps: PipelineStepStatus[]
}

// ── YAML 解析 ──────────────────────────────────────────────

export function parsePipelineYaml(content: string): { name: string; steps: PipelineStep[] } {
  const doc = (parseYaml(content) ?? {}) as Record<string, unknown>
  const name = typeof doc.name === 'string' ? doc.name : ''
  const rawSteps = Array.isArray(doc.steps) ? doc.steps : []

  const steps: PipelineStep[] = rawSteps
    .filter((s): s is Record<string, unknown> => typeof s === 'object' && s !== null)
    .filter((s) => typeof s.id === 'string' && s.id)
    .map((s) => {
      const step: PipelineStep = {
        id: s.id as string,
        name: typeof s.name === 'string' ? s.name : '',
        command: typeof s.command === 'string' ? s.command : '',
      }
      if (typeof s.phase === 'string') step.phase = s.phase
      if (s.on_fail === 'stop') step.on_fail = 'stop'
      if (typeof s.checkpoint === 'object' && s.checkpoint !== null) {
        const cp = s.checkpoint as Record<string, unknown>
        if (typeof cp.message === 'string') step.checkpoint = { message: cp.message }
      }
      return step
    })

  return { name, steps }
}

// ── Pipeline loading ────────────────────────────────────────

/**
 * 加载并解析 pipeline 文件（完全由 .hx/config.yaml runtime.pipelines 注册）。
 */
export function loadPipeline(pipelineName: string, projectRoot: string): Pipeline | null {
  const runtimeConfig = readRuntimeConfig(projectRoot)
  const pipelinePath = runtimeConfig.pipelines[pipelineName]
  if (!pipelinePath) return null

  const filePath = resolve(projectRoot, pipelinePath)
  if (!existsSync(filePath)) return null

  const content = readFileSync(filePath, 'utf8')
  const parsed = parsePipelineYaml(content)
  return { name: parsed.name, steps: parsed.steps, filePath, layer: 'project' }
}

// ── Command → tool script mapping ──────────────────────────

/**
 * 将 pipeline 中的 command（如 doc）映射为裸脚本路径。
 */
export function commandToToolScript(command: string): string {
  const name = command.trim()
  if (!/^[a-z][a-z0-9-]*$/.test(name) || name.startsWith('hx-')) {
    throw new Error(`pipeline command "${command}" 无效，请使用 doc/plan/run/check/mr 这类命令名`)
  }
  return `scripts/tools/${name}.ts`
}

// ── Step status resolution ──────────────────────────────────

/**
 * 判断单个步骤是否完成（基于文件系统事实）。
 * 只有 doc/plan/run 有持久化的完成标记，其他步骤总是 rerun。
 */
function resolveStepStatus(
  step: PipelineStep,
  projectRoot: string,
  feature: string,
): 'done' | 'pending' | 'rerun' {
  switch (step.id) {
    case 'doc':
      return isDocDone(projectRoot, feature) ? 'done' : 'pending'
    case 'plan':
      return isPlanDone(projectRoot, feature) ? 'done' : 'pending'
    case 'run':
      return isRunDone(projectRoot, feature) ? 'done' : 'pending'
    default:
      return 'rerun'
  }
}

// ── Pipeline state ──────────────────────────────────────────

/**
 * 获取完整的流水线状态。
 */
export function getPipelineFullState(
  projectRoot: string,
  feature: string,
  pipelineName = 'default',
): PipelineState | null {
  const pipeline = loadPipeline(pipelineName, projectRoot)
  if (!pipeline) return null

  const steps: PipelineStepStatus[] = pipeline.steps.map((step) => {
    const hooks = resolveCommandHooks(projectRoot, step.command)

    return {
      id: step.id,
      phase: step.phase,
      name: step.name,
      command: step.command,
      toolScript: commandToToolScript(step.command),
      preHooks: hooks.preHooks.map((hook) => hook.path),
      status: resolveStepStatus(step, projectRoot, feature),
      ...(step.checkpoint ? { checkpoint: step.checkpoint } : {}),
    }
  })

  let nextStep: string | null = null
  for (const step of steps) {
    if (step.status === 'pending') {
      nextStep = step.id
      break
    }
    if (step.status === 'rerun') {
      nextStep = step.id
      break
    }
  }

  const allDone = steps.every((s) => s.status === 'done')

  return {
    pipeline: pipeline.name,
    layer: pipeline.layer,
    feature,
    allDone,
    nextStep: allDone ? null : nextStep,
    steps,
  }
}

function isDocDone(projectRoot: string, feature: string): boolean {
  return existsSync(getRequirementDocPath(projectRoot, feature))
}

function isPlanDone(projectRoot: string, feature: string): boolean {
  const active = getActiveProgressFilePath(projectRoot, feature)
  const archived = resolve(getArchiveDirPath(projectRoot, feature), `${feature}-progress.json`)
  return existsSync(active) || existsSync(archived)
}

function isRunDone(projectRoot: string, feature: string): boolean {
  const archived = resolve(getArchiveDirPath(projectRoot, feature), `${feature}-progress.json`)
  if (existsSync(archived)) {
    return true
  }

  const active = getActiveProgressFilePath(projectRoot, feature)
  if (!existsSync(active)) {
    return false
  }

  try {
    const data = JSON.parse(readFileSync(active, 'utf8'))
    const validation = validateProgressData(data)
    if (!validation.valid) {
      return false
    }

    return data.completedAt !== null || data.tasks.every((task: { status: string }) => task.status === 'done')
  } catch {
    return false
  }
}

/**
 * 解析流水线起始步骤。
 * 支持 --from 显式指定，否则自动从第一个未完成步骤开始。
 */
export function resolveStartStep(
  projectRoot: string,
  feature: string,
  requestedStep?: string | null,
  pipelineName = 'default',
): { stepId: string; toolScript: string; pipeline: string; preHooks: string[] } {
  const pipeline = loadPipeline(pipelineName, projectRoot)
  if (!pipeline) {
    throw new Error(`Pipeline "${pipelineName}" 未找到（请在 .hx/config.yaml 的 runtime.pipelines 中注册）`)
  }

  if (requestedStep) {
    const step = pipeline.steps.find((s) => s.id === requestedStep)
    if (!step) {
      const validIds = pipeline.steps.map((s) => s.id).join(', ')
      throw new Error(`--from "${requestedStep}" 不是有效的 step，可选：${validIds}`)
    }
    return {
      stepId: step.id,
      toolScript: commandToToolScript(step.command),
      pipeline: pipeline.name,
      preHooks: resolveCommandHooks(projectRoot, step.command).preHooks.map((hook) => hook.path),
    }
  }

  for (const step of pipeline.steps) {
    const status = resolveStepStatus(step, projectRoot, feature)
    if (status !== 'done') {
      return {
        stepId: step.id,
        toolScript: commandToToolScript(step.command),
        pipeline: pipeline.name,
        preHooks: resolveCommandHooks(projectRoot, step.command).preHooks.map((hook) => hook.path),
      }
    }
  }

  // 全部完成，从最后一个 rerun 步骤开始
  const lastRerun = [...pipeline.steps].reverse().find((s) => resolveStepStatus(s, projectRoot, feature) === 'rerun')
  const fallback = lastRerun ?? pipeline.steps[pipeline.steps.length - 1]

  return {
    stepId: fallback.id,
    toolScript: commandToToolScript(fallback.command),
    pipeline: pipeline.name,
    preHooks: resolveCommandHooks(projectRoot, fallback.command).preHooks.map((hook) => hook.path),
  }
}
