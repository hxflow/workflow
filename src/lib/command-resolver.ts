/**
 * command-resolver.ts — 三层命令/Hook/Pipeline 解析器
 *
 * 解析优先级（resolution-contract.md）：
 *   Commands: 项目层 → 用户层 → 框架层（命中即停）
 *   Hooks:    框架层 → 用户层 → 项目层（中间件链，全部收集）
 *   Pipelines: 项目层 → 用户层 → 框架层（命中即停）
 */

import { existsSync, readdirSync, readFileSync } from 'fs'
import { resolve } from 'path'

import { FRAMEWORK_ROOT, USER_HX_DIR } from './resolve-context.ts'

// ── Types ───────────────────────────────────────────────────

export interface ResolvedCommand {
  name: string
  filePath: string
  layer: 'project' | 'user' | 'framework'
  content: string
}

export interface ResolvedHook {
  phase: 'pre' | 'post'
  command: string
  filePath: string
  layer: 'framework' | 'user' | 'project'
  content: string
}

export interface ResolvedPipeline {
  name: string
  filePath: string
  layer: 'project' | 'user' | 'framework'
  content: string
}

// ── Layer paths ─────────────────────────────────────────────

function layerDirs(subdir: string, projectRoot: string) {
  return {
    project: resolve(projectRoot, '.hx', subdir),
    user: resolve(USER_HX_DIR, subdir),
    framework: resolve(FRAMEWORK_ROOT, subdir),
  }
}

// ── Command resolver ────────────────────────────────────────

/**
 * 按三层优先级解析命令实体文件。
 * protected 命令只读框架层。
 */
export function resolveCommand(
  commandName: string,
  projectRoot: string,
  opts?: { protected?: boolean },
): ResolvedCommand | null {
  const fileName = commandName.endsWith('.md') ? commandName : `${commandName}.md`
  const dirs = layerDirs('commands', projectRoot)

  const layers: Array<{ layer: ResolvedCommand['layer']; dir: string }> = opts?.protected
    ? [{ layer: 'framework', dir: dirs.framework }]
    : [
        { layer: 'project', dir: dirs.project },
        { layer: 'user', dir: dirs.user },
        { layer: 'framework', dir: dirs.framework },
      ]

  for (const { layer, dir } of layers) {
    const filePath = resolve(dir, fileName)
    if (existsSync(filePath)) {
      return {
        name: commandName,
        filePath,
        layer,
        content: readFileSync(filePath, 'utf8'),
      }
    }
  }

  return null
}

/**
 * 列出所有可用命令（去重后），按三层优先级合并。
 */
export function listCommands(projectRoot: string): ResolvedCommand[] {
  const dirs = layerDirs('commands', projectRoot)
  const seen = new Map<string, ResolvedCommand>()

  const layers: Array<{ layer: ResolvedCommand['layer']; dir: string }> = [
    { layer: 'project', dir: dirs.project },
    { layer: 'user', dir: dirs.user },
    { layer: 'framework', dir: dirs.framework },
  ]

  for (const { layer, dir } of layers) {
    if (!existsSync(dir)) continue
    for (const file of readdirSync(dir).filter((f) => f.startsWith('hx-') && f.endsWith('.md'))) {
      const name = file.replace(/\.md$/, '')
      if (!seen.has(name)) {
        const filePath = resolve(dir, file)
        seen.set(name, {
          name,
          filePath,
          layer,
          content: readFileSync(filePath, 'utf8'),
        })
      }
    }
  }

  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
}

// ── Hook resolver ───────────────────────────────────────────

/**
 * 收集指定命令的 Hook 链。
 *
 * pre hooks: 框架 → 用户 → 项目（递增扩展）
 * post hooks: 项目 → 用户 → 框架（反序收缩）
 */
export function resolveHooks(
  commandName: string,
  projectRoot: string,
): { pre: ResolvedHook[]; post: ResolvedHook[] } {
  const shortName = commandName.replace(/^hx-/, '')
  const dirs = layerDirs('hooks', projectRoot)

  const preOrder: Array<{ layer: ResolvedHook['layer']; dir: string }> = [
    { layer: 'framework', dir: dirs.framework },
    { layer: 'user', dir: dirs.user },
    { layer: 'project', dir: dirs.project },
  ]

  const postOrder: Array<{ layer: ResolvedHook['layer']; dir: string }> = [
    { layer: 'project', dir: dirs.project },
    { layer: 'user', dir: dirs.user },
    { layer: 'framework', dir: dirs.framework },
  ]

  function collectHooks(
    phase: 'pre' | 'post',
    layers: Array<{ layer: ResolvedHook['layer']; dir: string }>,
  ): ResolvedHook[] {
    const hooks: ResolvedHook[] = []
    const fileName = `${phase}_${shortName}.md`

    for (const { layer, dir } of layers) {
      const filePath = resolve(dir, fileName)
      if (existsSync(filePath)) {
        hooks.push({
          phase,
          command: commandName,
          filePath,
          layer,
          content: readFileSync(filePath, 'utf8'),
        })
      }
    }

    return hooks
  }

  return {
    pre: collectHooks('pre', preOrder),
    post: collectHooks('post', postOrder),
  }
}

// ── Pipeline resolver ───────────────────────────────────────

/**
 * 按三层优先级解析 pipeline 文件。
 */
export function resolvePipeline(
  pipelineName: string,
  projectRoot: string,
): ResolvedPipeline | null {
  const fileName = pipelineName.endsWith('.yaml') ? pipelineName : `${pipelineName}.yaml`
  const dirs = layerDirs('pipelines', projectRoot)

  const layers: Array<{ layer: ResolvedPipeline['layer']; dir: string }> = [
    { layer: 'project', dir: dirs.project },
    { layer: 'user', dir: dirs.user },
    { layer: 'framework', dir: dirs.framework },
  ]

  for (const { layer, dir } of layers) {
    const filePath = resolve(dir, fileName)
    if (existsSync(filePath)) {
      return {
        name: pipelineName,
        filePath,
        layer,
        content: readFileSync(filePath, 'utf8'),
      }
    }
  }

  return null
}
