/**
 * resolve-context.js — 框架路径常量与项目根查找
 */

import { existsSync } from 'fs'
import { dirname, resolve } from 'path'
import { homedir } from 'os'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const HX_CONFIG_FILE = '.hx/config.yaml'

/** 框架源码根目录（src/） */
export const FRAMEWORK_ROOT = resolve(__dirname, '..')

/** 已安装包根目录 */
export const PACKAGE_ROOT = resolve(__dirname, '../..')

/** 用户全局 hx 目录 */
export const USER_HX_DIR = resolve(homedir(), '.hx')

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
    if (existsSync(resolve(dir, HX_CONFIG_FILE))) return dir
    if (existsSync(resolve(dir, '.git'))) return dir
    dir = dirname(dir)
  }

  return resolvedStartDir
}
