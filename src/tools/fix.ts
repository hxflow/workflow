#!/usr/bin/env node

/**
 * hx-fix.ts — 错误修复事实工具
 *
 * 用法：
 *   hx fix context [<feature>] [--log <text>] [--file <path>]
 *       收集错误上下文（日志/文件/gate 输出）供 AI 修复
 *
 * 所有子命令输出 JSON 到 stdout，失败时 exit 1。
 */

import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { spawnSync } from 'child_process'

import { parseArgs } from '../lib/config-utils.ts'
import { FRAMEWORK_ROOT, findProjectRoot, getSafeCwd } from '../lib/resolve-context.ts'

const argv = process.argv.slice(2)
const [sub, ...rest] = argv
const { positional, options } = parseArgs(rest)
const [feature] = positional

function out(data: unknown) {
  console.log(JSON.stringify(data, null, 2))
}

function err(message: string): never {
  console.error(JSON.stringify({ ok: false, error: message }))
  process.exit(1)
}

const projectRoot = findProjectRoot(getSafeCwd())

switch (sub) {
  case 'context': {
    const logArg = options.log ?? null
    const fileArg = options.file ?? null

    const gates = loadGates(projectRoot)
    const testCommand = gates.test ?? null

    const errorContext = collectErrorContext({ logArg: logArg as string | null, fileArg: fileArg as string | null, testCommand, projectRoot })
    if (!errorContext.ok) {
      out({
        ok: false,
        feature: feature ?? null,
        errorSource: errorContext.source,
        reason: errorContext.reason,
      })
      process.exit(1)
    }

    const goldenRules = resolveRuleFile(projectRoot, 'golden-rules.md')
    const changedFiles = runGit(projectRoot, 'diff', '--name-only', 'HEAD').split('\n').filter(Boolean)

    out({
      ok: true,
      feature: feature ?? null,
      errorSource: errorContext.source,
      errorLog: errorContext.log,
      goldenRules,
      changedFiles,
      verifyCommand: testCommand,
    })
    break
  }

  default:
    err(`未知子命令 "${sub ?? ''}"，可用：context`)
}

// ── helpers ──────────────────────────────────────────────────────────────────

type ErrorContextOk = { ok: true; source: 'file' | 'log' | 'gate'; log: string }
type ErrorContextFail = { ok: false; source: 'none'; reason: string }

function collectErrorContext(input: {
  logArg: string | null
  fileArg: string | null
  testCommand: string | null
  projectRoot: string
}): ErrorContextOk | ErrorContextFail {
  if (input.fileArg) {
    const filePath = resolve(input.fileArg)
    if (!existsSync(filePath)) {
      return { ok: false, source: 'none', reason: `--file 路径不存在: ${filePath}` }
    }
    return { ok: true, source: 'file', log: readFileSync(filePath, 'utf8') }
  }

  if (input.logArg) {
    return { ok: true, source: 'log', log: input.logArg }
  }

  if (!input.testCommand) {
    return {
      ok: false,
      source: 'none',
      reason: '未传 --log / --file，且 .hx/config.yaml 未配置 gates.test，无法自动收集错误上下文。',
    }
  }

  const gateResult = runGate(input.testCommand, input.projectRoot)
  if (gateResult.ok) {
    return { ok: false, source: 'none', reason: 'test gate 当前通过，无需修复。' }
  }
  const log = [gateResult.stderr, gateResult.stdout].filter(Boolean).join('\n').trim()
  return { ok: true, source: 'gate', log: log || `test gate 退出码 ${gateResult.exitCode}` }
}

interface GateRunResult {
  ok: boolean
  exitCode: number
  stdout: string
  stderr: string
}

function runGate(command: string, cwd: string): GateRunResult {
  const result = spawnSync('zsh', ['-lc', command], {
    cwd,
    encoding: 'utf8',
    timeout: 120000,
    maxBuffer: 10 * 1024 * 1024,
  })
  return {
    ok: result.status === 0,
    exitCode: result.status ?? 1,
    stdout: (result.stdout ?? '').trim(),
    stderr: (result.stderr ?? '').trim(),
  }
}

function loadGates(projectRootPath: string): Partial<Record<'lint' | 'build' | 'type' | 'test', string>> {
  const configPath = resolve(projectRootPath, '.hx', 'config.yaml')
  if (!existsSync(configPath)) return {}

  try {
    const content = readFileSync(configPath, 'utf8')
    const gatesMatch = content.match(/^gates:\s*\n((?:[ \t]+\S[^\n]*\n?)*)/m)
    if (!gatesMatch) return {}

    const result: Partial<Record<'lint' | 'build' | 'type' | 'test', string>> = {}
    for (const line of gatesMatch[1].split('\n')) {
      const match = line.match(/^\s+(lint|build|type|test):\s*(.+)/)
      if (!match) continue
      const raw = match[2].trim()
      const value = raw.replace(/^(['"])(.*)\1$/, '$2').trim()
      if (value) result[match[1] as 'lint' | 'build' | 'type' | 'test'] = value
    }
    return result
  } catch {
    return {}
  }
}

function resolveRuleFile(projectRootPath: string, name: string): string | null {
  const project = resolve(projectRootPath, '.hx', 'rules', name)
  const framework = resolve(FRAMEWORK_ROOT, 'templates', 'rules', name)
  if (existsSync(project)) return readFileSync(project, 'utf8')
  if (existsSync(framework)) return readFileSync(framework, 'utf8')
  return null
}

function runGit(projectRootPath: string, ...args: string[]): string {
  const result = spawnSync('git', args, { cwd: projectRootPath, encoding: 'utf8' })
  return result.status === 0 ? result.stdout.trim() : ''
}

