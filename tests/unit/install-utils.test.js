import { afterEach, describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'

import {
  HARNESS_MARKER_START,
  HARNESS_MARKER_END,
  buildHarnessBlock,
  escapeRegExp,
  generateCodexSkillFiles,
  generateForwarderFiles,
  loadCommandSpecs,
  resolveAgentTargets,
} from '../../src/scripts/lib/install-utils.js'

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

// ── buildHarnessBlock ──────────────────────────────────────────────────────

describe('buildHarnessBlock', () => {
  it('包含开始和结束标记', () => {
    const block = buildHarnessBlock('base')
    expect(block).toContain(HARNESS_MARKER_START)
    expect(block).toContain(HARNESS_MARKER_END)
  })

  it('包含传入的 profile 名称', () => {
    expect(buildHarnessBlock('base')).toContain('base')
    expect(buildHarnessBlock('my-team')).toContain('my-team')
    expect(buildHarnessBlock('go-ddd')).toContain('go-ddd')
  })

  it('包含 Claude 和 Codex 的统一命令说明', () => {
    const block = buildHarnessBlock('base')
    expect(block).toContain('标准命令')
    expect(block).toContain('Claude: 使用')
    expect(block).toContain('Codex: 使用')
  })

  it('以开始标记开头、以结束标记结尾', () => {
    const block = buildHarnessBlock('base')
    expect(block.startsWith(HARNESS_MARKER_START)).toBe(true)
    expect(block.endsWith(HARNESS_MARKER_END)).toBe(true)
  })

  it('不同 profile 生成不同内容', () => {
    expect(buildHarnessBlock('base')).not.toBe(buildHarnessBlock('my-team'))
  })

  it('根据 requirementDoc 和 planDoc 模板展示实际目录', () => {
    const block = buildHarnessBlock('go-ddd', {
      requirementDoc: '业务线/香港/需求/{feature}/资料/需求.md',
      planDoc: '业务线/香港/需求/{feature}/任务/{taskId}/任务执行.md',
    })

    expect(block).toContain('Profile: `go-ddd`')
    expect(block).toContain('需求文档: `业务线/香港/需求/{feature}/资料/`')
    expect(block).toContain('执行计划: `业务线/香港/需求/{feature}/任务/{taskId}/`')
  })
})

// ── escapeRegExp ───────────────────────────────────────────────────────────

describe('escapeRegExp', () => {
  it('转义正则特殊字符', () => {
    expect(escapeRegExp('.')).toBe('\\.')
    expect(escapeRegExp('*')).toBe('\\*')
    expect(escapeRegExp('+')).toBe('\\+')
    expect(escapeRegExp('?')).toBe('\\?')
    expect(escapeRegExp('^')).toBe('\\^')
    expect(escapeRegExp('$')).toBe('\\$')
    expect(escapeRegExp('[')).toBe('\\[')
    expect(escapeRegExp(']')).toBe('\\]')
    expect(escapeRegExp('(')).toBe('\\(')
    expect(escapeRegExp(')')).toBe('\\)')
    expect(escapeRegExp('{')).toBe('\\{')
    expect(escapeRegExp('}')).toBe('\\}')
    expect(escapeRegExp('|')).toBe('\\|')
    expect(escapeRegExp('\\')).toBe('\\\\')
  })

  it('普通字符串不被修改', () => {
    expect(escapeRegExp('hello_world')).toBe('hello_world')
    expect(escapeRegExp('hxflow123')).toBe('hxflow123')
  })

  it('marker 字符串可以安全用于 RegExp', () => {
    const escaped = escapeRegExp(HARNESS_MARKER_START)
    expect(() => new RegExp(escaped)).not.toThrow()
  })
})

// ── resolveAgentTargets ────────────────────────────────────────────────────

describe('resolveAgentTargets', () => {
  it('默认返回全部 agent', () => {
    expect(resolveAgentTargets()).toEqual(['claude', 'codex'])
    expect(resolveAgentTargets('all')).toEqual(['claude', 'codex'])
  })

  it('支持单个 agent 和逗号分隔 agent', () => {
    expect(resolveAgentTargets('claude')).toEqual(['claude'])
    expect(resolveAgentTargets('codex')).toEqual(['codex'])
    expect(resolveAgentTargets('claude,codex')).toEqual(['claude', 'codex'])
  })

  it('非法 agent 抛错', () => {
    expect(() => resolveAgentTargets('unknown')).toThrow(/无效的 agent/)
  })
})

// ── loadCommandSpecs ───────────────────────────────────────────────────────

describe('loadCommandSpecs', () => {
  it('解析命令 frontmatter', () => {
    const sourceDir = makeTempDir('spec-src-')
    writeFileSync(resolve(sourceDir, 'hx-run.md'), [
      '---',
      'name: hx-run',
      'description: Phase 04 · 执行任务',
      'usage: hx-run <feature> <task-id> [--profile <name>]',
      'claude: /hx-run',
      'codex: hx-run',
      '---',
      '',
      '# hx-run',
      ''
    ].join('\n'), 'utf8')

    const specs = loadCommandSpecs(sourceDir)
    expect(specs).toHaveLength(1)
    expect(specs[0]).toMatchObject({
      name: 'hx-run',
      description: 'Phase 04 · 执行任务',
      usage: 'hx-run <feature> <task-id> [--profile <name>]',
      claude: '/hx-run',
      codex: 'hx-run',
    })
  })

  it('保留 hx-plan 的可选 feature 用法', () => {
    const sourceDir = makeTempDir('spec-plan-src-')
    writeFileSync(resolve(sourceDir, 'hx-plan.md'), [
      '---',
      'name: hx-plan',
      'description: Phase 02 · 生成执行计划',
      'usage: hx-plan [<feature-name>] [--profile <name>]',
      'claude: /hx-plan',
      'codex: hx-plan',
      '---',
      '',
      '# hx-plan',
      ''
    ].join('\n'), 'utf8')

    const specs = loadCommandSpecs(sourceDir)
    expect(specs[0]?.usage).toBe('hx-plan [<feature-name>] [--profile <name>]')
  })
})

// ── generateForwarderFiles ─────────────────────────────────────────────────

describe('generateForwarderFiles', () => {
  it('为 sourceDir 中每个 hx-*.md 创建转发器文件', () => {
    const sourceDir = makeTempDir('gen-src-')
    const targetDir = makeTempDir('gen-dst-')
    writeFileSync(resolve(sourceDir, 'hx-run.md'), '# hx-run entity', 'utf8')
    writeFileSync(resolve(sourceDir, 'hx-plan.md'), '# hx-plan entity', 'utf8')
    writeFileSync(resolve(sourceDir, 'not-hx.md'), '# should be ignored', 'utf8')
    writeFileSync(resolve(sourceDir, 'hx-run.txt'), '# wrong extension', 'utf8')

    const summary = { created: [], updated: [], skipped: [], warnings: [] }
    generateForwarderFiles(sourceDir, targetDir, '/fw', '/user-hx', summary, {})

    expect(existsSync(resolve(targetDir, 'hx-run.md'))).toBe(true)
    expect(existsSync(resolve(targetDir, 'hx-plan.md'))).toBe(true)
    expect(existsSync(resolve(targetDir, 'not-hx.md'))).toBe(false)
    expect(existsSync(resolve(targetDir, 'hx-run.txt'))).toBe(false)
    expect(summary.created).toContain('~/.claude/commands/hx-run.md')
    expect(summary.created).toContain('~/.claude/commands/hx-plan.md')
  })

  it('转发器内容包含三层查找路径', () => {
    const sourceDir = makeTempDir('gen-content-src-')
    const targetDir = makeTempDir('gen-content-dst-')
    writeFileSync(resolve(sourceDir, 'hx-run.md'), '# hx-run', 'utf8')

    const summary = { created: [], updated: [], skipped: [], warnings: [] }
    generateForwarderFiles(sourceDir, targetDir, '/framework', '/user-hx', summary, {})

    const content = readFileSync(resolve(targetDir, 'hx-run.md'), 'utf8')
    expect(content).toContain('.hx/commands/hx-run.md')       // 项目层
    expect(content).toContain('/user-hx/commands/hx-run.md') // 用户层
    expect(content).toContain('/framework')                    // 系统层
  })

  it('文件无变化时放入 skipped，不放 created', () => {
    const sourceDir = makeTempDir('gen-skip-src-')
    const targetDir = makeTempDir('gen-skip-dst-')
    writeFileSync(resolve(sourceDir, 'hx-run.md'), '# hx-run', 'utf8')

    const summary1 = { created: [], updated: [], skipped: [], warnings: [] }
    generateForwarderFiles(sourceDir, targetDir, '/fw', '/user-hx', summary1, {})

    const summary2 = { created: [], updated: [], skipped: [], warnings: [] }
    generateForwarderFiles(sourceDir, targetDir, '/fw', '/user-hx', summary2, {})

    expect(summary2.skipped.length).toBe(1)
    expect(summary2.created.length).toBe(0)
  })

  it('sourceDir 不存在时写入 warnings', () => {
    const targetDir = makeTempDir('gen-nosrc-dst-')
    const summary = { created: [], updated: [], skipped: [], warnings: [] }
    generateForwarderFiles('/nonexistent/commands', targetDir, '/fw', '/user-hx', summary, {})

    expect(summary.warnings.length).toBeGreaterThan(0)
    expect(summary.created.length).toBe(0)
  })

  it('targetDir 不存在且 createDir=false 时写入 warnings', () => {
    const sourceDir = makeTempDir('gen-nodst-src-')
    writeFileSync(resolve(sourceDir, 'hx-run.md'), '# hx-run', 'utf8')

    const summary = { created: [], updated: [], skipped: [], warnings: [] }
    generateForwarderFiles(sourceDir, '/nonexistent/target', '/fw', '/user-hx', summary, {})

    expect(summary.warnings.length).toBeGreaterThan(0)
  })

  it('createDir=true 时自动创建 targetDir', () => {
    const sourceDir = makeTempDir('gen-mkdir-src-')
    const parent = makeTempDir('gen-mkdir-parent-')
    const targetDir = resolve(parent, 'commands')
    writeFileSync(resolve(sourceDir, 'hx-run.md'), '# hx-run', 'utf8')

    const summary = { created: [], updated: [], skipped: [], warnings: [] }
    generateForwarderFiles(sourceDir, targetDir, '/fw', '/user-hx', summary, { createDir: true })

    expect(existsSync(targetDir)).toBe(true)
    expect(existsSync(resolve(targetDir, 'hx-run.md'))).toBe(true)
  })

  it('dryRun=true 时不写入文件，但记录 created', () => {
    const sourceDir = makeTempDir('gen-dry-src-')
    const targetDir = makeTempDir('gen-dry-dst-')
    writeFileSync(resolve(sourceDir, 'hx-run.md'), '# hx-run', 'utf8')

    const summary = { created: [], updated: [], skipped: [], warnings: [] }
    generateForwarderFiles(sourceDir, targetDir, '/fw', '/user-hx', summary, { dryRun: true })

    expect(existsSync(resolve(targetDir, 'hx-run.md'))).toBe(false)
    expect(summary.created).toContain('~/.claude/commands/hx-run.md')
  })

  it('路径变更时将文件放入 updated 而非 created', () => {
    const sourceDir = makeTempDir('gen-update-src-')
    const targetDir = makeTempDir('gen-update-dst-')
    writeFileSync(resolve(sourceDir, 'hx-run.md'), '# hx-run', 'utf8')

    const summary1 = { created: [], updated: [], skipped: [], warnings: [] }
    generateForwarderFiles(sourceDir, targetDir, '/fw-old', '/user-hx', summary1, {})

    const summary2 = { created: [], updated: [], skipped: [], warnings: [] }
    generateForwarderFiles(sourceDir, targetDir, '/fw-new', '/user-hx', summary2, {})

    expect(summary2.updated).toContain('~/.claude/commands/hx-run.md')
    expect(summary2.created.length).toBe(0)
  })
})

// ── generateCodexSkillFiles ────────────────────────────────────────────────

describe('generateCodexSkillFiles', () => {
  it('每个命令生成独立的 skill 文件', () => {
    const sourceDir = makeTempDir('codex-src-')
    const targetDir = makeTempDir('codex-dst-')
    writeFileSync(resolve(sourceDir, 'hx-run.md'), [
      '---',
      'name: hx-run',
      'description: Phase 04 · 执行任务',
      'usage: hx-run <feature> <task-id> [--profile <name>]',
      'claude: /hx-run',
      'codex: hx-run',
      '---',
      '',
      '# hx-run',
      ''
    ].join('\n'), 'utf8')

    const summary = { created: [], updated: [], skipped: [], warnings: [] }
    generateCodexSkillFiles(sourceDir, targetDir, '/fw', '/user-hx', summary, {})

    expect(existsSync(resolve(targetDir, 'hx-run', 'SKILL.md'))).toBe(true)
    expect(existsSync(resolve(targetDir, 'SKILL.md'))).toBe(false)
    expect(existsSync(resolve(targetDir, 'commands.json'))).toBe(false)
    expect(summary.created).toContain('~/.codex/skills/hx-run/SKILL.md')
  })

  it('skill 文件包含命令描述和解析顺序', () => {
    const sourceDir = makeTempDir('codex-content-src-')
    const targetDir = makeTempDir('codex-content-dst-')
    writeFileSync(resolve(sourceDir, 'hx-run.md'), [
      '---',
      'name: hx-run',
      'description: Phase 04 · 执行任务',
      'usage: hx-run <feature> <task-id> [--profile <name>]',
      'claude: /hx-run',
      'codex: hx-run',
      '---',
      '',
      '# hx-run',
      ''
    ].join('\n'), 'utf8')

    const summary = { created: [], updated: [], skipped: [], warnings: [] }
    generateCodexSkillFiles(sourceDir, targetDir, '/framework', '/user-hx', summary, {})

    const content = readFileSync(resolve(targetDir, 'hx-run', 'SKILL.md'), 'utf8')
    expect(content).toContain('name: hx-run')
    expect(content).toContain('description: Phase 04 · 执行任务')
    expect(content).toContain('/user-hx/commands/hx-run.md')
    expect(content).toContain('/framework/agents/commands/hx-run.md')
  })
})
