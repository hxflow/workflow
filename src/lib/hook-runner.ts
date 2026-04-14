/**
 * hook-runner.ts — Hook 中间件链执行器
 *
 * 读取三层 hook .md 文件，构建有序的 hook 链。
 * 每个 hook 返回结构化结果（patch / warnings / abort）。
 *
 * 本模块只负责：
 *   1. 收集 hook 文件（委托 command-resolver.resolveHooks）
 *   2. 构建 HookContext
 *   3. 按序执行 hook 链，合并 patch，检查 abort
 *   4. 返回最终上下文和执行摘要
 *
 * Hook 的实际执行由 AI Agent 完成（读 .md 内容后执行对应逻辑）。
 * 本模块提供的是给 AI 调用的事实工具：返回 hook 链信息和上下文数据。
 */

import { resolveHooks, type ResolvedHook } from './command-resolver.ts'

// ── Types ───────────────────────────────────────────────────

export interface HookInput {
  command: string
  projectRoot: string
  feature: string
  arguments: {
    raw: string
    positional: string[]
    options: Record<string, string | boolean>
  }
  paths: Record<string, string>
  gates: Record<string, string>
  context: Record<string, unknown>
}

export interface HookResult {
  patch?: Record<string, unknown>
  warnings?: string[]
  abort?: boolean
  message?: string
  artifacts?: Array<{ type: string; value: string }>
}

export interface HookChainItem {
  phase: 'pre' | 'post'
  layer: string
  filePath: string
  content: string
}

export interface HookChainInfo {
  command: string
  pre: HookChainItem[]
  post: HookChainItem[]
}

export interface HookExecutionSummary {
  phase: 'pre' | 'post'
  hooksFound: number
  hooks: Array<{
    layer: string
    filePath: string
  }>
  context: Record<string, unknown>
}

// ── Hook chain discovery ────────────────────────────────────

/**
 * 发现并返回指定命令的 hook 链信息。
 * AI 用此决定是否需要执行 hook 以及执行顺序。
 */
export function discoverHooks(commandName: string, projectRoot: string): HookChainInfo {
  const { pre, post } = resolveHooks(commandName, projectRoot)

  return {
    command: commandName,
    pre: pre.map(hookToChainItem),
    post: post.map(hookToChainItem),
  }
}

/**
 * 获取 pre hook 链的执行上下文。
 * 返回 hook 列表和初始上下文，AI 按顺序执行每个 hook。
 */
export function getPreHookContext(input: HookInput): HookExecutionSummary {
  const { pre } = resolveHooks(input.command, input.projectRoot)

  return {
    phase: 'pre',
    hooksFound: pre.length,
    hooks: pre.map((h) => ({ layer: h.layer, filePath: h.filePath })),
    context: { ...input.context },
  }
}

/**
 * 获取 post hook 链的执行上下文。
 * result 是主命令执行后的结构化结果。
 */
export function getPostHookContext(
  input: HookInput,
  result: Record<string, unknown>,
): HookExecutionSummary & { result: Record<string, unknown> } {
  const { post } = resolveHooks(input.command, input.projectRoot)

  return {
    phase: 'post',
    hooksFound: post.length,
    hooks: post.map((h) => ({ layer: h.layer, filePath: h.filePath })),
    context: { ...input.context },
    result,
  }
}

/**
 * 合并 hook 结果到上下文中。
 * AI 执行完一个 hook 后调用此函数更新上下文。
 */
export function applyHookResult(
  currentContext: Record<string, unknown>,
  hookResult: HookResult,
): {
  context: Record<string, unknown>
  abort: boolean
  warnings: string[]
  message?: string
} {
  const merged = { ...currentContext }

  if (hookResult.patch) {
    for (const [key, value] of Object.entries(hookResult.patch)) {
      if (['context', 'paths', 'gates', 'feature'].includes(key)) {
        if (typeof value === 'object' && value !== null && typeof merged[key] === 'object' && merged[key] !== null) {
          merged[key] = { ...(merged[key] as Record<string, unknown>), ...(value as Record<string, unknown>) }
        } else {
          merged[key] = value
        }
      }
    }
  }

  return {
    context: merged,
    abort: hookResult.abort ?? false,
    warnings: hookResult.warnings ?? [],
    message: hookResult.message,
  }
}

// ── Helpers ─────────────────────────────────────────────────

function hookToChainItem(hook: ResolvedHook): HookChainItem {
  return {
    phase: hook.phase,
    layer: hook.layer,
    filePath: hook.filePath,
    content: hook.content,
  }
}
