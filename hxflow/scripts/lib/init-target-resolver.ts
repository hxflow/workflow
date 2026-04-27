import { existsSync, readdirSync, statSync } from 'fs'
import { basename, relative, resolve } from 'path'

import { HX_CONFIG_FILE, HX_WORKSPACE_FILE, assertNoHxModeConflict } from './resolve-context.ts'

export type InitMode = 'project' | 'workspace'

export interface InitCandidate {
  id: string
  path: string
  relativePath: string
  type: ProjectType
  hxReady: boolean
}

export interface InitTarget {
  mode: InitMode
  root: string
  candidates: InitCandidate[]
}

type ProjectType = 'frontend' | 'backend' | 'mobile' | 'unknown'

const EXCLUDED_CHILDREN = new Set([
  '.git',
  '.hx',
  '.idea',
  '.vscode',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'target',
])

const PROJECT_MARKERS = [
  // 通用
  '.git',
  HX_CONFIG_FILE,
  // 前端 / Node
  'package.json',
  'pnpm-workspace.yaml',
  'bun.lockb',
  'vite.config.js',
  'vite.config.ts',
  'tsconfig.json',
  // 移动端
  'pubspec.yaml',       // Flutter
  'Podfile',            // iOS (CocoaPods)
  'metro.config.js',    // React Native
  'metro.config.ts',    // React Native
  'AndroidManifest.xml',// Android native
  // 后端
  'go.mod',             // Go
  'go.sum',             // Go (补充)
  'pom.xml',            // Java/Maven
  'build.gradle',       // Java/Kotlin/Android
  'build.gradle.kts',
  'Cargo.toml',         // Rust
  'pyproject.toml',     // Python
]

export function resolveInitTarget(
  cwd: string,
  positional: string[],
  options: Record<string, string | true>,
): InitTarget {
  const explicitTarget = typeof options.target === 'string' ? options.target : positional[0]
  const root = resolve(cwd, explicitTarget || '.')
  const forceWorkspace = options.workspace === true
  const forceProject = options.project === true

  if (forceWorkspace && forceProject) {
    throw new Error('hx init 不能同时指定 --workspace 与 --project')
  }

  if (!existsSync(root) || !statSync(root).isDirectory()) {
    throw new Error(`初始化目标目录不存在: ${root}`)
  }

  assertNoHxModeConflict(root)

  if (existsSync(resolve(root, HX_WORKSPACE_FILE))) {
    if (forceProject) throw new Error(`当前目录已是 workspace，不能初始化为 project: ${root}`)
    return { mode: 'workspace', root, candidates: discoverInitCandidates(root) }
  }

  if (existsSync(resolve(root, HX_CONFIG_FILE))) {
    if (forceWorkspace) throw new Error(`当前目录已是 project，不能初始化为 workspace: ${root}`)
    return { mode: 'project', root, candidates: [] }
  }

  if (forceWorkspace) return { mode: 'workspace', root, candidates: discoverInitCandidates(root) }
  if (forceProject || explicitTarget) return { mode: 'project', root, candidates: [] }

  const candidates = discoverInitCandidates(root)
  if (candidates.length >= 2) return { mode: 'workspace', root, candidates }

  return { mode: 'project', root, candidates: [] }
}

export function discoverInitCandidates(root: string): InitCandidate[] {
  return readdirSync(root)
    .filter((name) => !EXCLUDED_CHILDREN.has(name))
    .map((name) => resolve(root, name))
    .filter((childPath) => {
      try {
        return statSync(childPath).isDirectory()
      } catch {
        return false
      }
    })
    .filter(isProjectCandidate)
    .map((childPath) => ({
      id: toProjectId(basename(childPath)),
      path: childPath,
      relativePath: relative(root, childPath) || '.',
      type: detectProjectType(childPath),
      hxReady: existsSync(resolve(childPath, HX_CONFIG_FILE)),
    }))
    .sort((a, b) => a.id.localeCompare(b.id))
}

function isProjectCandidate(dir: string): boolean {
  assertNoHxModeConflict(dir)
  return PROJECT_MARKERS.some((marker) => existsSync(resolve(dir, marker)))
}

function detectProjectType(dir: string): ProjectType {
  // 移动端优先判断（React Native 含 package.json，需在 frontend 前检测）
  if (
    existsSync(resolve(dir, 'pubspec.yaml')) ||        // Flutter
    existsSync(resolve(dir, 'metro.config.js')) ||     // React Native
    existsSync(resolve(dir, 'metro.config.ts')) ||     // React Native
    existsSync(resolve(dir, 'Podfile')) ||             // iOS
    existsSync(resolve(dir, 'AndroidManifest.xml'))    // Android native
  ) {
    return 'mobile'
  }
  if (
    existsSync(resolve(dir, 'package.json')) ||
    existsSync(resolve(dir, 'vite.config.ts')) ||
    existsSync(resolve(dir, 'vite.config.js'))
  ) {
    return 'frontend'
  }
  if (
    existsSync(resolve(dir, 'go.mod')) ||
    existsSync(resolve(dir, 'pom.xml')) ||
    existsSync(resolve(dir, 'Cargo.toml')) ||
    existsSync(resolve(dir, 'pyproject.toml')) ||
    existsSync(resolve(dir, 'build.gradle')) ||
    existsSync(resolve(dir, 'build.gradle.kts'))
  ) {
    return 'backend'
  }
  return 'unknown'
}

function toProjectId(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
