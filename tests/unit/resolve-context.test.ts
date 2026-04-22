import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'

import { afterEach, describe, expect, it } from 'bun:test'

import { findProjectRoot } from '../../hxflow/scripts/lib/resolve-context.ts'

const tempDirs: string[] = []

function createTempDir(prefix: string) {
  const dir = mkdtempSync(resolve(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true })
  }
})

describe('resolve-context', () => {
  it('prefers .hx/config.yaml over .git when finding project root', () => {
    const root = createTempDir('hx-project-root-')
    const nested = resolve(root, 'packages', 'app', 'src')

    mkdirSync(resolve(root, '.hx'), { recursive: true })
    mkdirSync(resolve(root, '.git'), { recursive: true })
    mkdirSync(nested, { recursive: true })
    writeFileSync(resolve(root, '.hx', 'config.yaml'), 'paths:\n  src: src\n')

    expect(findProjectRoot(nested)).toBe(root)
  })

  it('falls back to nearest .git directory and then start dir', () => {
    const root = createTempDir('hx-git-root-')
    const nested = resolve(root, 'packages', 'app')
    const standalone = createTempDir('hx-standalone-')

    mkdirSync(resolve(root, '.git'), { recursive: true })
    mkdirSync(nested, { recursive: true })

    expect(findProjectRoot(nested)).toBe(root)
    expect(findProjectRoot(standalone)).toBe(standalone)
  })

  it('rejects a directory that is both workspace and project', () => {
    const root = createTempDir('hx-conflict-root-')
    const nested = resolve(root, 'src')

    mkdirSync(resolve(root, '.hx'), { recursive: true })
    mkdirSync(nested, { recursive: true })
    writeFileSync(resolve(root, '.hx', 'config.yaml'), 'paths:\n  src: src\n')
    writeFileSync(resolve(root, '.hx', 'workspace.yaml'), 'version: 1\nprojects: []\n')

    expect(() => findProjectRoot(nested)).toThrow('同时存在 .hx/config.yaml 与 .hx/workspace.yaml')
  })
})
