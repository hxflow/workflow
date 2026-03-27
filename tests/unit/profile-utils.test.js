import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

import {
  parseArgs,
  parseProfileSpecifier,
  loadProfile,
  parseSimpleYaml
} from '../../src/scripts/lib/profile-utils.js'

import { FRAMEWORK_ROOT } from '../../src/scripts/lib/resolve-context.js'

const tempDirs = []

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop(), { recursive: true, force: true })
  }
})

function makeTempDir(prefix) {
  const dir = mkdtempSync(resolve(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

// ── parseArgs ──────────────────────────────────────────────────────────────

describe('parseArgs', () => {
  it('解析位置参数和长选项', () => {
    const { positional, options } = parseArgs(['feature-login', '--profile', 'base', '--skip', '--task=123'])

    expect(positional).toEqual(['feature-login'])
    expect(options).toEqual({ profile: 'base', skip: true, task: '123' })
  })

  it('解析短标志 -p 为 profile', () => {
    const { options } = parseArgs(['-p', 'my-team'])
    expect(options.profile).toBe('my-team')
  })

  it('解析短标志 -y 为布尔值 true', () => {
    const { options } = parseArgs(['-y'])
    expect(options.yes).toBe(true)
  })

  it('解析短标志 -h 为布尔值 true', () => {
    const { options } = parseArgs(['-h'])
    expect(options.help).toBe(true)
  })

  it('解析短标志 -t 为 target', () => {
    const { options } = parseArgs(['-t', '/tmp/project'])
    expect(options.target).toBe('/tmp/project')
  })

  it('解析 --key=value 语法', () => {
    const { options } = parseArgs(['--profile=go-ddd'])
    expect(options.profile).toBe('go-ddd')
  })

  it('解析无值的布尔标志', () => {
    const { options } = parseArgs(['--dry-run', '--verbose'])
    expect(options['dry-run']).toBe(true)
    expect(options.verbose).toBe(true)
  })

  it('空参数返回空数组和空对象', () => {
    const { positional, options } = parseArgs([])
    expect(positional).toEqual([])
    expect(options).toEqual({})
  })

  it('多个位置参数均被收集', () => {
    const { positional } = parseArgs(['feature-a', 'TASK-01', '--profile', 'base'])
    expect(positional).toEqual(['feature-a', 'TASK-01'])
  })
})

// ── parseProfileSpecifier ──────────────────────────────────────────────────

describe('parseProfileSpecifier', () => {
  it('解析 base', () => {
    const result = parseProfileSpecifier('base')
    expect(result).toMatchObject({ profile: 'base', team: 'base', platform: null })
  })

  it('解析自定义 profile 名称', () => {
    const result = parseProfileSpecifier('my-team')
    expect(result).toMatchObject({ profile: 'my-team', team: 'my-team', platform: null })
  })

  it('允许包含冒号的共享 profile 名称', () => {
    const result = parseProfileSpecifier('ios:swiftui')
    expect(result).toMatchObject({
      profile: 'ios:swiftui',
      team: 'ios:swiftui',
      platform: null,
      platformLabel: null
    })
  })

  it('禁止包含路径分隔符', () => {
    expect(() => parseProfileSpecifier('../secrets')).toThrow(/无效的 profile/)
    expect(() => parseProfileSpecifier('foo/bar')).toThrow(/无效的 profile/)
  })

  it('禁止使用 . 和 ..', () => {
    expect(() => parseProfileSpecifier('.')).toThrow(/无效的 profile/)
    expect(() => parseProfileSpecifier('..')).toThrow(/无效的 profile/)
  })

  it('空字符串返回 null', () => {
    expect(parseProfileSpecifier('')).toBeNull()
    expect(parseProfileSpecifier(null)).toBeNull()
    expect(parseProfileSpecifier(undefined)).toBeNull()
  })
})

// ── parseSimpleYaml ────────────────────────────────────────────────────────

describe('parseSimpleYaml', () => {
  it('解析简单键值对', () => {
    const result = parseSimpleYaml('name: base\nversion: 1\n')
    expect(result).toEqual({ name: 'base', version: 1 })
  })

  it('解析布尔值', () => {
    const result = parseSimpleYaml('enabled: true\ndisabled: false\n')
    expect(result).toEqual({ enabled: true, disabled: false })
  })

  it('解析 null 值', () => {
    const result = parseSimpleYaml('value: null\n')
    expect(result.value).toBeNull()
  })

  it('解析数字', () => {
    const result = parseSimpleYaml('count: 42\nrate: 3.14\nneg: -5\n')
    expect(result).toEqual({ count: 42, rate: 3.14, neg: -5 })
  })

  it('解析带引号的字符串', () => {
    const result = parseSimpleYaml('greeting: "hello world"\nname: \'foo bar\'\n')
    expect(result).toEqual({ greeting: 'hello world', name: 'foo bar' })
  })

  it('解析嵌套对象', () => {
    const result = parseSimpleYaml('paths:\n  src: src/\n  test: test/\n')
    expect(result).toEqual({ paths: { src: 'src/', test: 'test/' } })
  })

  it('解析数组', () => {
    const result = parseSimpleYaml('layers:\n  - hooks\n  - services\n  - types\n')
    expect(result).toEqual({ layers: ['hooks', 'services', 'types'] })
  })

  it('忽略注释行', () => {
    const result = parseSimpleYaml('# 这是注释\nname: base\n# 另一行注释\n')
    expect(result).toEqual({ name: 'base' })
  })

  it('行内注释被忽略', () => {
    const result = parseSimpleYaml('name: base # 行内注释\n')
    expect(result).toEqual({ name: 'base' })
  })

  it('空内容返回空对象', () => {
    expect(parseSimpleYaml('')).toEqual({})
    expect(parseSimpleYaml('# 只有注释\n')).toEqual({})
  })

  it('解析内联数组', () => {
    const result = parseSimpleYaml('tags: [a, b, c]\n')
    expect(result).toEqual({ tags: ['a', 'b', 'c'] })
  })

  it('frameworkRoot 配置文件可正常解析', () => {
    const yaml = `# Harness Workflow 用户全局配置\nframeworkRoot: /Users/test/.hx\n`
    const result = parseSimpleYaml(yaml)
    expect(result.frameworkRoot).toBe('/Users/test/.hx')
  })
})

// ── loadProfile ────────────────────────────────────────────────────────────

describe('loadProfile', () => {
  it('加载内置 base profile', () => {
    const profile = loadProfile(FRAMEWORK_ROOT, 'base')
    expect(profile.team).toBe('base')
    expect(profile.profile).toBe('base')
    expect(profile.label).toBeTruthy()
    expect(typeof profile.gateCommands).toBe('object')
  })

  it('未传 specifier 时默认加载 base', () => {
    const profile = loadProfile(FRAMEWORK_ROOT)
    expect(profile.team).toBe('base')
    expect(profile.profile).toBe('base')
  })

  it('加载 searchRoots 中的自定义 profile', () => {
    const customRoot = makeTempDir('load-profile-custom-only-')
    const profileDir = resolve(customRoot, 'profiles', 'my-team')
    mkdirSync(profileDir, { recursive: true })
    writeFileSync(resolve(profileDir, 'profile.yaml'), [
      'label: My Team',
      'task_prefix: MT'
    ].join('\n'), 'utf8')

    const profile = loadProfile(FRAMEWORK_ROOT, 'my-team', {
      searchRoots: [customRoot, FRAMEWORK_ROOT]
    })

    expect(profile.team).toBe('my-team')
    expect(profile.profile).toBe('my-team')
    expect(profile.label).toBe('My Team')
  })

  it('自定义 profile 未声明 label 时回退为 profile 名称', () => {
    const customRoot = makeTempDir('load-profile-no-label-')
    const profileDir = resolve(customRoot, 'profiles', 'my-team')
    mkdirSync(profileDir, { recursive: true })
    writeFileSync(resolve(profileDir, 'profile.yaml'), 'task_prefix: MT\n', 'utf8')

    const profile = loadProfile(FRAMEWORK_ROOT, 'my-team', {
      searchRoots: [customRoot, FRAMEWORK_ROOT]
    })

    expect(profile.label).toBe('my-team')
  })

  it('返回 files 对象，包含 profilePath 等路径', () => {
    const profile = loadProfile(FRAMEWORK_ROOT, 'base')
    expect(profile.files).toBeTruthy()
    expect(profile.files.profilePath).toContain('profile.yaml')
    expect(profile.files.requirementTemplatePath).toContain('requirement-template.md')
    expect(profile.files.planTemplatePath).toContain('plan-template.md')
    expect(profile.files.reviewChecklistPath).toContain('review-checklist.md')
    expect(profile.files.goldenRulesPath).toContain('golden-rules.md')
  })

  it('自定义 profile 文件不存在时抛出错误', () => {
    expect(() => loadProfile(FRAMEWORK_ROOT, 'nonexistent-team')).toThrow(/profile 文件不存在/)
  })

  it('通过 searchRoots 选项支持自定义查找路径', () => {
    const customRoot = makeTempDir('load-profile-custom-')
    const profileDir = resolve(customRoot, 'profiles', 'myteam')
    mkdirSync(profileDir, { recursive: true })
    writeFileSync(resolve(profileDir, 'profile.yaml'), [
      'label: My Team',
      'task_prefix: MT',
      'gate_commands:',
      '  lint: echo lint-ok'
    ].join('\n'), 'utf8')

    const profile = loadProfile(FRAMEWORK_ROOT, 'myteam', {
      searchRoots: [customRoot, FRAMEWORK_ROOT]
    })

    expect(profile.team).toBe('myteam')
    expect(profile.label).toBe('My Team')
    expect(profile.taskPrefix).toBe('MT')
  })
})
