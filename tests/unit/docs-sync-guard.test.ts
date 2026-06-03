import { describe, expect, it } from 'bun:test'

import { guardDocsSync, isGitCommitCommand } from '../../.agents/hooks/docs-sync-agent-hook.ts'

describe('docs sync agent hook', () => {
  it('only applies the hook behavior to git commit commands', () => {
    expect(isGitCommitCommand('git commit -m "msg"')).toBe(true)
    expect(isGitCommitCommand('git status --short')).toBe(false)
    expect(isGitCommitCommand('npm run hx:test')).toBe(false)
  })

  it('allows commits without hxflow changes', () => {
    const result = guardDocsSync('/repo', [
      'README.md',
      'tests/unit/example.test.ts',
    ])

    expect(result.ok).toBe(true)
    expect(result.applies).toBe(false)
    expect(result.hxflowFiles).toEqual([])
    expect(result.docsFiles).toEqual([])
  })

  it('blocks hxflow updates when docs are not staged', () => {
    const result = guardDocsSync('/repo', [
      'hxflow/scripts/lib/hook.ts',
      'tests/unit/hx-hook-script.test.ts',
    ])

    expect(result.ok).toBe(false)
    expect(result.applies).toBe(true)
    expect(result.hxflowFiles).toEqual(['hxflow/scripts/lib/hook.ts'])
    expect(result.docsFiles).toEqual([])
    expect(result.errors).toContain('检测到 hxflow 更新，但本次提交没有同步 docs/ 文档')
  })

  it('allows hxflow updates when docs are staged together', () => {
    const result = guardDocsSync('/repo', [
      'hxflow/scripts/lib/hook.ts',
      'docs/index.html',
      'docs/index.zh.html',
    ])

    expect(result.ok).toBe(true)
    expect(result.applies).toBe(true)
    expect(result.hxflowFiles).toEqual(['hxflow/scripts/lib/hook.ts'])
    expect(result.docsFiles).toEqual(['docs/index.html', 'docs/index.zh.html'])
  })
})
