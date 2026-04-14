#!/usr/bin/env node

/**
 * hx-pipeline.ts — 流水线事实工具
 *
 * 用法：
 *   hx pipeline inspect <feature>          流水线各阶段状态
 *
 * 所有子命令输出 JSON 到 stdout，失败时 exit 1。
 */

import { findProjectRoot, getSafeCwd } from '../lib/resolve-context.ts'
import {
  getPipelineState,
  resolvePipelineStartStep,
} from '../lib/pipeline-state.ts'
import {
  getRequirementDocPath,
  getActivePlanDocPath,
  getActiveProgressFilePath,
  getArchiveDirPath,
} from '../lib/file-paths.ts'
import { existsSync } from 'fs'

const args = process.argv.slice(2)
const [sub, ...rest] = args

function out(data: unknown) {
  console.log(JSON.stringify(data, null, 2))
}

function err(message: string): never {
  console.error(JSON.stringify({ ok: false, error: message }))
  process.exit(1)
}

const projectRoot = findProjectRoot(getSafeCwd())

switch (sub) {
  case 'inspect': {
    const [feature] = rest
    if (!feature) err('用法：hx pipeline inspect <feature>')

    const state = getPipelineState(projectRoot, feature)
    let startStep: string
    try {
      startStep = resolvePipelineStartStep(projectRoot, feature)
    } catch {
      startStep = 'doc'
    }

    const paths = {
      requirementDoc: getRequirementDocPath(projectRoot, feature),
      planDoc: getActivePlanDocPath(projectRoot, feature),
      progressFile: getActiveProgressFilePath(projectRoot, feature),
      archiveDir: getArchiveDirPath(projectRoot, feature),
    }

    const pathsExistence = {
      requirementDoc: existsSync(paths.requirementDoc),
      planDoc: existsSync(paths.planDoc),
      progressFile: existsSync(paths.progressFile),
      archiveDir: existsSync(paths.archiveDir),
    }

    out({
      ok: true,
      feature,
      startStep,
      steps: state.map((s) => ({
        id: s.id,
        name: s.name,
        command: s.command,
        status: s.status,
      })),
      paths,
      pathsExistence,
    })
    break
  }

  default:
    err(`未知子命令 "${sub ?? ''}"，可用：inspect`)
}
