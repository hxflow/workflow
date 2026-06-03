import { existsSync, readdirSync } from 'fs'
import { basename, relative, resolve, sep } from 'path'

import { getRecoverableTasks, getRunnableTasks } from './task-scheduler.ts'
import { buildTaskContext } from './task-context.ts'
import { getFeatureArtifactPaths, resolveFeatureArtifactRoot } from './file-paths.ts'
import { loadValidatedProgressFile } from './progress-context.ts'
import { readPathsConfig } from './runtime-config.ts'
import { HX_CONFIG_FILE, HX_WORKSPACE_FILE } from './resolve-context.ts'
import type { ProgressData, ProgressTask } from './types.ts'

export interface WriteGuardInput {
  projectRoot: string
  paths: string[]
  feature?: string
  taskId?: string
  env?: Record<string, string | undefined>
}

export interface WriteGuardResult {
  ok: boolean
  applies: boolean
  projectRoot: string
  feature: string | null
  sourcePaths: string[]
  allowedTasks: Array<{ id: string; name: string; status: string }>
  errors: string[]
  next: string[]
}

interface FeatureCandidate {
  feature: string
  progressFile: string
  data: ProgressData
}

export function guardWrite(input: WriteGuardInput): WriteGuardResult {
  const sourcePaths = filterSourcePaths(input.projectRoot, input.paths)
  if (input.paths.length > 0 && sourcePaths.length === 0) {
    return buildResult(input.projectRoot, null, sourcePaths, [], [], [], false)
  }

  const errors: string[] = []
  const next: string[] = []
  const strict = input.env?.HXFLOW_GUARD_MODE === 'strict'
  const explicitFeature = input.feature ?? input.env?.HX_FEATURE

  const feature = resolveFeature(input.projectRoot, explicitFeature, strict, errors, next)
  if (!feature) {
    return buildResult(input.projectRoot, null, sourcePaths, [], errors, next, errors.length > 0)
  }

  if (!hasHxConfig(input.projectRoot)) {
    return buildResult(
      input.projectRoot,
      feature,
      sourcePaths,
      [],
      ['未找到 .hx/config.yaml 或 .hx/workspace.yaml，不能直接写源码'],
      ['先执行 hx init'],
      true,
    )
  }

  const featureRoot = resolveFeatureArtifactRoot(input.projectRoot, feature)
  const artifactPaths = getFeatureArtifactPaths(featureRoot, feature)
  if (!existsSync(artifactPaths.requirementDoc)) {
    errors.push(`requirementDoc 不存在：${relativePath(featureRoot, artifactPaths.requirementDoc)}`)
    next.push(`执行 hx doc ${feature}`)
  }
  if (!existsSync(artifactPaths.planDoc)) {
    errors.push(`planDoc 不存在：${relativePath(featureRoot, artifactPaths.planDoc)}`)
    next.push(`执行 hx plan ${feature}`)
  }
  if (!existsSync(artifactPaths.progressFile)) {
    errors.push(`progressFile 不存在：${relativePath(featureRoot, artifactPaths.progressFile)}`)
    next.push(`执行 hx plan ${feature}`)
    return buildResult(featureRoot, feature, sourcePaths, [], unique(errors), unique(next), true)
  }

  const progress = (() => {
    try {
      return loadValidatedProgressFile(artifactPaths.progressFile).data
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
      next.push(`修复 ${relativePath(featureRoot, artifactPaths.progressFile)}，再执行 hx plan validate ${feature}`)
      return null
    }
  })()

  if (!progress) {
    return buildResult(featureRoot, feature, sourcePaths, [], unique(errors), unique(next), true)
  }

  const allowedTasks = resolveAllowedTasks(progress, input.taskId, errors)
  if (allowedTasks.length === 0 && errors.length === 0) {
    errors.push(`feature "${feature}" 当前没有可执行或可恢复的任务`)
    next.push(`执行 hx status ${feature} 查看状态`)
  }

  const scopeErrors = sourcePaths.length > 0
    ? validateSourcePathScope(featureRoot, feature, progress, allowedTasks, sourcePaths)
    : []
  errors.push(...scopeErrors)
  if (scopeErrors.length > 0) {
    next.push(`执行 hx run next ${feature}，只修改返回的 tasksContext[].doneCriteria.scope`)
  }

  if (allowedTasks.length > 0 && errors.length === 0) {
    next.push(`按 hx run next ${feature} 返回的任务上下文实现，并用 hx-progress done 回写`)
  }

  return buildResult(
    featureRoot,
    feature,
    sourcePaths,
    allowedTasks.map((task) => ({ id: task.id, name: task.name, status: task.status })),
    unique(errors),
    unique(next),
    true,
  )
}

function hasHxConfig(projectRoot: string): boolean {
  return existsSync(resolve(projectRoot, HX_CONFIG_FILE)) || existsSync(resolve(projectRoot, HX_WORKSPACE_FILE))
}

function filterSourcePaths(projectRoot: string, paths: string[]): string[] {
  const src = readPathsConfig(projectRoot).src ?? 'src'
  const srcRoot = resolve(projectRoot, src)
  return paths
    .map((path) => resolve(projectRoot, path))
    .filter((path) => isInside(path, srcRoot))
    .map((path) => relativePath(projectRoot, path))
}

function resolveFeature(
  projectRoot: string,
  explicitFeature: string | undefined,
  strict: boolean,
  errors: string[],
  next: string[],
): string | null {
  if (explicitFeature) return explicitFeature

  const candidates = scanActiveFeatureCandidates(projectRoot)
  if (candidates.length === 0) {
    if (strict) {
      errors.push('没有找到可对应当前上下文的 feature 文档组，不能判断当前源码变更属于哪个 hxflow feature')
      next.push('先执行 hx doc <feature> 和 hx plan <feature>，或传入 --feature <feature>')
    }
    return null
  }

  if (candidates.length > 1) {
    errors.push(`存在多个活跃 feature：${candidates.map((item) => item.feature).join(', ')}，不能静默选择`)
    next.push('传入 --feature <feature>')
    return null
  }

  return candidates[0].feature
}

function scanActiveFeatureCandidates(projectRoot: string): FeatureCandidate[] {
  const plansDir = resolve(projectRoot, 'docs', 'plans')
  if (!existsSync(plansDir)) return []

  return readdirSync(plansDir)
    .filter((file) => file.endsWith('-progress.json'))
    .map((file) => resolve(plansDir, file))
    .map((progressFile) => {
      try {
        const { data } = loadValidatedProgressFile(progressFile)
        if (data.completedAt !== null) return null
        if (!hasCompleteFeatureArtifactGroup(projectRoot, data)) return null
        return { feature: data.feature, progressFile, data }
      } catch {
        return null
      }
    })
    .filter((item): item is FeatureCandidate => item !== null)
}

function hasCompleteFeatureArtifactGroup(projectRoot: string, progress: ProgressData): boolean {
  const featureRoot = resolveFeatureArtifactRoot(projectRoot, progress.feature)
  const artifactPaths = getFeatureArtifactPaths(featureRoot, progress.feature)
  return progress.requirementDoc === relativePath(featureRoot, artifactPaths.requirementDoc)
    && progress.planDoc === relativePath(featureRoot, artifactPaths.planDoc)
    && existsSync(artifactPaths.requirementDoc)
    && existsSync(artifactPaths.planDoc)
}

function resolveAllowedTasks(progress: ProgressData, taskId: string | undefined, errors: string[]): ProgressTask[] {
  const recoverable = getRecoverableTasks(progress)
  const runnable = getRunnableTasks(progress)
  const allowed = [...recoverable, ...runnable]

  if (!taskId) return allowed

  const task = progress.tasks.find((item) => item.id === taskId)
  if (!task) {
    errors.push(`task "${taskId}" 不存在于 progressFile`)
    return []
  }

  if (!allowed.some((item) => item.id === taskId)) {
    errors.push(`task "${taskId}" 当前不可执行：依赖未完成、已完成或状态非法`)
    return []
  }

  return [task]
}

function validateSourcePathScope(
  projectRoot: string,
  feature: string,
  progress: ProgressData,
  tasks: ProgressTask[],
  sourcePaths: string[],
): string[] {
  const scopePatterns = tasks.flatMap((task) => {
    const context = buildTaskContext({
      feature,
      projectRoot,
      progressData: progress,
      taskId: task.id,
      mode: task.status === 'in-progress' ? 'recover' : 'run',
    })
    return context.doneCriteria.scope
  })

  if (scopePatterns.length === 0) return []

  return sourcePaths
    .filter((path) => !scopePatterns.some((scope) => matchesScope(path, scope)))
    .map((path) => `源码路径不在当前可执行任务修改范围内：${path}`)
}

function matchesScope(path: string, scope: string): boolean {
  const normalizedPath = normalizePath(path)
  const normalizedScope = normalizePath(scope)
  if (!normalizedScope) return false
  if (normalizedScope.endsWith('/')) return normalizedPath.startsWith(normalizedScope)
  return normalizedPath === normalizedScope || normalizedPath.startsWith(`${normalizedScope}/`)
}

function isInside(path: string, root: string): boolean {
  const rel = relative(root, path)
  return rel === '' || (!rel.startsWith('..') && !rel.startsWith(sep))
}

function normalizePath(path: string): string {
  return path.replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/+$/, '')
}

function relativePath(projectRoot: string, path: string): string {
  const rel = relative(projectRoot, path)
  return rel ? normalizePath(rel) : basename(path)
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

function buildResult(
  projectRoot: string,
  feature: string | null,
  sourcePaths: string[],
  allowedTasks: Array<{ id: string; name: string; status: string }>,
  errors: string[],
  next: string[],
  applies: boolean,
): WriteGuardResult {
  return {
    ok: errors.length === 0,
    applies,
    projectRoot,
    feature,
    sourcePaths,
    allowedTasks,
    errors,
    next,
  }
}
