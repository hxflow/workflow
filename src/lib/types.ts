export type ExitStatus = 'succeeded' | 'failed' | 'aborted' | 'blocked' | 'timeout'

export type TaskStatus = 'pending' | 'in-progress' | 'done'

export interface FeatureHeader {
  feature: string
  displayName: string
  sourceId: string
  sourceFingerprint: string
}

export interface ProgressTask {
  id: string
  name: string
  status: TaskStatus
  dependsOn: string[]
  parallelizable: boolean
  output: string
  startedAt: string | null
  completedAt: string | null
  durationSeconds: number | null
}

export interface ProgressLastRun {
  taskId: string
  taskName: string
  status: Exclude<TaskStatus, 'pending'>
  exitStatus: ExitStatus
  exitReason: string
  ranAt: string
}

export interface ProgressData {
  feature: string
  requirementDoc: string
  planDoc: string
  createdAt: string
  updatedAt: string
  completedAt: string | null
  lastRun: ProgressLastRun | null
  tasks: ProgressTask[]
}

export interface ScheduledBatch {
  tasks: ProgressTask[]
  parallel: boolean
  mode: 'recover' | 'run' | 'done'
}
