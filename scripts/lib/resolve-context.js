/**
 * resolve-context.js — 路径解耦核心
 *
 * 分离三层路径：
 *   FRAMEWORK_ROOT — npm 包安装位置（内置 profiles、模板，只读）
 *   PROJECT_ROOT   — 用户项目根目录（源码、.claude/）
 *   HARNESS_DIR    — .harness/ 目录（需求、计划、自定义 profile）
 */

import { existsSync, readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** 框架自身的根目录（scripts/lib/ 向上两级） */
export const FRAMEWORK_ROOT = resolve(__dirname, '../..')

/**
 * 向上搜索项目根目录。
 * 优先找 .harness/config.yaml（已安装框架的项目），
 * 其次找 .git（通用项目根标记）。
 */
export function findProjectRoot(startDir) {
  let dir = resolve(startDir || process.cwd())
  const root = resolve('/')

  while (dir !== root) {
    if (existsSync(resolve(dir, '.harness', 'config.yaml'))) return dir
    if (existsSync(resolve(dir, '.git'))) return dir
    dir = dirname(dir)
  }

  // 找不到就用 cwd
  return resolve(startDir || process.cwd())
}

/**
 * 加载 .harness/config.yaml 配置。
 * 使用简易解析（key: value），不依赖完整 YAML 解析器。
 */
function loadHarnessConfig(projectRoot) {
  const configPath = resolve(projectRoot, '.harness', 'config.yaml')
  if (!existsSync(configPath)) return {}

  try {
    const content = readFileSync(configPath, 'utf8')
    const config = {}
    let currentSection = null

    for (const line of content.split('\n')) {
      const trimmed = line.replace(/#.*$/, '').trim()
      if (!trimmed) continue

      // 检测 section（如 paths:）
      if (/^\w+:\s*$/.test(trimmed)) {
        currentSection = trimmed.replace(':', '').trim()
        config[currentSection] = config[currentSection] || {}
        continue
      }

      // section 内的 key: value
      if (currentSection && /^\s+\w+:/.test(line)) {
        const match = trimmed.match(/^(\w+):\s*(.*)$/)
        if (match) {
          config[currentSection][match[1]] = match[2].replace(/^["']|["']$/g, '')
        }
        continue
      }

      // 顶层 key: value
      const topMatch = trimmed.match(/^(\w+):\s+(.+)$/)
      if (topMatch) {
        currentSection = null
        config[topMatch[1]] = topMatch[2].replace(/^["']|["']$/g, '')
      }
    }

    return config
  } catch {
    return {}
  }
}

/**
 * 解析完整的上下文路径。
 *
 * @param {string} [cwd] - 起始目录，默认 process.cwd()
 * @returns 所有路径信息
 */
export function resolveContext(cwd) {
  const projectRoot = findProjectRoot(cwd)
  const config = loadHarnessConfig(projectRoot)
  const paths = config.paths || {}
  const harnessDir = resolve(projectRoot, '.harness')

  return {
    // 框架本身（只读资源）
    frameworkRoot: FRAMEWORK_ROOT,

    // 用户项目
    projectRoot,

    // .harness/ 工作目录
    harnessDir,

    // 可配置路径（从 config.yaml 读取，有默认值）
    requirementDir: resolve(projectRoot, paths.requirement || '.harness/requirement'),
    plansDir: resolve(projectRoot, paths.plans || '.harness/plans'),
    srcDir: resolve(projectRoot, paths.src || 'src'),
    agentsPath: resolve(projectRoot, paths.agents || '.harness/AGENTS.md'),

    // 框架内置资源（始终从 FRAMEWORK_ROOT 读取）
    goldenPrinciplesPath: resolve(FRAMEWORK_ROOT, 'docs', 'golden-principles.md'),
    mapPath: resolve(FRAMEWORK_ROOT, 'docs', 'map.md'),

    // 原始配置
    config,
    defaultProfile: config.defaultProfile || null
  }
}
