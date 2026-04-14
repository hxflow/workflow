#!/usr/bin/env node

/**
 * hx-feature.ts — 需求文档事实工具
 *
 * 用法：
 *   hx feature parse <requirementDoc>      解析需求文档头部
 *   hx feature inspect <feature>           feature 完整状态事实
 *
 * 所有子命令输出 JSON 到 stdout，失败时 exit 1。
 */

import { resolve } from 'path'
import { existsSync, readFileSync } from 'fs'
import { parseFeatureHeaderFile } from '../lib/feature-header.ts'
import { findProjectRoot, getSafeCwd } from '../lib/resolve-context.ts'
import {
  getRequirementDocPath,
  getActivePlanDocPath,
  getActiveProgressFilePath,
  getArchiveDirPath,
} from '../lib/file-paths.ts'
import { getPipelineState } from '../lib/pipeline-state.ts'

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
  case 'parse': {
    const [rawPath] = rest
    if (!rawPath) err('用法：hx feature parse <requirementDoc>')

    try {
      const filePath = resolve(getSafeCwd(), rawPath)
      const header = parseFeatureHeaderFile(filePath)
      out({ ok: true, ...header })
    } catch (error) {
      err(error instanceof Error ? error.message : String(error))
    }
    break
  }

  case 'inspect': {
    const [feature] = rest
    if (!feature) err('用法：hx feature inspect <feature>')

    const requirementDoc = getRequirementDocPath(projectRoot, feature)
    const planDoc = getActivePlanDocPath(projectRoot, feature)
    const progressFile = getActiveProgressFilePath(projectRoot, feature)
    const archiveDir = getArchiveDirPath(projectRoot, feature)

    let header = null
    let headerError = null
    if (existsSync(requirementDoc)) {
      try {
        header = parseFeatureHeaderFile(requirementDoc)
      } catch (error) {
        headerError = error instanceof Error ? error.message : String(error)
      }
    }

    const pipelineState = getPipelineState(projectRoot, feature)

    out({
      ok: true,
      feature,
      header,
      headerError,
      paths: {
        requirementDoc,
        planDoc,
        progressFile,
        archiveDir,
      },
      exists: {
        requirementDoc: existsSync(requirementDoc),
        planDoc: existsSync(planDoc),
        progressFile: existsSync(progressFile),
        archiveDir: existsSync(archiveDir),
      },
      pipeline: pipelineState.map((s) => ({ id: s.id, status: s.status })),
    })
    break
  }

  default:
    err(`未知子命令 "${sub ?? ''}"，可用：parse / inspect`)
}
