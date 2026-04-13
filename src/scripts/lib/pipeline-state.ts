import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

import { getActiveProgressFilePath, getArchiveDirPath, getRequirementDocPath } from './file-paths.ts'
import { validateProgressData } from './progress-schema.ts'

export type PipelineStepId = 'doc' | 'plan' | 'run' | 'check' | 'mr'
export type PipelineStepStatus = 'done' | 'pending' | 'rerun'

export interface PipelineStepDefinition {
  id: PipelineStepId
  name: string
  command: string
  persistent: boolean
}

export interface PipelineStepState extends PipelineStepDefinition {
  status: PipelineStepStatus
}

export const DEFAULT_PIPELINE_STEPS: PipelineStepDefinition[] = [
  { id: 'doc', name: '需求文档', command: 'hx doc', persistent: true },
  { id: 'plan', name: '执行计划', command: 'hx plan', persistent: true },
  { id: 'run', name: '执行需求', command: 'hx run', persistent: true },
  { id: 'check', name: '核心检查', command: 'hx check', persistent: false },
  { id: 'mr', name: 'MR 描述', command: 'hx mr', persistent: false },
]

export function isDocDone(projectRoot: string, feature: string): boolean {
  return existsSync(getRequirementDocPath(projectRoot, feature))
}

export function isPlanDone(projectRoot: string, feature: string): boolean {
  const active = getActiveProgressFilePath(projectRoot, feature)
  const archived = resolve(getArchiveDirPath(projectRoot, feature), `${feature}-progress.json`)
  return existsSync(active) || existsSync(archived)
}

export function isRunDone(projectRoot: string, feature: string): boolean {
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

export function getPipelineState(projectRoot: string, feature: string): PipelineStepState[] {
  const docDone = isDocDone(projectRoot, feature)
  const planDone = isPlanDone(projectRoot, feature)
  const runDone = isRunDone(projectRoot, feature)

  return DEFAULT_PIPELINE_STEPS.map((step) => ({
    ...step,
    status:
      step.id === 'doc'
        ? docDone
          ? 'done'
          : 'pending'
        : step.id === 'plan'
          ? planDone
            ? 'done'
            : 'pending'
          : step.id === 'run'
            ? runDone
              ? 'done'
              : 'pending'
            : 'rerun',
  }))
}

export function resolvePipelineStartStep(projectRoot: string, feature: string, requestedStep?: string | null) {
  if (requestedStep) {
    if (!DEFAULT_PIPELINE_STEPS.some((step) => step.id === requestedStep)) {
      throw new Error(`--from "${requestedStep}" 不是有效的 step`)
    }
    return requestedStep as PipelineStepId
  }

  if (!isDocDone(projectRoot, feature)) {
    return 'doc'
  }
  if (!isPlanDone(projectRoot, feature)) {
    return 'plan'
  }
  if (!isRunDone(projectRoot, feature)) {
    return 'run'
  }
  return 'check'
}
