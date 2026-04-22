/**
 * file-paths.js — 需求产物路径计算与 archive/restore 操作
 *
 * 把各命令中散落的路径约定和 archive/restore 逻辑固化为代码。
 * 所有路径规则以当前脚本实现和固定目录结构为准。
 */

import { existsSync, mkdirSync, readFileSync, renameSync } from 'fs'
import { basename, resolve } from 'path'

export interface WorkspaceProject {
  id: string
  path: string
  type: string
  root: string
}

// ── 路径计算 ────────────────────────────────────────────────

/**
 * 活跃 progressFile 路径：docs/plans/{feature}-progress.json
 */
export function getActiveProgressFilePath(projectRoot: string, feature: string) {
  return resolve(projectRoot, 'docs', 'plans', `${feature}-progress.json`)
}

/**
 * 活跃 planDoc 路径：docs/plans/{feature}.md
 */
export function getActivePlanDocPath(projectRoot: string, feature: string) {
  return resolve(projectRoot, 'docs', 'plans', `${feature}.md`)
}

/**
 * requirementDoc 路径：docs/requirement/{feature}.md
 */
export function getRequirementDocPath(projectRoot: string, feature: string) {
  return resolve(projectRoot, 'docs', 'requirement', `${feature}.md`)
}

/**
 * 归档目录路径：docs/archive/{feature}/
 */
export function getArchiveDirPath(projectRoot: string, feature: string) {
  return resolve(projectRoot, 'docs', 'archive', feature)
}

export function getFeatureArtifactPaths(projectRoot: string, feature: string) {
  const archiveDir = getArchiveDirPath(projectRoot, feature)

  return {
    requirementDoc: getRequirementDocPath(projectRoot, feature),
    planDoc: getActivePlanDocPath(projectRoot, feature),
    progressFile: getActiveProgressFilePath(projectRoot, feature),
    archiveDir,
    archivedPlanDoc: resolve(archiveDir, `${feature}.md`),
    archivedProgressFile: resolve(archiveDir, `${feature}-progress.json`),
  }
}

export function getFeatureArtifactExistence(paths: {
  requirementDoc: string
  planDoc: string
  progressFile: string
  archiveDir: string
  archivedPlanDoc: string
  archivedProgressFile: string
}) {
  return {
    requirementDoc: existsSync(paths.requirementDoc),
    planDoc: existsSync(paths.planDoc),
    progressFile: existsSync(paths.progressFile),
    archiveDir: existsSync(paths.archiveDir),
    archivedPlanDoc: existsSync(paths.archivedPlanDoc),
    archivedProgressFile: existsSync(paths.archivedProgressFile),
  }
}

// ── Workspace feature resolution ────────────────────────────

function getWorkspaceConfigPath(projectRoot: string) {
  return resolve(projectRoot, '.hx', 'workspace.yaml')
}

export function getWorkspaceProjectRoots(projectRoot: string): string[] {
  return getWorkspaceProjects(projectRoot).map((project) => project.root)
}

export function getWorkspaceProjects(projectRoot: string): WorkspaceProject[] {
  const workspaceConfig = getWorkspaceConfigPath(projectRoot)
  if (!existsSync(workspaceConfig)) return []

  const content = readFileSync(workspaceConfig, 'utf8')
  const projects: WorkspaceProject[] = []
  let currentProject: Partial<WorkspaceProject> | null = null
  let inProjects = false

  function flushProject() {
    if (!currentProject?.path) return
    const path = currentProject.path
    projects.push({
      id: currentProject.id ?? basename(path),
      path,
      type: currentProject.type ?? 'unknown',
      root: resolve(projectRoot, path),
    })
  }

  for (const rawLine of content.replaceAll('\r\n', '\n').split('\n')) {
    const trimmed = rawLine.trim()
    const indent = rawLine.length - rawLine.trimStart().length

    if (!trimmed || trimmed.startsWith('#')) continue

    if (indent === 0) {
      if (inProjects) flushProject()
      currentProject = null
      inProjects = trimmed === 'projects:'
      continue
    }

    if (!inProjects) continue

    if (trimmed.startsWith('- ')) {
      flushProject()
      currentProject = {}
      const inlineMatch = trimmed.match(/^-\s+(\w+):\s*(.+)$/)
      if (inlineMatch) currentProject[inlineMatch[1] as keyof WorkspaceProject] = normalizeWorkspaceScalar(inlineMatch[2])
      continue
    }

    const fieldMatch = trimmed.match(/^(\w+):\s*(.+)$/)
    if (!fieldMatch || !currentProject) continue
    currentProject[fieldMatch[1] as keyof WorkspaceProject] = normalizeWorkspaceScalar(fieldMatch[2])
  }

  if (inProjects) flushProject()

  const seen = new Set<string>()
  return projects.filter((project) => {
    if (seen.has(project.root)) return false
    seen.add(project.root)
    return true
  })
}

function normalizeWorkspaceScalar(rawValue: string): string {
  return rawValue.replace(/\s+#.*$/, '').trim().replace(/^['"]|['"]$/g, '')
}

export function getFeatureArtifactRoots(projectRoot: string, feature: string): string[] {
  if (existsSync(getWorkspaceConfigPath(projectRoot))) {
    const existence = getFeatureArtifactExistence(getFeatureArtifactPaths(projectRoot, feature))
    return Object.values(existence).some(Boolean) ? [projectRoot] : []
  }

  const candidates = getWorkspaceProjectRoots(projectRoot)
  if (!candidates.includes(projectRoot)) candidates.push(projectRoot)

  return candidates.filter((candidateRoot) => {
    const existence = getFeatureArtifactExistence(getFeatureArtifactPaths(candidateRoot, feature))
    return Object.values(existence).some(Boolean)
  })
}

export function resolveFeatureArtifactRoot(projectRoot: string, feature: string): string {
  if (existsSync(getWorkspaceConfigPath(projectRoot))) return projectRoot
  return getFeatureArtifactRoots(projectRoot, feature)[0] ?? projectRoot
}

// ── Archive / Restore ───────────────────────────────────────

/**
 * 将 planDoc 和 progressFile 从活跃路径移至归档路径。
 *
 * 固定规则：
 *   - 活跃路径：docs/plans/{feature}.md, docs/plans/{feature}-progress.json
 *   - 归档路径：docs/archive/{feature}/
 *   - 归档前不检查 progressFile 完整性（调用方负责）
 *
 * @param {string} projectRoot - 项目根目录绝对路径
 * @param {string} feature - feature 标识
 * @returns {{ archived: string[] }} 已归档的文件列表
 * @throws {Error} 源文件不存在或移动失败时抛出
 */
export function archiveFeature(projectRoot: string, feature: string) {
  const planDoc = getActivePlanDocPath(projectRoot, feature)
  const progressFile = getActiveProgressFilePath(projectRoot, feature)
  const archiveDir = getArchiveDirPath(projectRoot, feature)

  const candidates = [planDoc, progressFile].filter(existsSync)

  if (candidates.length === 0) {
    throw new Error(`归档失败：feature "${feature}" 的活跃产物文件均不存在`)
  }

  mkdirSync(archiveDir, { recursive: true })

  const archived = []
  for (const src of candidates) {
    const dest = resolve(archiveDir, basename(src))
    renameSync(src, dest)
    archived.push(dest)
  }

  return { archived }
}

/**
 * 将 planDoc 和 progressFile 从归档路径还原至活跃路径。
 *
 * @param {string} projectRoot - 项目根目录绝对路径
 * @param {string} feature - feature 标识
 * @returns {{ restored: string[] }} 已还原的文件列表
 * @throws {Error} 归档目录不存在或移动失败时抛出
 */
export function restoreFeature(projectRoot: string, feature: string) {
  const archiveDir = getArchiveDirPath(projectRoot, feature)

  if (!existsSync(archiveDir)) {
    throw new Error(`还原失败：归档目录不存在 "${archiveDir}"`)
  }

  const planDocArchived = resolve(archiveDir, `${feature}.md`)
  const progressFileArchived = resolve(archiveDir, `${feature}-progress.json`)

  const candidates = [planDocArchived, progressFileArchived].filter(existsSync)

  if (candidates.length === 0) {
    throw new Error(`还原失败：归档目录 "${archiveDir}" 中没有找到产物文件`)
  }

  const plansDir = resolve(projectRoot, 'docs', 'plans')
  mkdirSync(plansDir, { recursive: true })

  const restored = []
  for (const src of candidates) {
    const dest = resolve(plansDir, basename(src))
    renameSync(src, dest)
    restored.push(dest)
  }

  return { restored }
}

/**
 * 定位 progressFile，不存在时自动从 archive 还原。
 *
 * 逻辑（来自 hx-run.md 执行步骤 1）：
 *   1. 先查活跃路径
 *   2. 不存在时查 docs/archive/{feature}/，找到则还原再返回
 *   3. 还原后仍不存在则抛出错误
 *
 * @param {string} projectRoot
 * @param {string} feature
 * @returns {{ filePath: string, restored: boolean }}
 */
export function resolveProgressFile(projectRoot: string, feature: string) {
  const activePath = getActiveProgressFilePath(projectRoot, feature)

  if (existsSync(activePath)) {
    return { filePath: activePath, restored: false }
  }

  const archiveDir = getArchiveDirPath(projectRoot, feature)
  const archivedProgress = resolve(archiveDir, `${feature}-progress.json`)

  if (!existsSync(archivedProgress)) {
    throw new Error(
      `progressFile 不存在：活跃路径 "${activePath}" 和归档路径均未找到`
    )
  }

  restoreFeature(projectRoot, feature)

  return { filePath: activePath, restored: true }
}
