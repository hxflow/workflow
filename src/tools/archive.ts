#!/usr/bin/env node

/**
 * hx-archive.js — 将 feature 产物归档到 docs/archive/{feature}/
 *
 * 用法：
 *   hx archive <feature>
 *
 * 归档前需由调用方（hx-mr）确认 progressFile 所有 task 均为 done。
 * 本脚本只负责文件移动，不做状态校验。
 *
 * 输出 JSON 到 stdout，失败时 exit 1。
 */

import { resolve } from 'path'
import { readProgressFile, validateProgressFile } from '../lib/progress-schema.ts'
import { archiveFeature, getActiveProgressFilePath } from '../lib/file-paths.ts'
import { findProjectRoot, getSafeCwd } from '../lib/resolve-context.ts'

const args = process.argv.slice(2)
const [feature] = args

function out(data) {
  console.log(JSON.stringify(data, null, 2))
}

function err(message) {
  console.error(JSON.stringify({ ok: false, error: message }))
  process.exit(1)
}

if (!feature) {
  err('用法：hx archive <feature>')
}

const projectRoot = findProjectRoot(getSafeCwd())

// 归档前确认 progressFile 中所有 task 均为 done
const progressFilePath = getActiveProgressFilePath(projectRoot, feature)
const validation = validateProgressFile(progressFilePath)

if (!validation.valid) {
  err(`progressFile 校验失败，无法归档：\n${validation.errors.join('\n')}`)
}

const data = validation.data
const unfinished = data.tasks.filter((t) => t.status !== 'done')

if (unfinished.length > 0) {
  const ids = unfinished.map((t) => t.id).join(', ')
  err(`归档失败：以下 task 尚未完成：${ids}`)
}

try {
  const result = archiveFeature(projectRoot, feature)
  out({ ok: true, feature, archived: result.archived })
} catch (error) {
  err(error.message)
}
