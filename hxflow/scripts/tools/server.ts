#!/usr/bin/env bun
/**
 * hx-server.ts — 服务启动记录工具
 *
 * 读取已验证的服务启动命令；AI 发现并验证成功后写回记录。
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

import { parse as parseYaml } from 'yaml'

import { createSimpleContext } from '../lib/tool-cli.ts'

interface ServerRecord {
  id: string
  type: 'frontend' | 'backend' | 'unknown'
  cwd: string
  command: string
  url?: string
  health?: string
}

const { positional, options, projectRoot } = createSimpleContext()
const [modeOrTarget, maybeId] = positional

if (modeOrTarget === 'save') {
  saveServerRecord(maybeId)
} else {
  readServerRecords(modeOrTarget)
}

function readServerRecords(target: string | undefined) {
  const records = readConfiguredServers(projectRoot)
  const matchedRecords = target ? records.filter((record) => matchesTarget(record, target)) : records

  console.log(JSON.stringify({
    ok: matchedRecords.length > 0,
    mode: matchedRecords.length > 0 ? 'recorded' : 'discover',
    projectRoot,
    target: target ?? null,
    recommended: matchedRecords[0] ?? null,
    records: matchedRecords,
    needsAiDiscovery: matchedRecords.length === 0,
    discovery: matchedRecords.length === 0 ? {
      goal: '分析项目并找到可真实启动的服务命令',
      verify: '前端打开页面；后端确认监听端口或健康接口',
      saveAfterSuccess: true,
    } : null,
    saveCommand: 'hx-server save <id> --cwd <cwd> --command <command> --type <frontend|backend|unknown> [--url <url>]',
  }, null, 2))
}

function saveServerRecord(id: string | undefined) {
  if (!id) fail('用法：hx-server save <id> --cwd <cwd> --command <command> --type <frontend|backend|unknown> [--url <url>]')

  const cwd = readStringOption('cwd')
  const command = readStringOption('command')
  const type = readServerTypeOption()
  const url = readOptionalStringOption('url')
  const health = readOptionalStringOption('health')
  const record: ServerRecord = { id, cwd, command, type, ...(url ? { url } : {}), ...(health ? { health } : {}) }
  const existing = readConfiguredServers(projectRoot)
  const next = [...existing.filter((item) => item.id !== id), record]
  const configPath = writeConfiguredServers(projectRoot, next)

  console.log(JSON.stringify({
    ok: true,
    mode: 'saved',
    projectRoot,
    configPath,
    record,
  }, null, 2))
}

function readConfiguredServers(root: string): ServerRecord[] {
  const configPath = getServerConfigPath(root)
  if (!configPath || !existsSync(configPath)) return []

  const parsed = parseYaml(readFileSync(configPath, 'utf8')) as { servers?: unknown } | null
  const rawServers = parsed?.servers
  if (!Array.isArray(rawServers)) return []

  return rawServers
    .map(parseServerRecord)
    .filter((record): record is ServerRecord => record !== null)
}

function parseServerRecord(raw: unknown): ServerRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  if (typeof obj.id !== 'string') return null
  if (typeof obj.cwd !== 'string') return null
  if (typeof obj.command !== 'string') return null
  const type = obj.type === 'frontend' || obj.type === 'backend' || obj.type === 'unknown' ? obj.type : 'unknown'
  return {
    id: obj.id,
    cwd: obj.cwd,
    command: obj.command,
    type,
    ...(typeof obj.url === 'string' ? { url: obj.url } : {}),
    ...(typeof obj.health === 'string' ? { health: obj.health } : {}),
  }
}

function writeConfiguredServers(root: string, records: ServerRecord[]): string {
  const configPath = getWritableServerConfigPath(root)
  const current = existsSync(configPath) ? readFileSync(configPath, 'utf8') : ''
  const withoutServers = removeTopLevelServersBlock(current).trimEnd()
  const nextContent = `${withoutServers ? `${withoutServers}\n\n` : ''}${renderServersBlock(records)}\n`
  writeFileSync(configPath, nextContent, 'utf8')
  return configPath
}

function getServerConfigPath(root: string): string | null {
  const projectConfigPath = resolve(root, '.hx', 'config.yaml')
  if (existsSync(projectConfigPath)) return projectConfigPath

  const workspaceConfigPath = resolve(root, '.hx', 'workspace.yaml')
  if (existsSync(workspaceConfigPath)) return workspaceConfigPath

  return null
}

function getWritableServerConfigPath(root: string): string {
  const configPath = getServerConfigPath(root) ?? resolve(root, '.hx', 'config.yaml')
  mkdirSync(resolve(configPath, '..'), { recursive: true })
  return configPath
}

function removeTopLevelServersBlock(content: string): string {
  const lines = content.replaceAll('\r\n', '\n').split('\n')
  const start = lines.findIndex((line) => /^servers:\s*$/.test(line))
  if (start === -1) return content

  let end = lines.length
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^[A-Za-z_][\w-]*:\s*/.test(lines[index])) {
      end = index
      break
    }
  }

  return [...lines.slice(0, start), ...lines.slice(end)].join('\n')
}

function renderServersBlock(records: ServerRecord[]): string {
  const lines = [
    '# 已验证的服务启动命令。hx server 优先使用这里的记录。',
    'servers:',
  ]
  for (const record of records) {
    lines.push(`  - id: ${quoteYaml(record.id)}`)
    lines.push(`    cwd: ${quoteYaml(record.cwd)}`)
    lines.push(`    command: ${quoteYaml(record.command)}`)
    lines.push(`    type: ${quoteYaml(record.type)}`)
    if (record.url) lines.push(`    url: ${quoteYaml(record.url)}`)
    if (record.health) lines.push(`    health: ${quoteYaml(record.health)}`)
  }
  return lines.join('\n')
}

function quoteYaml(value: string): string {
  return JSON.stringify(value)
}

function matchesTarget(record: ServerRecord, target: string): boolean {
  const normalizedTarget = target.replace(/^\.\//, '')
  return record.id === target || record.cwd === target || record.cwd.replace(/^\.\//, '') === normalizedTarget
}

function readStringOption(name: string): string {
  const value = options[name]
  if (typeof value === 'string' && value.trim()) return value.trim()
  fail(`缺少 --${name}`)
}

function readOptionalStringOption(name: string): string | undefined {
  const value = options[name]
  if (typeof value === 'string' && value.trim()) return value.trim()
  return undefined
}

function readServerTypeOption(): ServerRecord['type'] {
  const value = readStringOption('type')
  if (value === 'frontend' || value === 'backend' || value === 'unknown') return value
  fail('--type 必须是 frontend、backend 或 unknown')
}

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}
