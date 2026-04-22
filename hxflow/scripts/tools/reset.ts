/**
 * hx-reset.ts — 重置 feature 的需求/计划/代码产物
 *
 * 用法：
 *   hx reset <feature>         # 重置 code + doc + plan
 *   hx reset <feature> plan    # 只重置计划产物
 *   hx reset <feature> doc     # 重置需求文档及其下游计划产物
 *   hx reset <feature> code    # 回退代码改动并保留 doc + plan
 *
 * 输出 JSON 到 stdout，失败时 exit 1。
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'fs'
import { dirname, relative, sep } from 'path'

import { getFeatureArtifactExistence, getFeatureArtifactPaths, resolveFeatureArtifactRoot } from '../lib/file-paths.ts'
import { runGit, runGitCommand, splitLines } from '../lib/git-utils.ts'
import { exitWithJsonError as err, printJson as out } from '../lib/json-cli.ts'
import { resetExecutionState } from '../lib/progress-ops.ts'
import { createSimpleContext } from '../lib/tool-cli.ts'

const { positional, projectRoot: initialProjectRoot } = createSimpleContext()
const [feature, rawTarget] = positional

if (!feature) {
  err('用法：hx reset <feature> [plan|doc|code]')
}

if (rawTarget && rawTarget !== 'plan' && rawTarget !== 'doc' && rawTarget !== 'code') {
  err(`未知重置目标 "${rawTarget}"，可用：plan / doc / code`)
}

const target = rawTarget ?? 'all'
const projectRoot = resolveFeatureArtifactRoot(initialProjectRoot, feature)
const paths = getFeatureArtifactPaths(projectRoot, feature)
const existence = getFeatureArtifactExistence(paths)

const removed: string[] = []
const missing: string[] = []
const restored: string[] = []
const updated: string[] = []

interface PreservedArtifact {
  path: string
  content: string
}

function toProjectPath(filePath: string) {
  const relativePath = relative(projectRoot, filePath)
  return relativePath === '' ? '.' : relativePath.split(sep).join('/')
}

function removeFile(path: string, present: boolean) {
  if (!present) {
    missing.push(toProjectPath(path))
    return
  }

  rmSync(path, { force: true })
  removed.push(toProjectPath(path))
}

function removeArchiveDirIfEmpty() {
  if (existsSync(paths.archiveDir) && readdirSync(paths.archiveDir).length === 0) {
    rmSync(paths.archiveDir, { recursive: true, force: true })
    removed.push(toProjectPath(paths.archiveDir))
  }
}

function restoreArchivedArtifact(activePath: string, archivedPath: string) {
  if (existsSync(activePath) || !existsSync(archivedPath)) {
    return
  }

  mkdirSync(dirname(activePath), { recursive: true })
  renameSync(archivedPath, activePath)
  restored.push(toProjectPath(activePath))
}

function readPreservedArtifact(activePath: string, archivedPath?: string): PreservedArtifact | null {
  if (existsSync(activePath)) {
    return { path: activePath, content: readFileSync(activePath, 'utf8') }
  }

  if (archivedPath && existsSync(archivedPath)) {
    return { path: activePath, content: readFileSync(archivedPath, 'utf8') }
  }

  return null
}

function writePreservedArtifact(path: string, content: string) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content, 'utf8')
  if (!restored.includes(toProjectPath(path))) {
    restored.push(toProjectPath(path))
  }
}

function ensureGitRepository() {
  const insideWorkTree = runGit(projectRoot, 'rev-parse', '--is-inside-work-tree')
  if (insideWorkTree !== 'true') {
    err('code 重置失败：当前项目不是 git 仓库')
  }
}

function resolveCodeResetTarget(requirementPath: string) {
  const creationLog = runGit(projectRoot, 'log', '--diff-filter=A', '--format=%H', '--reverse', '--', requirementPath)
  const creationCommit = splitLines(creationLog ?? '')[0]

  if (!creationCommit) {
    err(`code 重置失败：未找到 ${requirementPath} 的创建提交`)
  }

  const parentOfCreation = runGit(projectRoot, 'rev-parse', `${creationCommit}^`)
  if (!parentOfCreation) {
    err(`code 重置失败：${requirementPath} 的创建提交没有父提交，无法安全回退`)
  }

  const upstream = runGit(projectRoot, 'rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}')
  if (!upstream) {
    return { resetTo: parentOfCreation, upstream: null }
  }

  const mergeBase = runGit(projectRoot, 'merge-base', 'HEAD', upstream)
  if (!mergeBase) {
    err(`code 重置失败：无法计算当前分支与 ${upstream} 的 merge-base`)
  }

  const parentBeforeUpstream = runGitCommand(projectRoot, 'merge-base', '--is-ancestor', parentOfCreation, mergeBase)
  if (parentBeforeUpstream.ok) {
    return { resetTo: mergeBase, upstream }
  }

  const upstreamBeforeParent = runGitCommand(projectRoot, 'merge-base', '--is-ancestor', mergeBase, parentOfCreation)
  if (upstreamBeforeParent.ok) {
    return { resetTo: parentOfCreation, upstream }
  }

  err(`code 重置失败：无法确定 requirement 创建点与 ${upstream} 的先后关系`)
}

function resetCodeChanges(featureName: string) {
  ensureGitRepository()

  const requirementRelativePath = `docs/requirement/${featureName}.md`
  const requirementDoc = readPreservedArtifact(paths.requirementDoc)
  if (!requirementDoc) {
    err(`requirementDoc 不存在：${paths.requirementDoc}，请先运行 hx doc ${featureName}`)
  }

  const planDoc = readPreservedArtifact(paths.planDoc, paths.archivedPlanDoc)
  if (!planDoc) {
    err(`planDoc 不存在：${paths.planDoc}，请先运行 hx plan ${featureName}`)
  }

  const progressFile = readPreservedArtifact(paths.progressFile, paths.archivedProgressFile)
  if (!progressFile) {
    err(`progressFile 不存在：${paths.progressFile}，请先运行 hx plan ${featureName}`)
  }

  const untrackedBefore = splitLines(runGit(projectRoot, 'ls-files', '--others', '--exclude-standard') ?? '')
  const { resetTo, upstream } = resolveCodeResetTarget(requirementRelativePath)
  const resetResult = runGitCommand(projectRoot, 'reset', '--hard', resetTo)
  if (!resetResult.ok) {
    err(`code 重置失败：git reset --hard ${resetTo} 执行失败${resetResult.stderr ? `: ${resetResult.stderr}` : ''}`)
  }

  const cleanResult = runGitCommand(projectRoot, 'clean', '-fd')
  if (!cleanResult.ok) {
    err(`code 重置失败：git clean -fd 执行失败${cleanResult.stderr ? `: ${cleanResult.stderr}` : ''}`)
  }

  writePreservedArtifact(paths.requirementDoc, requirementDoc.content)
  writePreservedArtifact(paths.planDoc, planDoc.content)
  writePreservedArtifact(paths.progressFile, progressFile.content)

  try {
    resetExecutionState(paths.progressFile)
  } catch (error) {
    err(error instanceof Error ? error.message : String(error))
  }

  updated.push(toProjectPath(paths.progressFile))

  return {
    resetTo,
    upstream,
    cleaned: untrackedBefore.map((filePath) => filePath.split(sep).join('/')),
  }
}

let codeReset: { resetTo: string; upstream: string | null; cleaned: string[] } | null = null

if (target === 'all' || target === 'code') {
  codeReset = resetCodeChanges(feature)
}

if (target === 'all' || target === 'doc') {
  removeFile(paths.requirementDoc, existence.requirementDoc)
}

if (target === 'all' || target === 'plan' || target === 'doc') {
  removeFile(paths.planDoc, existence.planDoc)
  removeFile(paths.progressFile, existence.progressFile)
  removeFile(paths.archivedPlanDoc, existence.archivedPlanDoc)
  removeFile(paths.archivedProgressFile, existence.archivedProgressFile)
}

removeArchiveDirIfEmpty()

out({
  ok: true,
  feature,
  target,
  removed,
  missing,
  restored,
  updated,
  codeReset,
})
