import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'

import { afterEach, describe, expect, it } from 'bun:test'

import { findProjectRoot } from '../../src/lib/resolve-context.ts'

const tempDirs = []

function createTempDir(prefix) {
  const dir = mkdtempSync(resolve(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop(), { recursive: true, force: true })
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
})
