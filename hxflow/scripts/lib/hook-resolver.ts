import { readRuntimeConfig } from './runtime-config.ts'

export interface HookFile {
  scope: 'project'
  phase: 'pre'
  path: string
}

export interface ResolvedHooks {
  command: string
  preHooks: HookFile[]
  postHooks: HookFile[]
}

function normalizeCommandName(command: string): string {
  const trimmed = command.trim()
  if (!trimmed) {
    throw new Error('命令名不能为空')
  }

  if (!/^[a-z][a-z0-9-]*$/.test(trimmed) || trimmed.startsWith('hx-')) {
    throw new Error(`命令名 "${command}" 无效，请使用 doc/plan/run/check/mr 这类命令名`)
  }

  return trimmed
}

export function resolveCommandHooks(projectRoot: string, command: string): ResolvedHooks {
  const normalizedCommand = normalizeCommandName(command)
  const runtimeConfig = readRuntimeConfig(projectRoot)
  const commandHooks = runtimeConfig.hooks[normalizedCommand] ?? { pre: [], post: [] }

  const preHooks: HookFile[] = commandHooks.pre.map((path) => ({
    scope: 'project',
    phase: 'pre',
    path,
  }))

  return {
    command: normalizedCommand,
    preHooks,
    postHooks: [],
  }
}
