#!/usr/bin/env node

/**
 * hx-mr.ts — MR 事实工具
 *
 * 用法：
 *   hx mr context <feature> [--target <branch>] [--project <group/repo>]
 *       收集 MR 所需的事实（进度、git、需求摘要）
 *   hx mr archive <feature>
 *       归档 feature 产物到 archive 目录
 *
 * 所有子命令输出 JSON 到 stdout，失败时 exit 1。
 */

import { existsSync, readFileSync } from 'fs'
import { spawnSync } from 'child_process'
import { resolve } from 'path'

import { parseArgs } from '../lib/config-utils.ts'
import { findProjectRoot, getSafeCwd } from '../lib/resolve-context.ts'
import {
  archiveFeature,
  getRequirementDocPath,
  getActivePlanDocPath,
  getActiveProgressFilePath,
  getArchiveDirPath,
} from '../lib/file-paths.ts'
import { parseFeatureHeaderFile } from '../lib/feature-header.ts'

const argv = process.argv.slice(2)
const [sub, ...rest] = argv
const { positional, options } = parseArgs(rest)
const [feature] = positional

function out(data: unknown) {
  console.log(JSON.stringify(data, null, 2))
}

function err(message: string): never {
  console.error(JSON.stringify({ ok: false, error: message }))
  process.exit(1)
}

const projectRoot = findProjectRoot(getSafeCwd())

switch (sub) {
  case 'context': {
    if (!feature) err('用法：hx mr context <feature> [--target <branch>] [--project <group/repo>]')

    const targetBranch = options.target ?? null
    const project = options.project ?? null

    const requirementDoc = getRequirementDocPath(projectRoot, feature)
    if (!existsSync(requirementDoc)) err(`需求文档不存在: ${requirementDoc}`)

    let parsedHeader
    try {
      parsedHeader = parseFeatureHeaderFile(requirementDoc)
    } catch (error) {
      err(`需求文档头部解析失败: ${error instanceof Error ? error.message : String(error)}`)
    }

    const activeProgressFile = getActiveProgressFilePath(projectRoot, feature)
    const archiveDir = getArchiveDirPath(projectRoot, feature)
    const archivedProgressFile = resolve(archiveDir, `${feature}-progress.json`)

    let progressFile: string | null = null
    if (existsSync(activeProgressFile)) progressFile = activeProgressFile
    else if (existsSync(archivedProgressFile)) progressFile = archivedProgressFile

    if (!progressFile) err('progressFile 不存在（活跃或归档均未找到）')

    let allDone = false
    let doneCount = 0
    let totalCount = 0
    let pendingIds: string[] = []
    let taskSummaries: Array<{ id: string; name: string; output: string }> = []
    try {
      const data = JSON.parse(readFileSync(progressFile, 'utf8'))
      const tasks = data.tasks ?? []
      totalCount = tasks.length
      allDone = tasks.length > 0 && tasks.every((t: { status: string }) => t.status === 'done')
      doneCount = tasks.filter((t: { status: string }) => t.status === 'done').length
      pendingIds = tasks.filter((t: { status: string }) => t.status !== 'done').map((t: { id: string }) => t.id)
      taskSummaries = tasks.map((task: { id: string; name: string; output: string }) => ({
        id: task.id, name: task.name, output: task.output,
      }))
    } catch {
      err(`无法解析 progressFile: ${progressFile}`)
    }

    const defaultBranch = (typeof targetBranch === 'string' ? targetBranch : null)
      ?? runGit('symbolic-ref', '--short', 'refs/remotes/origin/HEAD')?.replace('origin/', '')
      ?? 'main'
    const currentBranch = runGit('rev-parse', '--abbrev-ref', 'HEAD') ?? '(unknown)'
    const gitLog = runGit('log', `${defaultBranch}..HEAD`, '--oneline') ?? ''
    const gitDiffStat = runGit('diff', `${defaultBranch}...HEAD`, '--stat') ?? ''

    const planDoc = existsSync(getActivePlanDocPath(projectRoot, feature))
      ? getActivePlanDocPath(projectRoot, feature)
      : resolve(archiveDir, `${feature}.md`)

    out({
      ok: true,
      feature: parsedHeader.feature,
      displayName: parsedHeader.displayName,
      sourceId: parsedHeader.sourceId,
      sourceFingerprint: parsedHeader.sourceFingerprint,
      project,
      allDone,
      pendingIds,
      requirementDoc,
      planDoc,
      progressFile,
      requirementSummary: summarizeRequirement(readFileSync(requirementDoc, 'utf8')),
      progress: { doneCount, totalCount, tasks: taskSummaries },
      git: { currentBranch, targetBranch: defaultBranch, log: gitLog, diffStat: gitDiffStat },
    })
    break
  }

  case 'archive': {
    if (!feature) err('用法：hx mr archive <feature>')

    const activeProgressFile = getActiveProgressFilePath(projectRoot, feature)
    const archiveDir = getArchiveDirPath(projectRoot, feature)
    const archivedProgressFile = resolve(archiveDir, `${feature}-progress.json`)
    const alreadyArchived = !existsSync(activeProgressFile) && existsSync(archivedProgressFile)

    if (alreadyArchived) {
      out({ ok: true, feature, performed: false, archived: [], reason: '已归档' })
      break
    }

    try {
      const result = archiveFeature(projectRoot, feature)
      out({ ok: true, feature, performed: true, archived: result.archived })
    } catch (error) {
      err(error instanceof Error ? error.message : String(error))
    }
    break
  }

  default:
    err(`未知子命令 "${sub ?? ''}"，可用：context / archive`)
}

function runGit(...gitArgs: string[]): string | null {
  const result = spawnSync('git', gitArgs, { cwd: projectRoot, encoding: 'utf8' })
  return result.status === 0 ? result.stdout.trim() : null
}

function summarizeRequirement(content: string): string {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('>') && !line.startsWith('#'))
    .slice(0, 8)
    .join('\n')
}
