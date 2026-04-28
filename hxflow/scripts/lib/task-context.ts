import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

import { resolveExecutionConfig, type ExecutionConfig } from './execution-config.ts'
import { getWorkspaceProjects, type WorkspaceProject } from './file-paths.ts'
import { extractTaskSection, readTaskField } from './plan-utils.ts'
import { summarizeRequirement } from './requirement-summary.ts'
import type { ProgressData, ProgressTask } from './types.ts'

export interface TaskDependencyContext {
  id: string
  name: string
  status: string
  output: string
}

export interface TaskContextPayload {
  feature: string
  projectRoot: string
  mode: 'run' | 'recover'
  requirementDoc: string
  planDoc: string
  task: {
    id: string
    name: string
    goal: string
    service: string
    cwd: string
    scope: string[]
    implementationNotes: string[]
    acceptance: string[]
    verification: string[]
    rawPlanSection: string
  }
  requirement: {
    summary: string
  }
  workspace: {
    projects: WorkspaceProject[]
  } | null
  execution: ExecutionConfig
  dependencies: TaskDependencyContext[]
}

interface BuildTaskContextInput {
  feature: string
  projectRoot: string
  progressData: ProgressData
  taskId: string
  mode: 'run' | 'recover'
}

const TASK_FIELD_LABELS = {
  goal: '目标',
  service: '执行服务',
  cwd: '执行目录',
  scope: '修改范围',
  implementationNotes: '实施要点',
  acceptance: '验收标准',
  verification: '验证方式',
} as const

export function buildTaskContext(input: BuildTaskContextInput): TaskContextPayload {
  const task = getTask(input.progressData, input.taskId)
  const planDoc = resolve(input.projectRoot, input.progressData.planDoc)
  const requirementDoc = resolve(input.projectRoot, input.progressData.requirementDoc)
  const planSection = existsSync(planDoc) ? extractTaskSection(readFileSync(planDoc, 'utf8'), task.id) : ''
  const taskCwd = readTaskField(planSection, TASK_FIELD_LABELS.cwd)
  const requirementSummary = existsSync(requirementDoc)
    ? summarizeRequirement(readFileSync(requirementDoc, 'utf8'))
    : ''

  return {
    feature: input.feature,
    projectRoot: input.projectRoot,
    mode: input.mode,
    requirementDoc,
    planDoc,
    task: {
      id: task.id,
      name: task.name,
      goal: readTaskField(planSection, TASK_FIELD_LABELS.goal),
      service: readTaskField(planSection, TASK_FIELD_LABELS.service),
      cwd: taskCwd,
      scope: splitListField(readTaskField(planSection, TASK_FIELD_LABELS.scope)),
      implementationNotes: splitListField(readTaskField(planSection, TASK_FIELD_LABELS.implementationNotes)),
      acceptance: splitListField(readTaskField(planSection, TASK_FIELD_LABELS.acceptance)),
      verification: splitListField(readTaskField(planSection, TASK_FIELD_LABELS.verification)),
      rawPlanSection: planSection,
    },
    requirement: {
      summary: requirementSummary,
    },
    workspace: buildWorkspaceContext(input.projectRoot),
    execution: resolveExecutionConfig(input.projectRoot, taskCwd),
    dependencies: task.dependsOn
      .map((dependencyId) => input.progressData.tasks.find((candidate) => candidate.id === dependencyId))
      .filter((item): item is ProgressTask => item !== undefined)
      .map((dependencyTask) => ({
        id: dependencyTask.id,
        name: dependencyTask.name,
        status: dependencyTask.status,
        output: dependencyTask.output,
      })),
  }
}

function buildWorkspaceContext(projectRoot: string) {
  const projects = getWorkspaceProjects(projectRoot)
  return projects.length > 0 ? { projects } : null
}

function getTask(progressData: ProgressData, taskId: string): ProgressTask {
  const task = progressData.tasks.find((item) => item.id === taskId)
  if (!task) {
    throw new Error(`task "${taskId}" 不存在于 progressFile`)
  }
  return task
}

function splitListField(value: string): string[] {
  if (!value) return []
  return value
    .split(/[，,、]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

