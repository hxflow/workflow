import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

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
    scope: string[]
    implementationNotes: string[]
    acceptance: string[]
    verification: string[]
    rawPlanSection: string
  }
  requirement: {
    summary: string
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
      scope: splitListField(readTaskField(planSection, TASK_FIELD_LABELS.scope)),
      implementationNotes: splitListField(readTaskField(planSection, TASK_FIELD_LABELS.implementationNotes)),
      acceptance: splitListField(readTaskField(planSection, TASK_FIELD_LABELS.acceptance)),
      verification: splitListField(readTaskField(planSection, TASK_FIELD_LABELS.verification)),
      rawPlanSection: planSection,
    },
    requirement: {
      summary: requirementSummary,
    },
    dependencies: task.dependsOn
      .map((dependencyId) => input.progressData.tasks.find((candidate) => candidate.id === dependencyId))
      .filter(Boolean)
      .map((dependencyTask) => ({
        id: dependencyTask.id,
        name: dependencyTask.name,
        status: dependencyTask.status,
        output: dependencyTask.output,
      })),
  }
}

function getTask(progressData: ProgressData, taskId: string): ProgressTask {
  const task = progressData.tasks.find((item) => item.id === taskId)
  if (!task) {
    throw new Error(`task "${taskId}" 不存在于 progressFile`)
  }
  return task
}

function extractTaskSection(planContent: string, taskId: string): string {
  const escapedTaskId = escapeRegExp(taskId)
  const headingPattern = new RegExp(`^###\\s+${escapedTaskId}(?:\\s.*)?$`, 'm')
  const headingMatch = headingPattern.exec(planContent)
  if (!headingMatch || headingMatch.index === undefined) {
    return ''
  }

  const sectionStart = headingMatch.index + headingMatch[0].length
  const remaining = planContent.slice(sectionStart).replace(/^\r?\n/, '')
  const nextHeadingIndex = remaining.search(/^###\s+/m)
  return (nextHeadingIndex === -1 ? remaining : remaining.slice(0, nextHeadingIndex)).trim()
}

function readTaskField(section: string, label: string): string {
  if (!section) return ''
  const pattern = new RegExp(`^-\\s*${escapeRegExp(label)}:\\s*(.*)$`, 'm')
  const match = section.match(pattern)
  return match ? match[1].trim() : ''
}

function splitListField(value: string): string[] {
  if (!value) return []
  return value
    .split(/[，,、]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function summarizeRequirement(content: string): string {
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('>') && !line.startsWith('#'))

  return lines.slice(0, 8).join('\n')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
