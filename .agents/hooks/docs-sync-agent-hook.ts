#!/usr/bin/env bun

import { spawnSync } from 'node:child_process'

export interface DocsSyncGuardResult {
  ok: boolean
  applies: boolean
  hxflowFiles: string[]
  docsFiles: string[]
  errors: string[]
  next: string[]
}

const HXFLOW_PREFIX = 'hxflow/'
const DOCS_PREFIX = 'docs/'

if (import.meta.main) {
  const payload = await new Response(Bun.stdin).text()
  const command = extractCommand(payload)

  if (command !== null && !isGitCommitCommand(command)) {
    process.exit(0)
  }

  const result = guardDocsSync(process.cwd())
  if (result.ok) process.exit(0)

  console.error(formatAgentInstruction(result))
  process.exit(2)
}

export function guardDocsSync(projectRoot: string, stagedFiles = readStagedFiles(projectRoot)): DocsSyncGuardResult {
  const hxflowFiles = stagedFiles.filter(isHxflowUpdate)
  const docsFiles = stagedFiles.filter(isDocsUpdate)
  const errors: string[] = []
  const next: string[] = []

  if (hxflowFiles.length > 0 && docsFiles.length === 0) {
    errors.push('检测到 hxflow 更新，但本次提交没有同步 docs/ 文档')
    next.push('根据 hxflow 改动更新 docs/ 下相关文档')
    next.push('stage 文档改动后重新执行 git commit')
  }

  return {
    ok: errors.length === 0,
    applies: hxflowFiles.length > 0,
    hxflowFiles,
    docsFiles,
    errors,
    next,
  }
}

export function isGitCommitCommand(command: string): boolean {
  return /^git\s+commit(?:\s|$)/.test(command.trim())
}

function readStagedFiles(projectRoot: string): string[] {
  const result = spawnSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMRT'], {
    cwd: projectRoot,
    encoding: 'utf8',
  })

  if (result.status !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim() || 'git diff --cached 失败'
    throw new Error(detail)
  }

  return result.stdout
    .split('\n')
    .map((line) => normalizePath(line.trim()))
    .filter((line) => line.length > 0)
}

function extractCommand(payload: string): string | null {
  if (!payload.trim()) return null

  try {
    const input = JSON.parse(payload) as Record<string, unknown>
    const toolInput = typeof input.tool_input === 'object' && input.tool_input !== null
      ? input.tool_input as Record<string, unknown>
      : {}

    for (const value of [toolInput.command, toolInput.cmd, input.command, input.cmd]) {
      if (typeof value === 'string') return value
    }
  } catch {
    return null
  }

  return null
}

function isHxflowUpdate(path: string): boolean {
  return path.startsWith(HXFLOW_PREFIX)
}

function isDocsUpdate(path: string): boolean {
  return path.startsWith(DOCS_PREFIX)
}

function normalizePath(path: string): string {
  return path.replaceAll('\\', '/')
}

function formatAgentInstruction(result: DocsSyncGuardResult): string {
  return [
    'hxflow docs sync required before commit',
    '',
    ...result.errors,
    '',
    'hxflow changes:',
    ...result.hxflowFiles.map((file) => `  - ${file}`),
    '',
    'Agent next steps:',
    ...result.next.map((item) => `  - ${item}`),
  ].join('\n')
}
