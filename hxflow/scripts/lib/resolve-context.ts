/**
 * resolve-context.js — 框架路径常量与项目根查找
 */

import { existsSync } from 'fs'
import { dirname, resolve } from 'path'
import { homedir } from 'os'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export const HX_CONFIG_FILE = '.hx/config.yaml'
export const HX_WORKSPACE_FILE = '.hx/workspace.yaml'

/** 框架根目录（hxflow 目录） */
export const FRAMEWORK_ROOT = resolve(__dirname, '../..')

/** 仓库根目录 */
export const PACKAGE_ROOT = resolve(__dirname, '../../..')

/**
 * 安全获取当前工作目录。
 * 当进程启动后原 cwd 被删除时，process.cwd() 可能抛出（Node）或返回过期路径（Bun）；
 * 这里统一降级到仍存在的目录。
 */
export function getSafeCwd(fallbackDir = homedir()) {
  try {
    const cwd = process.cwd()
    if (existsSync(cwd)) return cwd
  } catch {
    // fall through
  }

  const initCwd = process.env.INIT_CWD
  if (initCwd && existsSync(initCwd)) {
    return resolve(initCwd)
  }

  return resolve(fallbackDir)
}

/**
 * 向上搜索项目根目录。
 * 优先找 .hx/config.yaml，最后找 .git（通用项目根标记）。
 */
export function findProjectRoot(startDir?: string): string {
  const resolvedStartDir = resolve(startDir || getSafeCwd())
  let dir = resolvedStartDir
  const root = resolve('/')

  while (dir !== root) {
    assertNoHxModeConflict(dir)
    if (existsSync(resolve(dir, HX_CONFIG_FILE))) return dir
    if (existsSync(resolve(dir, '.git'))) return dir
    dir = dirname(dir)
  }

  return resolvedStartDir
}

export function hasHxModeConflict(dir: string): boolean {
  return existsSync(resolve(dir, HX_CONFIG_FILE)) && existsSync(resolve(dir, HX_WORKSPACE_FILE))
}

export function assertNoHxModeConflict(dir: string): void {
  if (!hasHxModeConflict(dir)) return
  throw new Error(`.hx 配置冲突：${dir} 同时存在 ${HX_CONFIG_FILE} 与 ${HX_WORKSPACE_FILE}`)
}
