#!/usr/bin/env node
// scripts/hx-arch-test.js
// 用法: npm run hx:arch -- [--profile backend|frontend|mobile:ios]
// 根据 profile 的 architecture.layers 检查跨层导入

import { readFileSync, readdirSync, statSync } from 'fs'
import { dirname, relative, resolve } from 'path'
import { fileURLToPath } from 'url'

import { getDefaultProfile, loadProfile, parseArgs, profileUsage } from './lib/profile-utils.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { options } = parseArgs(process.argv.slice(2))
const profileName = typeof options.profile === 'string' ? options.profile : getDefaultProfile(ROOT)

let profile
try {
  profile = loadProfile(ROOT, profileName)
} catch (error) {
  console.error(`✗ ${error.message}`)
  console.error(`  可用 profile: ${profileUsage()}`)
  process.exit(1)
}

const layerEntries = profile.architecture.layers
  .map((layer) => ({
    ...layer,
    path: trimTrailingSlash(layer.path)
  }))
  .filter((layer) => typeof layer.path === 'string' && layer.path && !layer.path.includes('{'))

if (layerEntries.length === 0) {
  console.log(`ℹ  ${profile.profile} 没有可检查的架构路径，跳过`)
  process.exit(0)
}

const layerById = new Map(layerEntries.map((layer) => [layer.id, layer]))
const rules = layerEntries.map((layer) => {
  const allowed = new Set([layer.id, ...(layer.can_import || [])])
  const forbiddenLayers = layerEntries.filter((candidate) => !allowed.has(candidate.id))
  return {
    layer,
    forbids: forbiddenLayers
  }
})

let violationCount = 0
const reports = []
let checkedFiles = 0

for (const rule of rules) {
  const files = collectSourceFiles(rule.layer.path)
  checkedFiles += files.length

  for (const filePath of files) {
    const content = readFileSync(resolve(ROOT, filePath), 'utf8')
    const imports = extractImports(content)

    for (const importPath of imports) {
      const target = resolveImport(filePath, importPath)
      if (!target) {
        continue
      }

      const banned = rule.forbids.find((candidate) => pathMatchesLayer(target, candidate.path))
      if (!banned) {
        continue
      }

      reports.push({
        file: filePath,
        import: importPath,
        fromLayer: rule.layer.label,
        targetLayer: banned.label
      })
      violationCount += 1
    }
  }
}

if (violationCount > 0) {
  console.error(`\n✗ 架构合规检查失败（${profile.profile}）：发现 ${violationCount} 个违规\n`)
  for (const item of reports) {
    console.error(`  [${item.fromLayer}] ${item.file}`)
    console.error(`    导入了: ${item.import}`)
    console.error(`    违规目标层: ${item.targetLayer}\n`)
  }
  process.exit(1)
}

console.log(`✓ 架构合规检查通过（${profile.profile}，检查 ${checkedFiles} 个文件）`)

function collectSourceFiles(layerPath) {
  const files = []
  const absoluteDir = resolve(ROOT, layerPath)

  try {
    for (const entry of readdirSync(absoluteDir)) {
      const fullPath = resolve(absoluteDir, entry)
      const stats = statSync(fullPath)
      if (stats.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules') {
        const childPath = relative(ROOT, fullPath)
        files.push(...collectSourceFiles(childPath))
        continue
      }

      if (!/\.(ts|tsx|js|jsx)$/.test(entry)) {
        continue
      }

      if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(entry) || entry.endsWith('.d.ts')) {
        continue
      }

      files.push(relative(ROOT, fullPath))
    }
  } catch {
    return files
  }

  return files
}

function extractImports(content) {
  const imports = []
  const patterns = [
    /from\s+['"]([^'"]+)['"]/g,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  ]

  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(content)) !== null) {
      imports.push(match[1])
    }
  }

  return imports
}

function resolveImport(filePath, importPath) {
  if (importPath.startsWith('@/')) {
    return normalisePath(`src/${importPath.slice(2)}`)
  }

  if (importPath.startsWith('src/')) {
    return normalisePath(importPath)
  }

  if (importPath.startsWith('.')) {
    return normalisePath(relative(ROOT, resolve(ROOT, dirname(filePath), importPath)))
  }

  return null
}

function pathMatchesLayer(targetPath, layerPath) {
  return targetPath === layerPath || targetPath.startsWith(`${layerPath}/`)
}

function normalisePath(pathValue) {
  return trimTrailingSlash(pathValue.replace(/\\/g, '/'))
}

function trimTrailingSlash(pathValue) {
  return pathValue.replace(/\/+$/, '')
}
