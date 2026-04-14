#!/usr/bin/env node

/**
 * hx-restore.js — 从 docs/archive/{feature}/ 还原 feature 产物
 *
 * 用法：
 *   hx restore <feature>
 *
 * 将 planDoc 和 progressFile 从归档路径还原至 docs/plans/。
 * 输出 JSON 到 stdout，失败时 exit 1。
 */

import { restoreFeature } from '../lib/file-paths.ts'
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
  err('用法：hx restore <feature>')
}

const projectRoot = findProjectRoot(getSafeCwd())

try {
  const result = restoreFeature(projectRoot, feature)
  out({ ok: true, feature, restored: result.restored })
} catch (error) {
  err(error.message)
}
