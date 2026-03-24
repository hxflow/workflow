#!/usr/bin/env node
// scripts/hx-check.js
// 用法: npm run hx:check -- [--profile backend|frontend|mobile:ios]
// 串行执行 ctx 与 gate，并透传命令参数

import { execFileSync } from 'child_process'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const nodeBin = process.execPath

execStep('scripts/hx-ctx-check.js')
execStep('scripts/hx-gate.js')

function execStep(scriptPath) {
  execFileSync(nodeBin, [scriptPath, ...args], {
    cwd: ROOT,
    stdio: 'inherit'
  })
}
