import { existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, symlinkSync } from 'fs'
import { isAbsolute, relative, resolve } from 'path'
import { tmpdir } from 'os'
import { env } from 'process'

export function collectTokenStatuses(root) {
  return [
    {
      label: 'GitLab Token',
      recommendedKey: 'GITLAB_TOKEN',
      matched: findConfiguredKey(root, ['GITLAB_TOKEN'])
    },
    {
      label: '无双 DevOps API Token',
      recommendedKey: 'DEVOPS_API_KEY',
      matched: findConfiguredKey(root, ['DEVOPS_API_KEY', 'WUSHUANG_API_TOKEN'])
    }
  ]
}

export function findConfiguredKey(root, keys) {
  for (const key of keys) {
    if (env[key]) {
      return { key, source: 'env' }
    }
  }

  const envFiles = ['.env', '.env.local', '.env.development', '.env.development.local', '.envrc']
  for (const fileName of envFiles) {
    const filePath = resolve(root, fileName)
    if (!existsSync(filePath)) {
      continue
    }

    const content = readFileSync(filePath, 'utf8')
    for (const key of keys) {
      const matcher = new RegExp(`^\\s*${escapeRegExp(key)}\\s*=`, 'm')
      if (matcher.test(content)) {
        return { key, source: fileName }
      }
    }
  }

  return null
}

export function ensureClaudeEntrypointLink(targetRoot, summary) {
  const claudePath = resolve(targetRoot, '.CLAUDE.md')

  if (!existsSync(claudePath)) {
    symlinkSync('AGENTS.md', claudePath)
    summary.created.push('.CLAUDE.md -> AGENTS.md')
    return
  }

  try {
    const stats = lstatSync(claudePath)
    if (stats.isSymbolicLink() && readlinkSync(claudePath) === 'AGENTS.md') {
      summary.skipped.push('.CLAUDE.md')
      return
    }
  } catch {
    // fall through to warning
  }

  summary.warnings.push('检测到现有 .CLAUDE.md，未覆盖；如需与 AGENTS.md 同步，请手动改成指向 AGENTS.md 的链接')
}

export function detectPackageManager(root) {
  if (existsSync(resolve(root, 'pnpm-lock.yaml'))) {
    return { name: 'pnpm', installCommand: 'pnpm install' }
  }
  if (existsSync(resolve(root, 'yarn.lock'))) {
    return { name: 'yarn', installCommand: 'yarn install' }
  }
  if (existsSync(resolve(root, 'package-lock.json'))) {
    return { name: 'npm', installCommand: 'npm install' }
  }
  return { name: 'npm', installCommand: 'npm install' }
}

export function createInstallEnv(packageManager) {
  const installEnv = { ...env }

  if (packageManager.name === 'npm' && !installEnv.NPM_CONFIG_CACHE) {
    const cacheRoot = resolve(tmpdir(), 'harness-workflow-framework', 'npm-cache')
    mkdirSync(cacheRoot, { recursive: true })
    installEnv.NPM_CONFIG_CACHE = cacheRoot
  }

  return installEnv
}

export function assertInstallTargetSafe(targetRoot, sourceRoot) {
  const normalizedTarget = resolve(targetRoot)
  const normalizedSource = resolve(sourceRoot)

  if (normalizedTarget === normalizedSource) {
    throw new Error('当前目录是框架模板自身，请显式传入目标项目目录')
  }

  if (isPathEqualOrInside(normalizedSource, normalizedTarget)) {
    throw new Error(`目标目录位于框架模板目录内，不能安装到模板源码树中: ${normalizedTarget}`)
  }
}

export function assertCopyTargetSafe(sourcePath, targetPath) {
  const normalizedSource = resolve(sourcePath)
  const normalizedTarget = resolve(targetPath)

  if (isPathEqualOrInside(normalizedSource, normalizedTarget)) {
    throw new Error(`复制目标不能位于源目录内部: ${normalizedTarget}`)
  }
}

export function isPathEqualOrInside(parentPath, candidatePath) {
  const relativePath = relative(resolve(parentPath), resolve(candidatePath))

  return (
    relativePath === '' ||
    (relativePath.length > 0 && !relativePath.startsWith('..') && !isAbsolute(relativePath))
  )
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
