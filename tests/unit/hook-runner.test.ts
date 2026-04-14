import { describe, expect, it } from 'vitest'

import {
  discoverHooks,
  applyHookResult,
  getPreHookContext,
} from '../../src/lib/hook-runner.ts'

const DUMMY_PROJECT = '/tmp/hx-hook-test-dummy'

describe('hook-runner', () => {
  describe('discoverHooks', () => {
    it('should discover pre hooks for hx-doc', () => {
      const info = discoverHooks('hx-doc', DUMMY_PROJECT)
      expect(info.command).toBe('hx-doc')
      expect(info.pre.length).toBeGreaterThan(0)
      expect(info.pre[0].phase).toBe('pre')
      expect(info.pre[0].content).toContain('pre_doc')
    })

    it('should discover pre hooks for hx-fix', () => {
      const info = discoverHooks('hx-fix', DUMMY_PROJECT)
      expect(info.pre.length).toBeGreaterThan(0)
      expect(info.pre[0].content).toContain('pre_fix')
    })

    it('should return empty for command without hooks', () => {
      const info = discoverHooks('hx-nonexistent', DUMMY_PROJECT)
      expect(info.pre).toEqual([])
      expect(info.post).toEqual([])
    })
  })

  describe('getPreHookContext', () => {
    it('should build pre hook context', () => {
      const ctx = getPreHookContext({
        command: 'hx-doc',
        projectRoot: DUMMY_PROJECT,
        feature: 'AUTH-001',
        arguments: { raw: 'context AUTH-001', positional: ['context', 'AUTH-001'], options: {} },
        paths: { requirement: 'docs/requirement/AUTH-001.md' },
        gates: { test: 'npm run hx:test' },
        context: { extra: 'data' },
      })

      expect(ctx.phase).toBe('pre')
      expect(ctx.hooksFound).toBeGreaterThan(0)
      expect(ctx.context).toEqual({ extra: 'data' })
    })
  })

  describe('applyHookResult', () => {
    it('should merge patch into context', () => {
      const current = { context: { a: 1 }, paths: { x: '/tmp' } }
      const result = applyHookResult(current, {
        patch: { context: { b: 2 } },
      })

      expect(result.context.context).toEqual({ a: 1, b: 2 })
      expect(result.abort).toBe(false)
      expect(result.warnings).toEqual([])
    })

    it('should handle abort', () => {
      const result = applyHookResult({}, {
        abort: true,
        message: 'Pre-condition failed',
        warnings: ['Something off'],
      })

      expect(result.abort).toBe(true)
      expect(result.message).toBe('Pre-condition failed')
      expect(result.warnings).toEqual(['Something off'])
    })

    it('should handle empty hook result', () => {
      const current = { foo: 'bar' }
      const result = applyHookResult(current, {})

      expect(result.context).toEqual({ foo: 'bar' })
      expect(result.abort).toBe(false)
    })
  })
})
