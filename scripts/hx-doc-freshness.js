#!/usr/bin/env node
// scripts/hx-doc-freshness.js
// 检查 docs/requirement/ 中的文档是否比它引用的源码更旧

import { readFileSync, readdirSync, existsSync } from 'fs'
import { resolve } from 'path'
import { execSync } from 'child_process'

import { resolveContext } from './lib/resolve-context.js'

const ctx = resolveContext()
const ROOT = ctx.projectRoot

function getGitMtime(filePath) {
  try {
    const ts = execSync(
      `git log -1 --format=%ct -- "${filePath}" 2>/dev/null`,
      { cwd: ROOT, encoding: 'utf8' }
    ).trim()
    return ts ? parseInt(ts, 10) : 0
  } catch {
    return 0
  }
}

function isGitRepo() {
  try {
    execSync('git rev-parse --git-dir', { cwd: ROOT, stdio: 'ignore' })
    return true
  } catch { return false }
}

// ── 检查是否在 Git 仓库中 ─────────────────────────────────────
if (!isGitRepo()) {
  console.log('ℹ  未检测到 Git 仓库，跳过文档新鲜度检查')
  console.log('   提示：初始化 Git 仓库后可使用此功能')
  process.exit(0)
}

// ── 读取 docs/requirement/ 下所有 Markdown 文档 ────────────────
const designDir = ctx.requirementDir
if (!existsSync(designDir)) {
  console.log('ℹ  需求文档目录不存在，暂无文档需要检查')
  process.exit(0)
}

const docFiles = readdirSync(designDir)
  .filter(f => f.endsWith('.md'))
  .map(f => resolve(designDir, f))

if (docFiles.length === 0) {
  console.log('✓ 需求文档目录中暂无文档')
  process.exit(0)
}

// ── 从文档内容中提取 src/ 引用 ────────────────────────────────
function extractSrcRefs(content) {
  const refs = new Set()
  const patterns = [
    /`(src\/[^`\s]+\.[a-z]+)`/g,
    /\[(.*?)\]\((src\/[^)]+)\)/g,
    /→\s*(src\/[\w/\-.]+)/g
  ]
  for (const p of patterns) {
    let m
    while ((m = p.exec(content)) !== null) {
      const ref = m[2] || m[1]
      if (ref && ref.startsWith('src/')) refs.add(ref)
    }
  }
  return [...refs]
}

// ── 检查每个文档 ──────────────────────────────────────────────
const stale = []
const fresh = []

for (const docPath of docFiles) {
  const relDocPath = docPath.replace(ROOT + '/', '')
  const docMtime = getGitMtime(relDocPath)
  const content = readFileSync(docPath, 'utf8')
  const refs = extractSrcRefs(content)

  for (const ref of refs) {
    const fullRefPath = resolve(ROOT, ref)
    if (!existsSync(fullRefPath)) continue  // 文件不存在，跳过

    const srcMtime = getGitMtime(ref)
    if (srcMtime > docMtime && srcMtime > 0 && docMtime > 0) {
      stale.push({
        doc: relDocPath,
        src: ref,
        docDate: docMtime ? new Date(docMtime * 1000).toLocaleDateString('zh-CN') : '未知',
        srcDate: srcMtime ? new Date(srcMtime * 1000).toLocaleDateString('zh-CN') : '未知'
      })
    }
  }

  if (!refs.length) {
    // 无引用的文档，只检查文档自身是否超过 90 天未更新
    const age = Date.now() / 1000 - docMtime
    if (age > 90 * 24 * 3600 && docMtime > 0) {
      stale.push({
        doc: relDocPath,
        src: '（文档本身）',
        docDate: new Date(docMtime * 1000).toLocaleDateString('zh-CN'),
        srcDate: '超过 90 天未更新'
      })
    } else {
      fresh.push(relDocPath)
    }
  } else {
    fresh.push(relDocPath)
  }
}

// ── 输出结果 ──────────────────────────────────────────────────
if (stale.length === 0) {
  console.log(`✓ 文档新鲜度检查通过（检查 ${docFiles.length} 个文档）`)
  process.exit(0)
}

console.log(`\n⚠  发现 ${stale.length} 个可能过期的文档：\n`)
for (const { doc, src, docDate, srcDate } of stale) {
  console.log(`  文档: ${doc}（最后更新: ${docDate}）`)
  console.log(`  源码: ${src}（最后更新: ${srcDate}）`)
  console.log()
}

console.log('建议操作：')
console.log('  1. 对比代码变更，手动更新以上文档')
console.log('  2. 或运行 hx:run -- <feature> <task-id> --profile <team> 让 Agent 读取代码后更新文档')
console.log('\n文档与代码不一致会导致 Agent 下次执行时产生偏差。')
