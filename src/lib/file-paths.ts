/**
 * file-paths.js — 需求产物路径计算与 archive/restore 操作
 *
 * 把各命令中散落的路径约定和 archive/restore 逻辑固化为代码。
 * 所有路径规则来自 progress-contract 和 feature-contract。
 */

import { existsSync, mkdirSync, renameSync } from 'fs'
import { basename, resolve } from 'path'

// ── 路径计算 ────────────────────────────────────────────────

/**
 * 活跃 progressFile 路径：docs/plans/{feature}-progress.json
 */
export function getActiveProgressFilePath(projectRoot, feature) {
  return resolve(projectRoot, 'docs', 'plans', `${feature}-progress.json`)
}

/**
 * 活跃 planDoc 路径：docs/plans/{feature}.md
 */
export function getActivePlanDocPath(projectRoot, feature) {
  return resolve(projectRoot, 'docs', 'plans', `${feature}.md`)
}

/**
 * requirementDoc 路径：docs/requirement/{feature}.md
 */
export function getRequirementDocPath(projectRoot, feature) {
  return resolve(projectRoot, 'docs', 'requirement', `${feature}.md`)
}

/**
 * 归档目录路径：docs/archive/{feature}/
 */
export function getArchiveDirPath(projectRoot, feature) {
  return resolve(projectRoot, 'docs', 'archive', feature)
}

// ── Archive / Restore ───────────────────────────────────────

/**
 * 将 planDoc 和 progressFile 从活跃路径移至归档路径。
 *
 * 规则（来自 progress-contract）：
 *   - 活跃路径：docs/plans/{feature}.md, docs/plans/{feature}-progress.json
 *   - 归档路径：docs/archive/{feature}/
 *   - 归档前不检查 progressFile 完整性（调用方负责）
 *
 * @param {string} projectRoot - 项目根目录绝对路径
 * @param {string} feature - feature 标识
 * @returns {{ archived: string[] }} 已归档的文件列表
 * @throws {Error} 源文件不存在或移动失败时抛出
 */
export function archiveFeature(projectRoot, feature) {
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
export function restoreFeature(projectRoot, feature) {
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
export function resolveProgressFile(projectRoot, feature) {
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
