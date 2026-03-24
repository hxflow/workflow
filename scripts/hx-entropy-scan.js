#!/usr/bin/env node
// scripts/hx-entropy-scan.js
// 扫描 src/ 目录，识别常见 AI Slop 模式，输出需人工确认的条目

import { readFileSync, readdirSync, statSync } from 'fs'
import { resolve, relative } from 'path'

import { resolveContext } from './lib/resolve-context.js'

const ctx = resolveContext()
const ROOT = ctx.projectRoot

// ── 扫描规则（每条对应一个黄金原则）─────────────────────────────
const PATTERNS = [
  {
    id: 'GP-001',
    name: 'console.log 未清理',
    regex: /console\.(log|warn|error|debug|info)\s*\(/g,
    severity: '🔴',
    fix: '使用结构化 logger，参考 docs/golden-principles.md GP-001'
  },
  {
    id: 'GP-003',
    name: '裸 Error 抛出',
    regex: /throw\s+new\s+Error\s*\(/g,
    severity: '🔴',
    fix: '改用 AppError 类，参考 GP-003'
  },
  {
    id: 'TYPE-001',
    name: 'any 类型泄漏',
    regex: /:\s*any\b/g,
    severity: '🔴',
    fix: '替换为具体类型或 unknown'
  },
  {
    id: 'TYPE-002',
    name: '强制类型断言',
    regex: /\bas\s+[A-Z][A-Za-z]+\b(?!\s*[,;{])/g,
    severity: '🟡',
    fix: '避免 as 断言，优先使用类型守卫'
  },
  {
    id: 'ARCH-001',
    name: '空 catch 块',
    regex: /catch\s*\([^)]*\)\s*\{\s*\}/g,
    severity: '🔴',
    fix: '所有 catch 必须有明确处理逻辑或重新抛出'
  },
  {
    id: 'ARCH-002',
    name: 'catch 吞掉错误',
    regex: /catch\s*\([^)]*\)\s*\{\s*\/\//g,
    severity: '🟡',
    fix: '确认 catch 中的注释是否描述了合理的忽略原因'
  },
  {
    id: 'QUAL-001',
    name: 'TODO / FIXME 未处理',
    regex: /\/\/\s*(TODO|FIXME|HACK|XXX)\b/g,
    severity: '🟡',
    fix: '处理或创建对应 Issue，不要长期留在代码中'
  },
  {
    id: 'QUAL-002',
    name: '魔法数字',
    regex: /(?<!['"#])\b(?!0\b|1\b|2\b|100\b|200\b|201\b|400\b|401\b|403\b|404\b|500\b)\d{2,}\b(?![px%ms"'])/g,
    severity: '🟡',
    fix: '提取到 src/config/ 中的常量，参考 GP-007'
  },
  {
    id: 'QUAL-003',
    name: 'Promise 未处理',
    regex: /(?<!\bawait\s)(?<!\breturn\s)\bnew Promise\b/g,
    severity: '🟡',
    fix: '确认 Promise 是否有 .catch() 或 await 处理'
  }
]

// ── 收集 src/ 下所有 TS 文件（排除测试文件）─────────────────────
function collectFiles(dir) {
  const files = []
  try {
    for (const entry of readdirSync(resolve(ROOT, dir))) {
      const fullPath = resolve(ROOT, dir, entry)
      const stat = statSync(fullPath)
      if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules') {
        files.push(...collectFiles(`${dir}/${entry}`))
      } else if (
        (entry.endsWith('.ts') || entry.endsWith('.tsx')) &&
        !entry.endsWith('.test.ts') &&
        !entry.endsWith('.test.tsx') &&
        !entry.endsWith('.spec.ts') &&
        !entry.endsWith('.d.ts')
      ) {
        files.push(resolve(ROOT, dir, entry))
      }
    }
  } catch { /* skip */ }
  return files
}

const srcFiles = collectFiles('src')

if (srcFiles.length === 0) {
  console.log('ℹ  src/ 目录为空，无需扫描')
  process.exit(0)
}

// ── 扫描每个文件 ───────────────────────────────────────────────
const results = {}
let totalHits = 0

for (const filePath of srcFiles) {
  let content
  try { content = readFileSync(filePath, 'utf8') } catch { continue }

  const lines = content.split('\n')
  const relPath = relative(ROOT, filePath)

  for (const pattern of PATTERNS) {
    const matches = []
    let match
    pattern.regex.lastIndex = 0

    while ((match = pattern.regex.exec(content)) !== null) {
      // 找到行号
      const lineNum = content.substring(0, match.index).split('\n').length
      const lineContent = lines[lineNum - 1]?.trim().substring(0, 80)
      matches.push({ line: lineNum, text: lineContent })
    }

    if (matches.length > 0) {
      const key = `${pattern.severity} [${pattern.id}] ${pattern.name}`
      if (!results[key]) results[key] = []
      results[key].push({ file: relPath, matches, fix: pattern.fix })
      totalHits += matches.length
    }
  }
}

// ── 输出报告 ───────────────────────────────────────────────────
if (Object.keys(results).length === 0) {
  console.log(`✓ 熵扫描完成，未发现问题（扫描 ${srcFiles.length} 个文件）`)
  process.exit(0)
}

console.log(`\n熵扫描报告 — ${new Date().toLocaleDateString('zh-CN')}`)
console.log(`扫描文件数: ${srcFiles.length}，发现问题: ${totalHits} 处\n`)

for (const [key, fileResults] of Object.entries(results)) {
  console.log(key)
  console.log(`  修复建议: ${fileResults[0].fix}`)
  for (const { file, matches } of fileResults) {
    for (const { line, text } of matches) {
      console.log(`  ${file}:${line}  ${text}`)
    }
  }
  console.log()
}

console.log('─'.repeat(60))
console.log(`🔴 必须修复的问题请立即处理`)
console.log(`🟡 建议修复的问题可在下次清理 Sprint 中批量处理`)
console.log(`\n重复出现的模式应更新 docs/golden-principles.md 并添加 Lint 规则`)
