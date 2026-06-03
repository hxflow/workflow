import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

import { resolveExecutionConfig, type ExecutionConfig } from './execution-config.ts'
import { getWorkspaceProjects, type WorkspaceProject } from './file-paths.ts'
import { extractTaskSection, readTaskField } from './plan-utils.ts'
import { summarizeRequirement } from './requirement-summary.ts'
import { GATE_ORDER, type GateName } from './runtime-config.ts'
import { buildTaskAuditState, type RiskClass } from './audit-state.ts'
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
    audit: {
      attempts: number
      riskClass: RiskClass
      evidence: string[]
      verification: {
        status: string
        summary: string
      }
    }
  }
  requirement: {
    summary: string
  }
  workspace: {
    projects: WorkspaceProject[]
  } | null
  execution: ExecutionConfig
  doneCriteria: {
    requiredEvidence: string[]
    scope: string[]
    verificationCommands: string[]
    gateCommands: Array<{
      name: GateName
      command: string
      source: 'project' | 'workspace'
    }>
  }
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
  const goal = readTaskField(planSection, TASK_FIELD_LABELS.goal)
  const taskScope = splitListField(readTaskField(planSection, TASK_FIELD_LABELS.scope))
  const implementationNotes = splitListField(readTaskField(planSection, TASK_FIELD_LABELS.implementationNotes))
  const acceptance = splitListField(readTaskField(planSection, TASK_FIELD_LABELS.acceptance))
  const verification = splitListField(readTaskField(planSection, TASK_FIELD_LABELS.verification))
  const execution = resolveExecutionConfig(input.projectRoot, taskCwd)
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
      goal,
      service: readTaskField(planSection, TASK_FIELD_LABELS.service),
      cwd: taskCwd,
      scope: taskScope,
      implementationNotes,
      acceptance,
      verification,
      rawPlanSection: planSection,
      audit: buildTaskAuditState(input.progressData, task),
    },
    requirement: {
      summary: requirementSummary,
    },
    workspace: buildWorkspaceContext(input.projectRoot),
    execution,
    doneCriteria: buildDoneCriteria(goal, taskScope, implementationNotes, acceptance, verification, execution),
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

function buildDoneCriteria(
  goal: string,
  scope: string[],
  implementationNotes: string[],
  acceptance: string[],
  verificationCommands: string[],
  execution: ExecutionConfig,
): TaskContextPayload['doneCriteria'] {
  const gateCommands = GATE_ORDER
    .filter((gate) => execution.gates[gate])
    .map((gate) => ({
      name: gate,
      command: execution.gates[gate] as string,
      source: execution.gateSources[gate] ?? execution.source,
    }))

  return {
    requiredEvidence: [
      goal ? '目标已实现' : 'plan 未声明目标，需先补齐或说明',
      implementationNotes.length > 0 ? '实施要点已逐条完成' : 'plan 未声明实施要点，需先补齐或说明',
      acceptance.length > 0 ? '验收标准已逐条满足' : 'plan 未声明验收标准，需先补齐或说明',
      verificationCommands.length > 0 ? '验证方式中的命令已执行且通过' : 'plan 未声明验证方式，需先补齐或说明',
      'execution.gates 中配置的质量门已执行且通过',
      scope.length > 0 ? 'git diff 的变更文件落在修改范围内；范围外变更必须有明确说明' : 'plan 未声明修改范围，需先补齐或说明',
    ],
    scope,
    verificationCommands,
    gateCommands,
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
