import { existsSync } from 'fs'
import { relative, resolve } from 'path'

import { getWorkspaceProjects } from './file-paths.ts'
import { GATE_ORDER, readGatesConfig, readPathsConfig } from './runtime-config.ts'
import type { GateName, GatesConfig } from './runtime-config.ts'

export interface ExecutionConfig {
  root: string
  cwd: string
  src: string
  gates: GatesConfig
  gateSources: Partial<Record<GateName, 'project' | 'workspace'>>
  source: 'project' | 'workspace'
}

export function resolveExecutionConfig(projectRoot: string, taskCwd: string): ExecutionConfig {
  const normalizedCwd = normalizeTaskCwd(projectRoot, taskCwd)
  const executionRoot = resolve(projectRoot, normalizedCwd)
  const workspacePaths = readPathsConfig(projectRoot)
  const workspaceGates = readGatesConfig(projectRoot)
  const projectConfigPath = resolve(executionRoot, '.hx', 'config.yaml')

  if (!taskCwd || !existsSync(projectConfigPath)) {
    const source = existsSync(resolve(projectRoot, '.hx', 'workspace.yaml')) ? 'workspace' : 'project'
    return {
      root: taskCwd ? executionRoot : projectRoot,
      cwd: normalizedCwd,
      src: workspacePaths.src ?? 'src',
      gates: workspaceGates,
      gateSources: Object.fromEntries(GATE_ORDER.filter((gate) => workspaceGates[gate]).map((gate) => [gate, source])),
      source,
    }
  }

  const projectPaths = readPathsConfig(executionRoot)
  const projectGates = readGatesConfig(executionRoot)

  return {
    root: executionRoot,
    cwd: normalizedCwd,
    src: projectPaths.src ?? workspacePaths.src ?? 'src',
    gates: mergeGates(workspaceGates, projectGates),
    gateSources: mergeGateSources(workspaceGates, projectGates),
    source: 'project',
  }
}

export function resolveWorkspaceExecutionConfigs(projectRoot: string, taskCwds: string[]): ExecutionConfig[] {
  const uniqueCwds = Array.from(new Set(taskCwds.map((cwd) => normalizeTaskCwd(projectRoot, cwd)).filter(Boolean)))
  if (uniqueCwds.length === 0) {
    return [resolveExecutionConfig(projectRoot, '')]
  }

  return uniqueCwds.map((cwd) => resolveExecutionConfig(projectRoot, cwd))
}

export function listWorkspaceProjectCwds(projectRoot: string): string[] {
  return getWorkspaceProjects(projectRoot).map((project) => project.path)
}

function mergeGates(workspaceGates: GatesConfig, projectGates: GatesConfig): GatesConfig {
  const merged: GatesConfig = {}
  for (const gate of GATE_ORDER) {
    merged[gate] = projectGates[gate] ?? workspaceGates[gate]
  }
  return merged
}

function mergeGateSources(workspaceGates: GatesConfig, projectGates: GatesConfig): Partial<Record<GateName, 'project' | 'workspace'>> {
  const sources: Partial<Record<GateName, 'project' | 'workspace'>> = {}
  for (const gate of GATE_ORDER) {
    if (projectGates[gate]) {
      sources[gate] = 'project'
    } else if (workspaceGates[gate]) {
      sources[gate] = 'workspace'
    }
  }
  return sources
}

function normalizeTaskCwd(projectRoot: string, taskCwd: string): string {
  const trimmed = taskCwd.trim()
  if (!trimmed) return ''

  const resolved = resolve(projectRoot, trimmed)
  const relativePath = relative(projectRoot, resolved)
  if (resolved === projectRoot || relativePath.startsWith('..')) return ''

  return relativePath
}
