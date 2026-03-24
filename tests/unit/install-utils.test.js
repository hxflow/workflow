import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, readlinkSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'

import {
  assertCopyTargetSafe,
  assertInstallTargetSafe,
  collectTokenStatuses,
  createInstallEnv,
  detectPackageManager,
  ensureClaudeEntrypointLink,
  findConfiguredKey,
  isPathEqualOrInside
} from '../../scripts/lib/install-utils.js'

const tempDirs = []
const originalEnv = {
  GITLAB_TOKEN: process.env.GITLAB_TOKEN,
  DEVOPS_API_KEY: process.env.DEVOPS_API_KEY,
  WUSHUANG_API_TOKEN: process.env.WUSHUANG_API_TOKEN,
  NPM_CONFIG_CACHE: process.env.NPM_CONFIG_CACHE
}

beforeEach(() => {
  delete process.env.GITLAB_TOKEN
  delete process.env.DEVOPS_API_KEY
  delete process.env.WUSHUANG_API_TOKEN
  delete process.env.NPM_CONFIG_CACHE
})

afterEach(() => {
  process.env.GITLAB_TOKEN = originalEnv.GITLAB_TOKEN
  process.env.DEVOPS_API_KEY = originalEnv.DEVOPS_API_KEY
  process.env.WUSHUANG_API_TOKEN = originalEnv.WUSHUANG_API_TOKEN
  process.env.NPM_CONFIG_CACHE = originalEnv.NPM_CONFIG_CACHE

  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop(), { recursive: true, force: true })
  }
})

describe('install-utils', () => {
  it('detects package manager from lockfiles', () => {
    const tempRoot = makeTempDir('install-pm-')
    writeFileSync(resolve(tempRoot, 'yarn.lock'), '', 'utf8')

    expect(detectPackageManager(tempRoot)).toEqual({ name: 'yarn', installCommand: 'yarn install' })
  })

  it('finds configured keys from environment files', () => {
    const tempRoot = makeTempDir('install-env-file-')
    writeFileSync(resolve(tempRoot, '.env.local'), 'DEVOPS_API_KEY=abc123\n', 'utf8')

    expect(findConfiguredKey(tempRoot, ['DEVOPS_API_KEY'])).toEqual({
      key: 'DEVOPS_API_KEY',
      source: '.env.local'
    })
  })

  it('collects token statuses from env and files', () => {
    const tempRoot = makeTempDir('install-status-')
    process.env.GITLAB_TOKEN = 'gitlab-secret'
    writeFileSync(resolve(tempRoot, '.env'), 'WUSHUANG_API_TOKEN=ws-secret\n', 'utf8')

    const statuses = collectTokenStatuses(tempRoot)

    expect(statuses[0].matched).toEqual({ key: 'GITLAB_TOKEN', source: 'env' })
    expect(statuses[1].matched).toEqual({ key: 'WUSHUANG_API_TOKEN', source: '.env' })
  })

  it('creates .CLAUDE.md symlink and does not overwrite existing files', () => {
    const tempRoot = makeTempDir('install-claude-link-')
    const summary = { created: [], skipped: [], warnings: [] }

    ensureClaudeEntrypointLink(tempRoot, summary)
    expect(readlinkSync(resolve(tempRoot, '.CLAUDE.md'))).toBe('AGENTS.md')
    expect(summary.created).toContain('.CLAUDE.md -> AGENTS.md')

    writeFileSync(resolve(tempRoot, '.CLAUDE.md.real'), 'custom', 'utf8')
    rmSync(resolve(tempRoot, '.CLAUDE.md'), { force: true })
    writeFileSync(resolve(tempRoot, '.CLAUDE.md'), 'custom', 'utf8')

    const secondSummary = { created: [], skipped: [], warnings: [] }
    ensureClaudeEntrypointLink(tempRoot, secondSummary)

    expect(secondSummary.warnings[0]).toMatch(/现有 \.CLAUDE\.md/)
  })

  it('creates npm cache in tmp dir when needed', () => {
    const installEnv = createInstallEnv({ name: 'npm' })

    expect(installEnv.NPM_CONFIG_CACHE).toContain('harness-workflow-framework')
  })

  it('detects whether a path is equal to or inside another path', () => {
    const sourceRoot = makeTempDir('install-source-root-')
    const nestedRoot = resolve(sourceRoot, 'scripts')
    const outsideRoot = resolve(tmpdir(), `outside-${Date.now()}`)

    expect(isPathEqualOrInside(sourceRoot, sourceRoot)).toBe(true)
    expect(isPathEqualOrInside(sourceRoot, nestedRoot)).toBe(true)
    expect(isPathEqualOrInside(sourceRoot, outsideRoot)).toBe(false)
  })

  it('rejects install targets inside the scaffold source tree', () => {
    const sourceRoot = makeTempDir('install-source-tree-')

    expect(() => assertInstallTargetSafe(sourceRoot, sourceRoot)).toThrow(/框架模板自身/)
    expect(() => assertInstallTargetSafe(resolve(sourceRoot, 'scripts'), sourceRoot)).toThrow(/模板目录内/)
    expect(() => assertInstallTargetSafe(makeTempDir('install-target-'), sourceRoot)).not.toThrow()
  })

  it('rejects copy targets nested inside their source directory', () => {
    const sourceRoot = makeTempDir('install-copy-source-')

    expect(() => assertCopyTargetSafe(sourceRoot, resolve(sourceRoot, 'scripts'))).toThrow(/源目录内部/)
    expect(() => assertCopyTargetSafe(sourceRoot, makeTempDir('install-copy-target-'))).not.toThrow()
  })
})

function makeTempDir(prefix) {
  const dir = mkdtempSync(resolve(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}
