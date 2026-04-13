#!/usr/bin/env node

/**
 * hx-mr.ts — MR orchestrator
 *
 * 确定性工作：读取 requirement / progress / git 事实，校验完成态并执行归档。
 * AI 工作：生成 MR 标题和描述。
 */

import { existsSync, readFileSync } from 'fs'
import { spawnSync } from 'child_process'
import { resolve } from 'path'

import { parseArgs } from './lib/config-utils.ts'
import { findProjectRoot, getSafeCwd } from './lib/resolve-context.ts'
import {
  archiveFeature,
  getRequirementDocPath,
  getActivePlanDocPath,
  getActiveProgressFilePath,
  getArchiveDirPath,
} from './lib/file-paths.ts'
import { parseFeatureHeaderFile } from './lib/feature-header.ts'

const argv = process.argv.slice(2)
const { positional, options } = parseArgs(argv)
const [feature] = positional
const targetBranch = options.target ?? null
const project = options.project ?? null

if (!feature) {
  console.error('用法: hx mr <feature> [--target <branch>] [--project <group/repo>]')
  process.exit(1)
}

const projectRoot = findProjectRoot(getSafeCwd())

// 1. 定位需求文档
const requirementDoc = getRequirementDocPath(projectRoot, feature)
if (!existsSync(requirementDoc)) {
  console.error(`❌ 需求文档不存在: ${requirementDoc}`)
  process.exit(1)
}

// 2. 解析 feature 头部
let parsedHeader
try {
  parsedHeader = parseFeatureHeaderFile(requirementDoc)
} catch (err) {
  console.error(`❌ 需求文档头部解析失败: ${err.message}`)
  process.exit(1)
}

// 3. 定位 progressFile（活跃或归档）
const activeProgressFile = getActiveProgressFilePath(projectRoot, feature)
const archiveDir = getArchiveDirPath(projectRoot, feature)
const archivedProgressFile = resolve(archiveDir, `${feature}-progress.json`)

let progressFile = null
if (existsSync(activeProgressFile)) {
  progressFile = activeProgressFile
} else if (existsSync(archivedProgressFile)) {
  progressFile = archivedProgressFile
}

if (!progressFile) {
  console.error(`❌ progressFile 不存在（活跃或归档均未找到）`)
  console.error(`   请先运行 hx run ${feature} 完成所有任务`)
  process.exit(1)
}

// 4. 收集进度摘要
let progressSummary = '（无法读取）'
let allDone = false
let doneCount = 0
let totalCount = 0
let pendingIds: string[] = []
let taskSummaries: Array<{ id: string; name: string; output: string }> = []
try {
  const data = JSON.parse(readFileSync(progressFile, 'utf8'))
  const tasks = data.tasks ?? []
  totalCount = tasks.length
  allDone = tasks.length > 0 && tasks.every((t) => t.status === 'done')
  doneCount = tasks.filter((t) => t.status === 'done').length
  progressSummary = `${doneCount}/${tasks.length} 个任务完成`
  pendingIds = tasks.filter((t) => t.status !== 'done').map((t) => t.id)
  taskSummaries = tasks.map((task) => ({
    id: task.id,
    name: task.name,
    output: task.output,
  }))
} catch {
  console.log(JSON.stringify({
    ok: false,
    feature,
    progressFile,
    progressSummary,
    currentBranch: '（无法获取）',
    targetBranch: targetBranch ?? 'main',
    mr: null,
    archive: { performed: false, archived: [] },
    nextAction: `hx run ${feature}`,
    reason: `无法解析 progressFile: ${progressFile}`,
  }))
  process.exit(1)
}

if (!allDone) {
  console.log(JSON.stringify({
    ok: false,
    feature,
    progressFile,
    progressSummary,
    currentBranch: '（尚未执行）',
    targetBranch: targetBranch ?? 'main',
    mr: null,
    archive: { performed: false, archived: [] },
    nextAction: `hx run ${feature}`,
    reason: `存在未完成任务: ${pendingIds.join(', ')}`,
  }))
  process.exit(1)
}

// 5. 收集 git 事实
function runGit(...gitArgs) {
  const result = spawnSync('git', gitArgs, { cwd: projectRoot, encoding: 'utf8' })
  return result.status === 0 ? result.stdout.trim() : null
}

const defaultBranch =
  targetBranch ??
  runGit('symbolic-ref', '--short', 'refs/remotes/origin/HEAD')?.replace('origin/', '') ??
  'main'
const currentBranch = runGit('rev-parse', '--abbrev-ref', 'HEAD') ?? '（无法获取）'
const gitLog = runGit('log', `${defaultBranch}..HEAD`, '--oneline') ?? '（无法获取）'
const gitDiffStat = runGit('diff', `${defaultBranch}...HEAD`, '--stat') ?? '（无法获取）'

// 6. planDoc 路径
const planDoc = existsSync(getActivePlanDocPath(projectRoot, feature))
  ? getActivePlanDocPath(projectRoot, feature)
  : resolve(archiveDir, `${feature}.md`)

// ── 收集所有上下文，供 AI 生成 MR 标题和描述 ──────────────────────────────────
const alreadyArchived = !existsSync(activeProgressFile) && existsSync(archivedProgressFile)
const archived = alreadyArchived ? [] : archiveFeature(projectRoot, feature).archived

console.log(JSON.stringify({
  ok: true,
  actionRequired: true,
  feature,
  progressFile,
  progressSummary,
  currentBranch,
  targetBranch: defaultBranch,
  archive: {
    performed: !alreadyArchived,
    archived,
  },
  context: {
    feature: parsedHeader.feature,
    displayName: parsedHeader.displayName,
    sourceId: parsedHeader.sourceId,
    sourceFingerprint: parsedHeader.sourceFingerprint,
    project,
    requirementDoc,
    planDoc,
    progressFile,
    requirementSummary: summarizeRequirement(readFileSync(requirementDoc, 'utf8')),
    progress: {
      doneCount,
      totalCount,
      tasks: taskSummaries,
    },
    git: {
      currentBranch,
      targetBranch: defaultBranch,
      log: gitLog || '',
      diffStat: gitDiffStat || '',
    },
  },
  nextAction: `hx mr ${feature}`,
}, null, 2))

function summarizeRequirement(content: string): string {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('>') && !line.startsWith('#'))
    .slice(0, 8)
    .join('\n')
}
