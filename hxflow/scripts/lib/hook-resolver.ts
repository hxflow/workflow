import { formatRuntimeCommandNames, isValidRuntimeCommandName, readRuntimeConfig } from './runtime-config.ts'

export interface HookFile {
  scope: 'project'
  phase: 'pre' | 'post'
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

  if (!isValidRuntimeCommandName(trimmed)) {
    throw new Error(`命令名 "${command}" 无效，请使用 ${formatRuntimeCommandNames()} 这类命令名`)
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

  const postHooks: HookFile[] = commandHooks.post.map((path) => ({
    scope: 'project',
    phase: 'post',
    path,
  }))

  return {
    command: normalizedCommand,
    preHooks,
    postHooks,
  }
}
