import { describe, expect, it } from 'bun:test'
import { parseFeatureHeader, parseFeatureHeaderFile } from '../../hxflow/scripts/lib/feature-header.ts'
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const VALID_HEADER = `# 用户登录功能需求

> Feature: AUTH-001
> Display Name: 用户登录功能
> Source ID: JIRA-100
> Source Fingerprint: abc123
> Type: feature

## 背景

正文内容
`

describe('parseFeatureHeader', () => {
  it('parses a valid 5-field header', () => {
    const result = parseFeatureHeader(VALID_HEADER)
    expect(result.feature).toBe('AUTH-001')
    expect(result.displayName).toBe('用户登录功能')
    expect(result.sourceId).toBe('JIRA-100')
    expect(result.sourceFingerprint).toBe('abc123')
    expect(result.type).toBe('feature')
  })

  it('throws when Feature field is missing', () => {
    const doc = `# Title\n> Display Name: foo\n> Source ID: bar\n> Source Fingerprint: baz\n> Type: feature\n`
    expect(() => parseFeatureHeader(doc)).toThrow()
  })

  it('throws when Display Name field is missing', () => {
    const doc = `# Title\n> Feature: AUTH-001\n> Source ID: bar\n> Source Fingerprint: baz\n> Type: feature\n`
    expect(() => parseFeatureHeader(doc)).toThrow()
  })

  it('throws when Feature value is empty', () => {
    const doc = `# Title\n> Feature: \n> Display Name: foo\n> Source ID: bar\n> Source Fingerprint: baz\n> Type: feature\n`
    expect(() => parseFeatureHeader(doc)).toThrow(/Feature/)
  })

  it('throws when header fields are absent', () => {
    const doc = 'Feature: AUTH-001\nTitle: Test\n'
    expect(() => parseFeatureHeader(doc)).toThrow()
  })

  it('returns all 5 required fields when present', () => {
    const result = parseFeatureHeader(VALID_HEADER)
    expect(Object.keys(result)).toContain('feature')
    expect(Object.keys(result)).toContain('displayName')
    expect(Object.keys(result)).toContain('sourceId')
    expect(Object.keys(result)).toContain('sourceFingerprint')
    expect(Object.keys(result)).toContain('type')
  })

  it('throws on duplicate field', () => {
    const doc = `# Title\n> Feature: AUTH-001\n> Feature: AUTH-002\n> Display Name: foo\n> Source ID: bar\n> Source Fingerprint: baz\n> Type: feature\n`
    expect(() => parseFeatureHeader(doc)).toThrow(/重复/)
  })

  it('does not read header-like quotes from body sections', () => {
    const doc = `# Title

> Feature: AUTH-001
> Display Name: foo
> Source ID: bar
> Source Fingerprint: baz

## 示例

> Type: body-quote
`

    expect(() => parseFeatureHeader(doc)).toThrow(/缺少字段/)
  })

  it('throws on unknown quoted header field before first section', () => {
    const doc = `# Title

> Feature: AUTH-001
> Display Name: foo
> Extra: nope
> Source ID: bar
> Source Fingerprint: baz
> Type: feature
`

    expect(() => parseFeatureHeader(doc)).toThrow(/未知头部字段/)
  })

  it('throws on invalid Type value', () => {
    const doc = `# Title

> Feature: AUTH-001
> Display Name: foo
> Source ID: bar
> Source Fingerprint: baz
> Type: invalid
`

    expect(() => parseFeatureHeader(doc)).toThrow(/Type/)
  })

  it('accepts bugfix as valid Type', () => {
    const doc = `# Title

> Feature: AUTH-001
> Display Name: foo
> Source ID: bar
> Source Fingerprint: baz
> Type: bugfix
`

    const result = parseFeatureHeader(doc)
    expect(result.type).toBe('bugfix')
  })

  it('handles Type case insensitively', () => {
    const doc = `# Title

> Feature: AUTH-001
> Display Name: foo
> Source ID: bar
> Source Fingerprint: baz
> Type: Feature
`

    const result = parseFeatureHeader(doc)
    expect(result.type).toBe('feature')
  })
})

describe('parseFeatureHeaderFile', () => {
  let tmpDir

  it('reads and parses a valid file', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'hxflow-test-'))
    const filePath = join(tmpDir, 'req.md')
    writeFileSync(filePath, VALID_HEADER, 'utf8')

    const result = parseFeatureHeaderFile(filePath)
    expect(result.feature).toBe('AUTH-001')

    rmSync(tmpDir, { recursive: true })
  })

  it('throws when file does not exist', () => {
    expect(() => parseFeatureHeaderFile('/nonexistent/path/doc.md')).toThrow()
  })
})
