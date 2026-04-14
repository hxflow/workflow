import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { resolve } from 'path'
import { tmpdir } from 'os'

import {
  resolveCommand,
  listCommands,
  resolveHooks,
  resolvePipeline,
} from '../../src/lib/command-resolver.ts'

const TEST_ROOT = resolve(tmpdir(), `hx-resolver-test-${Date.now()}`)
const PROJECT_ROOT = resolve(TEST_ROOT, 'project')

function ensureDir(dir: string) {
  mkdirSync(dir, { recursive: true })
}

function writeFile(path: string, content: string) {
  ensureDir(resolve(path, '..'))
  writeFileSync(path, content, 'utf8')
}

describe('command-resolver', () => {
  beforeEach(() => {
    ensureDir(PROJECT_ROOT)
  })

  afterEach(() => {
    rmSync(TEST_ROOT, { recursive: true, force: true })
  })

  describe('resolveCommand', () => {
    it('should resolve command from framework layer', () => {
      const result = resolveCommand('hx-doc', PROJECT_ROOT)
      // 框架层 src/commands/hx-doc.md 应该存在
      expect(result).not.toBeNull()
      expect(result!.layer).toBe('framework')
      expect(result!.name).toBe('hx-doc')
    })

    it('should resolve project layer command over framework', () => {
      const projectCmd = resolve(PROJECT_ROOT, '.hx', 'commands', 'hx-doc.md')
      writeFile(projectCmd, '---\nname: hx-doc\n---\n# Custom doc')

      const result = resolveCommand('hx-doc', PROJECT_ROOT)
      expect(result).not.toBeNull()
      expect(result!.layer).toBe('project')
      expect(result!.content).toContain('Custom doc')
    })

    it('should return null for non-existent command', () => {
      const result = resolveCommand('hx-nonexistent-cmd', PROJECT_ROOT)
      expect(result).toBeNull()
    })
  })

  describe('listCommands', () => {
    it('should list framework commands', () => {
      const commands = listCommands(PROJECT_ROOT)
      expect(commands.length).toBeGreaterThan(0)
      expect(commands.some((c) => c.name === 'hx-doc')).toBe(true)
      expect(commands.some((c) => c.name === 'hx-plan')).toBe(true)
    })

    it('should include project layer commands', () => {
      const projectCmd = resolve(PROJECT_ROOT, '.hx', 'commands', 'hx-custom.md')
      writeFile(projectCmd, '---\nname: hx-custom\n---\n# Custom')

      const commands = listCommands(PROJECT_ROOT)
      expect(commands.some((c) => c.name === 'hx-custom')).toBe(true)
    })

    it('should prioritize project layer over framework', () => {
      const projectCmd = resolve(PROJECT_ROOT, '.hx', 'commands', 'hx-doc.md')
      writeFile(projectCmd, '---\nname: hx-doc\n---\n# Project doc')

      const commands = listCommands(PROJECT_ROOT)
      const doc = commands.find((c) => c.name === 'hx-doc')
      expect(doc).not.toBeNull()
      expect(doc!.layer).toBe('project')
    })
  })

  describe('resolveHooks', () => {
    it('should find framework pre hooks', () => {
      const { pre, post } = resolveHooks('hx-doc', PROJECT_ROOT)
      // 框架层 src/hooks/pre_doc.md 存在
      expect(pre.length).toBeGreaterThan(0)
      expect(pre[0].layer).toBe('framework')
      expect(pre[0].phase).toBe('pre')
    })

    it('should collect hooks from all layers in correct order', () => {
      // 添加项目层 hook
      const projectHook = resolve(PROJECT_ROOT, '.hx', 'hooks', 'pre_doc.md')
      writeFile(projectHook, '# Project pre_doc hook')

      const { pre } = resolveHooks('hx-doc', PROJECT_ROOT)
      // pre: 框架 → 用户 → 项目
      expect(pre.length).toBeGreaterThanOrEqual(2)
      expect(pre[0].layer).toBe('framework')
      expect(pre[pre.length - 1].layer).toBe('project')
    })

    it('should return empty arrays for command without hooks', () => {
      const { pre, post } = resolveHooks('hx-nonexistent', PROJECT_ROOT)
      expect(pre).toEqual([])
      expect(post).toEqual([])
    })
  })

  describe('resolvePipeline', () => {
    it('should resolve default pipeline from framework', () => {
      const result = resolvePipeline('default', PROJECT_ROOT)
      expect(result).not.toBeNull()
      expect(result!.layer).toBe('framework')
      expect(result!.content).toContain('steps:')
    })

    it('should prioritize project pipeline', () => {
      const projectPipeline = resolve(PROJECT_ROOT, '.hx', 'pipelines', 'default.yaml')
      writeFile(projectPipeline, 'name: Custom pipeline\nsteps:\n  - id: test\n    name: Test\n    command: hx-test')

      const result = resolvePipeline('default', PROJECT_ROOT)
      expect(result).not.toBeNull()
      expect(result!.layer).toBe('project')
      expect(result!.content).toContain('Custom pipeline')
    })

    it('should return null for non-existent pipeline', () => {
      const result = resolvePipeline('nonexistent', PROJECT_ROOT)
      expect(result).toBeNull()
    })
  })
})
