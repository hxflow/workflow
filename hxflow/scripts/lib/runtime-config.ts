import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { normalizeYamlScalar } from './config-utils.ts'

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
  const hooks: Record<string, RuntimeHookEntry> = {}
  const pipelines: Record<string, string> = {}
  const ruleTemplates: RuleTemplateConfig = {}
  const gates: GatesConfig = {}
  const paths: PathsConfig = {}
  const lines = content.replaceAll('\r\n', '\n').split('\n')

  let inPaths = false
  let inRuntime = false
  let inHooks = false
  let inPipelines = false
  let inRules = false
  let inRuleTemplates = false
  let inGates = false
  let currentCommand: string | null = null
  let currentPhase: 'pre' | 'post' | null = null

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith('#')) continue

    const indent = rawLine.length - rawLine.trimStart().length

    if (indent === 0) {
      inPaths = trimmed === 'paths:'
      inRuntime = trimmed === 'runtime:'
      inRules = trimmed === 'rules:'
      inGates = trimmed === 'gates:'
      inHooks = false
      inPipelines = false
      inRuleTemplates = false
      currentCommand = null
      currentPhase = null
      continue
    }

    if (inPaths && indent === 2) {
      const match = trimmed.match(/^(\w+):\s*(.*)/)
      if (match && ['src', 'requirementDoc', 'planDoc', 'progressFile'].includes(match[1])) {
        const value = normalizeYamlScalar(match[2])
        if (value) paths[match[1] as keyof PathsConfig] = value
      }
      continue
    }

    if (inGates && indent === 2) {
      const match = trimmed.match(/^(\w+):\s*(.*)/)
      if (match) {
        const value = normalizeYamlScalar(match[2])
        if (value && GATE_ORDER.includes(match[1] as GateName)) {
          gates[match[1] as GateName] = value
        }
      }
      continue
    }

    if (indent === 2) {
      if (inRuntime) {
        inHooks = trimmed === 'hooks:'
        inPipelines = trimmed === 'pipelines:'
      } else {
        inHooks = false
        inPipelines = false
      }

      if (inRules) {
        inRuleTemplates = trimmed === 'templates:'
      } else {
        inRuleTemplates = false
      }

      currentCommand = null
      currentPhase = null
      continue
    }

    if (inRuntime && inHooks) {
      if (indent === 4 && trimmed.endsWith(':')) {
        currentCommand = trimmed.slice(0, -1).trim()
        hooks[currentCommand] ??= { pre: [], post: [] }
        currentPhase = null
        continue
      }

      if (!currentCommand) continue

      if (indent === 6 && (trimmed === 'pre:' || trimmed === 'post:')) {
        currentPhase = trimmed.slice(0, -1) as 'pre' | 'post'
        continue
      }

      if (indent >= 8 && trimmed.startsWith('- ') && currentPhase) {
        hooks[currentCommand][currentPhase].push(normalizeYamlScalar(trimmed.slice(2)))
      }

      continue
    }

    if (inRuntime && inPipelines && indent === 4) {
      const match = trimmed.match(/^([A-Za-z0-9_-]+):\s*(.+)$/)
      if (match) {
        pipelines[match[1]] = normalizeYamlScalar(match[2])
      }
    }

    if (inRules && inRuleTemplates && indent === 4) {
      const match = trimmed.match(/^(requirement|plan|bugfixRequirement|bugfixPlan):\s*(.+)$/)
      if (match) {
        ruleTemplates[match[1] as keyof RuleTemplateConfig] = normalizeYamlScalar(match[2])
      }
    }
  }

  return { runtime: { hooks, pipelines }, ruleTemplates, gates, paths }
}
