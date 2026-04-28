import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

import { parse as parseYaml } from 'yaml'

export interface RuntimeHookEntry {
  pre: string[]
  post: string[]
}

export interface RuntimeConfig {
  hooks: Record<string, RuntimeHookEntry>
  pipelines: Record<string, string>
}

export interface RuleTemplateConfig {
  requirement?: string
  plan?: string
  bugfixRequirement?: string
  bugfixPlan?: string
}

export interface PathsConfig {
  src?: string
  requirementDoc?: string
  planDoc?: string
  progressFile?: string
}

export const GATE_ORDER = ['lint', 'build', 'type', 'test'] as const
export type GateName = (typeof GATE_ORDER)[number]
export type GatesConfig = Partial<Record<GateName, string>>

function getRuntimeConfigPath(projectRoot: string): string | null {
  const projectConfigPath = resolve(projectRoot, '.hx', 'config.yaml')
  if (existsSync(projectConfigPath)) return projectConfigPath

  const workspaceConfigPath = resolve(projectRoot, '.hx', 'workspace.yaml')
  if (existsSync(workspaceConfigPath)) return workspaceConfigPath

  return null
}

/**
 * 读取 .hx/config.yaml 中 gates 区块。
 */
export function readGatesConfig(projectRoot: string): GatesConfig {
  const configPath = getRuntimeConfigPath(projectRoot)
  if (!configPath) return {}
  return parseConfigSections(readFileSync(configPath, 'utf8')).gates
}

export function readRuntimeConfig(projectRoot: string): RuntimeConfig {
  const configPath = getRuntimeConfigPath(projectRoot)
  if (!configPath) {
    return { hooks: {}, pipelines: {} }
  }

  return parseConfigSections(readFileSync(configPath, 'utf8')).runtime
}

export function readRuleTemplateConfig(projectRoot: string): RuleTemplateConfig {
  const configPath = getRuntimeConfigPath(projectRoot)
  if (!configPath) {
    return {}
  }

  return parseConfigSections(readFileSync(configPath, 'utf8')).ruleTemplates
}

interface ParsedConfigSections {
  runtime: RuntimeConfig
  ruleTemplates: RuleTemplateConfig
  gates: GatesConfig
  paths: PathsConfig
}

export function readPathsConfig(projectRoot: string): PathsConfig {
  const configPath = getRuntimeConfigPath(projectRoot)
  if (!configPath) return {}
  return parseConfigSections(readFileSync(configPath, 'utf8')).paths
}

function parseConfigSections(content: string): ParsedConfigSections {
  const doc = (parseYaml(content) ?? {}) as Record<string, unknown>
  return {
    paths: parsePaths(doc.paths),
    runtime: parseRuntime(doc.runtime),
    ruleTemplates: parseRuleTemplates(doc.rules),
    gates: parseGates(doc.gates),
  }
}

function parsePaths(raw: unknown): PathsConfig {
  if (typeof raw !== 'object' || raw === null) return {}
  const obj = raw as Record<string, unknown>
  const result: PathsConfig = {}
  for (const key of ['src', 'requirementDoc', 'planDoc', 'progressFile'] as const) {
    if (typeof obj[key] === 'string') result[key] = obj[key] as string
  }
  return result
}

function parseRuntime(raw: unknown): RuntimeConfig {
  if (typeof raw !== 'object' || raw === null) return { hooks: {}, pipelines: {} }
  const obj = raw as Record<string, unknown>
  return {
    hooks: parseHooks(obj.hooks),
    pipelines: parsePipelines(obj.pipelines),
  }
}

function parseHooks(raw: unknown): Record<string, RuntimeHookEntry> {
  if (typeof raw !== 'object' || raw === null) return {}
  const hooks: Record<string, RuntimeHookEntry> = {}
  for (const [command, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isValidRuntimeCommandName(command)) {
      throw new Error(`runtime.hooks.${command} 无效，请使用 doc/plan/run/check/mr 这类命令名`)
    }
    if (typeof value !== 'object' || value === null) continue
    const entry = value as Record<string, unknown>
    hooks[command] = {
      pre: toStringArray(entry.pre),
      post: toStringArray(entry.post),
    }
  }
  return hooks
}

function parsePipelines(raw: unknown): Record<string, string> {
  if (typeof raw !== 'object' || raw === null) return {}
  const pipelines: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string') pipelines[key] = value
  }
  return pipelines
}

function parseRuleTemplates(raw: unknown): RuleTemplateConfig {
  if (typeof raw !== 'object' || raw === null) return {}
  const obj = raw as Record<string, unknown>
  const templates = (typeof obj.templates === 'object' && obj.templates !== null ? obj.templates : {}) as Record<string, unknown>
  const result: RuleTemplateConfig = {}
  for (const key of ['requirement', 'plan', 'bugfixRequirement', 'bugfixPlan'] as const) {
    if (typeof templates[key] === 'string') result[key] = templates[key] as string
  }
  return result
}

function parseGates(raw: unknown): GatesConfig {
  if (typeof raw !== 'object' || raw === null) return {}
  const obj = raw as Record<string, unknown>
  const gates: GatesConfig = {}
  for (const key of GATE_ORDER) {
    if (typeof obj[key] === 'string') gates[key] = obj[key] as string
  }
  return gates
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string')
}

function isValidRuntimeCommandName(command: string): boolean {
  return /^[a-z][a-z0-9-]*$/.test(command) && !command.startsWith('hx-')
}
