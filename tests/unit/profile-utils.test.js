import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

import {
  extractRequirementInfo,
  getDefaultProfile,
  guessProfileFromTaskId,
  inferProfileFromRequirementDoc,
  loadProfile,
  parseArgs,
  parseProfileSpecifier,
  readHarnessConfig,
  renderTemplate
} from '../../scripts/lib/profile-utils.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const tempDirs = []

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop(), { recursive: true, force: true })
  }
})

describe('profile-utils', () => {
  it('parses positional arguments and long options', () => {
    const parsed = parseArgs(['feature-login', '--profile', 'backend', '--skip-install', '--task=123'])

    expect(parsed.positional).toEqual(['feature-login'])
    expect(parsed.options).toEqual({
      profile: 'backend',
      'skip-install': true,
      task: '123'
    })
  })

  it('parses valid profile specifiers and rejects invalid ones', () => {
    expect(parseProfileSpecifier('mobile:ios')).toMatchObject({
      profile: 'mobile:ios',
      team: 'mobile',
      platform: 'ios',
      platformLabel: 'iOS'
    })

    expect(() => parseProfileSpecifier('frontend:ios')).toThrow(/不需要平台后缀/)
    expect(() => parseProfileSpecifier('mobile:web')).toThrow(/无效的移动端平台/)
  })

  it('loads concrete profile data from repository files', () => {
    const profile = loadProfile(ROOT, 'mobile:ios')

    expect(profile.profile).toBe('mobile:ios')
    expect(profile.platformLabel).toBe('iOS')
    expect(profile.taskPrefix).toBe('TASK-IOS')
    expect(profile.files.requirementTemplatePath).toContain('profiles/mobile/requirement-template.md')
    expect(profile.architecture.layers.length).toBeGreaterThan(0)
  })

  it('reads configured default profile from harness.config.json', () => {
    const tempRoot = makeTempDir('profile-config-')
    writeFileSync(resolve(tempRoot, 'harness.config.json'), JSON.stringify({ defaultProfile: 'backend' }), 'utf8')

    expect(readHarnessConfig(tempRoot)).toEqual({ defaultProfile: 'backend' })
    expect(getDefaultProfile(tempRoot)).toBe('backend')
  })

  it('falls back to frontend when config is invalid', () => {
    const tempRoot = makeTempDir('profile-config-invalid-')
    writeFileSync(resolve(tempRoot, 'harness.config.json'), '{"defaultProfile":"unknown"}', 'utf8')

    expect(getDefaultProfile(tempRoot)).toBe('frontend')
  })

  it('infers profile from requirement document labels', () => {
    const tempRoot = makeTempDir('profile-doc-')
    mkdirSync(resolve(tempRoot, 'docs/requirement'), { recursive: true })
    writeFileSync(
      resolve(tempRoot, 'docs/requirement/mobile-login.md'),
      '# 需求\n> 团队：移动端｜平台：HarmonyOS (鸿蒙)\n',
      'utf8'
    )

    expect(inferProfileFromRequirementDoc(tempRoot, 'mobile-login')).toBe('mobile:harmony')
  })

  it('extracts AC items and checked layers from requirement content', () => {
    const requirement = extractRequirementInfo(`
- AC-001: 返回 200
- AC-002: 返回 400

## 影响的架构层级
- [x] Services — src/services/
- [X] Hooks - src/hooks/
`)

    expect(requirement.acs).toEqual([
      { id: 'AC-001', text: '返回 200' },
      { id: 'AC-002', text: '返回 400' }
    ])
    expect(requirement.checkedLayers).toEqual(['Services', 'Hooks'])
  })

  it('renders placeholders with brace and bracket forms', () => {
    const output = renderTemplate('Hello {feature-name} [FeatureName] feature-name', {
      'feature-name': 'order-list',
      FeatureName: 'OrderList'
    })

    expect(output).toBe('Hello order-list OrderList order-list')
  })

  it('maps task ids back to default profiles', () => {
    expect(guessProfileFromTaskId('TASK-BE-01')).toBe('backend')
    expect(guessProfileFromTaskId('TASK-IOS-02')).toBe('mobile:ios')
    expect(guessProfileFromTaskId('TASK-XX-01')).toBeNull()
  })
})

function makeTempDir(prefix) {
  const dir = mkdtempSync(resolve(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}
