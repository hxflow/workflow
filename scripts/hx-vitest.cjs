#!/usr/bin/env node

const { execFileSync, spawnSync } = require('child_process')
const { existsSync } = require('fs')
const { resolve } = require('path')

const MIN_NODE_MAJOR = 18
const VITEST_PATH = resolve(__dirname, '..', 'node_modules', 'vitest', 'vitest.mjs')

const candidates = [
  process.env.HX_NODE_BIN,
  process.execPath,
  '/opt/homebrew/bin/node',
  '/opt/local/bin/node',
  '/usr/local/bin/node'
].filter(Boolean)

const nodeBin = findSupportedNode(candidates)

if (!nodeBin) {
  console.error(`✗ hx:test 需要 Node >= ${MIN_NODE_MAJOR}`)
  console.error('  请升级 Node，或通过 HX_NODE_BIN 指定可用的 Node 可执行文件')
  process.exit(1)
}

if (!existsSync(VITEST_PATH)) {
  console.error(`✗ 未找到 Vitest 入口: ${VITEST_PATH}`)
  console.error('  请先安装依赖')
  process.exit(1)
}

const result = spawnSync(nodeBin, [VITEST_PATH, ...process.argv.slice(2)], {
  stdio: 'inherit'
})

if (typeof result.status === 'number') {
  process.exit(result.status)
}

if (result.error) {
  console.error(`✗ 无法启动 Vitest: ${result.error.message}`)
}

process.exit(1)

function findSupportedNode(candidates) {
  const tried = new Set()

  for (const candidate of candidates) {
    if (!candidate || tried.has(candidate) || !existsSync(candidate)) {
      continue
    }

    tried.add(candidate)

    try {
      const version = execFileSync(candidate, ['-p', 'process.versions.node'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      }).trim()
      const major = Number.parseInt(version.split('.')[0], 10)

      if (Number.isInteger(major) && major >= MIN_NODE_MAJOR) {
        return candidate
      }
    } catch {
      // ignore invalid Node candidates
    }
  }

  return null
}
