import { readBudgetConfig, type RuntimeBudgetConfig } from './runtime-config.ts'
import type { ExitStatus, ProgressData, ProgressTask } from './types.ts'

export type VerificationStatus = 'pending' | 'passed' | 'failed' | 'not-covered'
export type RiskClass = 'read' | 'write' | 'external' | 'destructive'

export interface TaskAuditState {
  attempts: number
  evidence: string[]
  verification: {
    status: VerificationStatus
    summary: string
  }
  riskClass: RiskClass
}

export interface WorkflowAuditState {
  budget: RuntimeBudgetConfig
  stopReason: string | null
  reworkCycles: number
}

export function buildWorkflowAuditState(projectRoot: string, progressData: ProgressData | null): WorkflowAuditState {
  const budget = readBudgetConfig(projectRoot)
  const reworkCycles = progressData ? countReworkCycles(progressData) : 0
  const stopReason = resolveStopReason(budget, reworkCycles, progressData)

  return {
    budget,
    stopReason,
    reworkCycles,
  }
}

export function buildTaskAuditState(progressData: ProgressData, task: ProgressTask): TaskAuditState {
  return {
    attempts: countTaskAttempts(progressData, task.id),
    evidence: buildTaskEvidence(task),
    verification: buildVerificationState(progressData, task),
    riskClass: inferRiskClass(task),
  }
}

function resolveStopReason(
  budget: RuntimeBudgetConfig,
  reworkCycles: number,
  progressData: ProgressData | null,
): string | null {
  if (budget.maxReworkCycles !== null && reworkCycles >= budget.maxReworkCycles) {
    return `maxReworkCycles:${budget.maxReworkCycles}`
  }

  if (progressData?.lastRun && budget.maxStepAttempts !== null) {
    const attempts = countTaskAttempts(progressData, progressData.lastRun.taskId)
    if (attempts >= budget.maxStepAttempts && progressData.lastRun.exitStatus !== 'succeeded') {
      return `maxStepAttempts:${budget.maxStepAttempts}:${progressData.lastRun.taskId}`
    }
  }

  return null
}

function countTaskAttempts(progressData: ProgressData, taskId: string): number {
  const task = progressData.tasks.find((item) => item.id === taskId)
  if (!task || task.startedAt === null) {
    return 0
  }

  const lastRunCountsForTask = progressData.lastRun?.taskId === taskId ? 1 : 0
  return Math.max(1, lastRunCountsForTask)
}

function countReworkCycles(progressData: ProgressData): number {
  const lastRun = progressData.lastRun
  if (!lastRun || lastRun.exitStatus === 'succeeded') {
    return 0
  }

  return isFailureExit(lastRun.exitStatus) ? 1 : 0
}

function buildTaskEvidence(task: ProgressTask): string[] {
  const evidence: string[] = []
  if (task.output) evidence.push(task.output)
  if (task.startedAt) evidence.push(`startedAt:${task.startedAt}`)
  if (task.completedAt) evidence.push(`completedAt:${task.completedAt}`)
  return evidence
}

function buildVerificationState(progressData: ProgressData, task: ProgressTask): TaskAuditState['verification'] {
  if (task.status === 'done') {
    return { status: 'passed', summary: task.output }
  }

  if (progressData.lastRun?.taskId === task.id && isFailureExit(progressData.lastRun.exitStatus)) {
    return { status: 'failed', summary: progressData.lastRun.exitReason }
  }

  if (task.status === 'pending') {
    return { status: 'pending', summary: '' }
  }

  return { status: 'not-covered', summary: 'task 已开始但尚未记录完成或失败验证结果' }
}

function inferRiskClass(task: ProgressTask): RiskClass {
  const text = `${task.id} ${task.name}`.toLowerCase()
  if (text.includes('delete') || text.includes('remove') || text.includes('drop') || text.includes('删除') || text.includes('移除')) {
    return 'destructive'
  }
  if (text.includes('deploy') || text.includes('publish') || text.includes('external') || text.includes('发布') || text.includes('部署')) {
    return 'external'
  }
  if (task.status === 'pending') {
    return 'write'
  }
  return 'read'
}

function isFailureExit(status: ExitStatus): boolean {
  return status === 'failed' || status === 'aborted' || status === 'blocked' || status === 'timeout'
}
