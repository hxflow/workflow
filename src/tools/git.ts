#!/usr/bin/env node

/**
 * hx-git.ts — Git 事实工具
 *
 * 用法：
 *   hx git facts [--target <branch>]       当前仓库 git 状态事实
 *   hx git diff [--target <branch>]        diff 详情
 *
 * 所有子命令输出 JSON 到 stdout，失败时 exit 1。
 */

import { spawnSync } from 'child_process'
import { parseArgs } from '../lib/config-utils.ts'
import { findProjectRoot, getSafeCwd } from '../lib/resolve-context.ts'

const args = process.argv.slice(2)
const [sub, ...rest] = args
const { options } = parseArgs(rest)

function out(data: unknown) {
  console.log(JSON.stringify(data, null, 2))
}

function err(message: string): never {
  console.error(JSON.stringify({ ok: false, error: message }))
  process.exit(1)
}

const projectRoot = findProjectRoot(getSafeCwd())

function runGit(...gitArgs: string[]): string | null {
  const result = spawnSync('git', gitArgs, { cwd: projectRoot, encoding: 'utf8' })
  return result.status === 0 ? result.stdout.trim() : null
}

function getDefaultBranch(target: string | null): string {
  if (target) return target
  const remoteBranch = runGit('symbolic-ref', '--short', 'refs/remotes/origin/HEAD')
  return remoteBranch?.replace('origin/', '') ?? 'main'
}

switch (sub) {
  case 'facts': {
    const target = typeof options.target === 'string' ? options.target : null
    const defaultBranch = getDefaultBranch(target)
    const currentBranch = runGit('rev-parse', '--abbrev-ref', 'HEAD') ?? '(unknown)'
    const isClean = runGit('status', '--porcelain') === ''
    const diffStat = runGit('diff', '--stat', 'HEAD') ?? ''
    const stagedFiles = (runGit('diff', '--name-only', '--cached') ?? '').split('\n').filter(Boolean)
    const changedFiles = (runGit('diff', '--name-only', 'HEAD') ?? '').split('\n').filter(Boolean)
    const untrackedFiles = (runGit('ls-files', '--others', '--exclude-standard') ?? '').split('\n').filter(Boolean)
    const branchDiffStat = runGit('diff', `${defaultBranch}...HEAD`, '--stat') ?? ''
    const branchLog = runGit('log', `${defaultBranch}..HEAD`, '--oneline') ?? ''
    const commitCount = branchLog ? branchLog.split('\n').filter(Boolean).length : 0

    out({
      ok: true,
      currentBranch,
      defaultBranch,
      isClean,
      working: {
        diffStat,
        changedFiles,
        stagedFiles,
        untrackedFiles,
      },
      branch: {
        diffStat: branchDiffStat,
        log: branchLog,
        commitCount,
      },
    })
    break
  }

  case 'diff': {
    const target = typeof options.target === 'string' ? options.target : null
    const defaultBranch = getDefaultBranch(target)
    const diffContent = runGit('diff', `${defaultBranch}...HEAD`) ?? ''
    const diffStat = runGit('diff', `${defaultBranch}...HEAD`, '--stat') ?? ''
    const changedFiles = (runGit('diff', `${defaultBranch}...HEAD`, '--name-only') ?? '').split('\n').filter(Boolean)

    out({
      ok: true,
      defaultBranch,
      diffStat,
      changedFiles,
      diff: diffContent,
    })
    break
  }

  default:
    err(`未知子命令 "${sub ?? ''}"，可用：facts / diff`)
}
