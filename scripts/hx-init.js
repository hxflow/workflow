#!/usr/bin/env node

/**
 * hx init — 零侵入式安装 Harness Workflow 到目标项目
 *
 * 行为：
 *   1. 创建 .harness/ 目录结构 + config.yaml
 *   2. 复制 .claude/commands/hx-*.md（不覆盖已存在文件）
 *   3. 追加 CLAUDE.md 标记块（不覆盖原有内容）
 *   4. 如果指定自定义 profile，生成骨架
 *
 * 幂等设计：重复运行安全。
 */

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { basename, resolve } from 'path'
import { FRAMEWORK_ROOT } from './lib/resolve-context.js'

// ── 常量 ──

const HARNESS_MARKER_START = '<!-- harness-workflow:start -->'
const HARNESS_MARKER_END = '<!-- harness-workflow:end -->'

const BUILTIN_PROFILES = ['backend', 'frontend', 'mobile']

// ── 主流程 ──

export function runInit(targetDir, options = {}) {
  const projectRoot = resolve(targetDir || process.cwd())
  const profile = options.profile || 'backend'
  const summary = { created: [], skipped: [], updated: [], warnings: [] }

  console.log(`\n  Harness Workflow · init`)
  console.log(`  目标: ${projectRoot}`)
  console.log(`  Profile: ${profile}\n`)

  // Step 1: 创建 .harness/ 目录结构
  createHarnessDir(projectRoot, profile, summary)

  // Step 2: 安装 .claude/commands/hx-*.md
  installCommands(projectRoot, summary)

  // Step 3: 合并 CLAUDE.md
  mergeCLAUDEmd(projectRoot, profile, summary)

  // Step 4: 如果是自定义 profile，生成骨架
  if (!BUILTIN_PROFILES.includes(profile.split(':')[0])) {
    createCustomProfile(projectRoot, profile, summary)
  }

  // 输出报告
  printSummary(summary)
}

// ── Step 1: .harness/ 目录 ──

function createHarnessDir(projectRoot, profile, summary) {
  const harnessDir = resolve(projectRoot, '.harness')
  const dirs = [
    harnessDir,
    resolve(harnessDir, 'requirement'),
    resolve(harnessDir, 'plans'),
    resolve(harnessDir, 'profiles')
  ]

  for (const dir of dirs) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
      summary.created.push(dir.replace(projectRoot + '/', ''))
    }
  }

  // config.yaml
  const configPath = resolve(harnessDir, 'config.yaml')
  if (!existsSync(configPath)) {
    writeFileSync(configPath, buildConfigYaml(profile))
    summary.created.push('.harness/config.yaml')
  } else {
    summary.skipped.push('.harness/config.yaml (已存在)')
  }

  // AGENTS.md
  const agentsPath = resolve(harnessDir, 'AGENTS.md')
  if (!existsSync(agentsPath)) {
    const frameworkAgents = resolve(FRAMEWORK_ROOT, 'AGENTS.md')
    if (existsSync(frameworkAgents)) {
      cpSync(frameworkAgents, agentsPath)
    } else {
      writeFileSync(agentsPath, buildAgentsMd(profile))
    }
    summary.created.push('.harness/AGENTS.md')
  } else {
    summary.skipped.push('.harness/AGENTS.md (已存在)')
  }
}

function buildConfigYaml(profile) {
  return `# Harness Workflow 配置
# 由 hx init 自动生成，可手动编辑

# 框架版本
version: "1.0.0"

# 默认 Profile
defaultProfile: ${profile}

# 路径配置（不设置则使用默认值）
paths:
  requirement: .harness/requirement
  plans: .harness/plans
  src: .

# 命令桥接（将 hx 命令与现有 Skill 串联）
# commandBridge:
#   preGate: /pre-commit-check
#   postCode: /tech-plan-test
`
}

function buildAgentsMd(profile) {
  return `# Agent 上下文索引

> 本文件由 Harness Workflow 管理，Agent 执行前必读。保持在 100 行以内。

## 当前配置

- Profile: ${profile}
- 需求文档: .harness/requirement/
- 执行计划: .harness/plans/

## 执行规则

1. 每个 TASK 独立开会话执行
2. 执行前读取: 本文件 + golden-principles.md + 团队 golden-rules.md
3. 代码必须通过 Profile 定义的门控检查
4. 上下文 > 40% 时新开会话，进度写入 progress.json

## 活跃特性

<!-- 由 /hx-doc 和 /hx-plan 自动维护 -->

（暂无）
`
}

// ── Step 2: 安装命令 ──

function installCommands(projectRoot, summary) {
  const sourceDir = resolve(FRAMEWORK_ROOT, '.claude', 'commands')
  const targetDir = resolve(projectRoot, '.claude', 'commands')

  if (!existsSync(sourceDir)) {
    summary.warnings.push('框架命令目录不存在: .claude/commands/')
    return
  }

  mkdirSync(targetDir, { recursive: true })

  const files = readdirSync(sourceDir).filter(f => f.startsWith('hx-') && f.endsWith('.md'))

  for (const file of files) {
    const targetPath = resolve(targetDir, file)
    if (existsSync(targetPath)) {
      summary.skipped.push(`.claude/commands/${file} (已存在)`)
    } else {
      cpSync(resolve(sourceDir, file), targetPath)
      summary.created.push(`.claude/commands/${file}`)
    }
  }
}

// ── Step 3: 合并 CLAUDE.md ──

function mergeCLAUDEmd(projectRoot, profile, summary) {
  const claudePath = resolve(projectRoot, 'CLAUDE.md')
  const block = buildHarnessBlock(profile)

  if (!existsSync(claudePath)) {
    writeFileSync(claudePath, block)
    summary.created.push('CLAUDE.md')
    return
  }

  const content = readFileSync(claudePath, 'utf8')

  if (content.includes(HARNESS_MARKER_START)) {
    // 更新已有标记块
    const updated = content.replace(
      new RegExp(`${escapeRegExp(HARNESS_MARKER_START)}[\\s\\S]*?${escapeRegExp(HARNESS_MARKER_END)}`),
      block
    )
    writeFileSync(claudePath, updated)
    summary.updated.push('CLAUDE.md (更新 harness 标记块)')
  } else {
    // 追加到末尾
    writeFileSync(claudePath, content.trimEnd() + '\n\n' + block + '\n')
    summary.updated.push('CLAUDE.md (追加 harness 标记块)')
  }
}

function buildHarnessBlock(profile) {
  return `${HARNESS_MARKER_START}
## Harness Workflow

本项目已启用 Harness Workflow Framework。

- 配置: \`.harness/config.yaml\`
- Profile: \`${profile}\`
- 需求文档: \`.harness/requirement/\`
- 执行计划: \`.harness/plans/\`
- Agent 索引: \`.harness/AGENTS.md\`

可用命令: \`/hx-go\` \`/hx-doc\` \`/hx-plan\` \`/hx-run\` \`/hx-review\` \`/hx-gate\` \`/hx-entropy\` \`/hx-mr\`

执行规则和上下文详见 \`.harness/AGENTS.md\`
${HARNESS_MARKER_END}`
}

// ── Step 4: 自定义 Profile 骨架 ──

function createCustomProfile(projectRoot, profile, summary) {
  const profileName = profile.split(':')[0]
  const profileDir = resolve(projectRoot, '.harness', 'profiles', profileName)

  if (existsSync(resolve(profileDir, 'profile.yaml'))) {
    summary.skipped.push(`.harness/profiles/${profileName}/profile.yaml (已存在)`)
    return
  }

  mkdirSync(profileDir, { recursive: true })

  // 决定 extends 目标：如果名字以 backend-/frontend-/mobile- 开头，继承对应内置 profile
  let extendsTarget = 'base'
  for (const builtin of BUILTIN_PROFILES) {
    if (profileName.startsWith(builtin + '-') || profileName.startsWith(builtin + '_')) {
      extendsTarget = builtin
      break
    }
  }

  writeFileSync(resolve(profileDir, 'profile.yaml'), `# 自定义 Profile: ${profileName}
# 由 hx init --profile ${profile} 自动生成
name: ${profileName}
label: ${profileName}
extends: ${extendsTarget}
task_prefix: TASK

# 覆盖架构层级（取消注释并修改）
# architecture:
#   layers:
#     - id: domain
#       label: Domain
#       path: domain/
#       can_import: []
#     - id: service
#       label: Service
#       path: service/
#       can_import: [domain]

# 覆盖门控命令
# gate_commands:
#   lint: "golangci-lint run ./..."
#   build: "go build ./..."
#   test: "go test ./... -v -count=1"
`)

  writeFileSync(resolve(profileDir, 'golden-rules.md'), `# ${profileName} 专属黄金原则

> 补充 base golden-rules.md，以下规则仅适用于 ${profileName}。

<!-- 在此添加团队专属规则 -->
`)

  writeFileSync(resolve(profileDir, 'review-checklist.md'), `# ${profileName} 代码审查清单

> Phase 05 使用，补充 base review-checklist.md。

## 必须修复

- [ ] （添加团队专属检查项）

## 建议修复

- [ ] （添加团队专属建议项）
`)

  summary.created.push(`.harness/profiles/${profileName}/profile.yaml`)
  summary.created.push(`.harness/profiles/${profileName}/golden-rules.md`)
  summary.created.push(`.harness/profiles/${profileName}/review-checklist.md`)
}

// ── 工具 ──

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function printSummary(summary) {
  console.log('  ── 安装报告 ──\n')

  if (summary.created.length) {
    console.log('  创建:')
    for (const item of summary.created) console.log(`    + ${item}`)
  }

  if (summary.updated.length) {
    console.log('  更新:')
    for (const item of summary.updated) console.log(`    ~ ${item}`)
  }

  if (summary.skipped.length) {
    console.log('  跳过:')
    for (const item of summary.skipped) console.log(`    - ${item}`)
  }

  if (summary.warnings.length) {
    console.log('  警告:')
    for (const item of summary.warnings) console.log(`    ! ${item}`)
  }

  console.log('\n  完成。使用 /hx-go 开始第一个需求。\n')
}

// ── CLI 入口 ──

const args = process.argv.slice(2)
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
  用法: hx init [--profile <name>] [--target <dir>]

  选项:
    --profile <name>  指定 Profile（默认 backend）
                      内置: backend, frontend, mobile:ios, mobile:android, mobile:harmony
                      自定义: 任意名称，会在 .harness/profiles/ 下生成骨架
    --target <dir>    目标项目目录（默认当前目录）
    --help            显示帮助
  `)
  process.exit(0)
}

// 解析参数
let profile = 'backend'
let target = process.cwd()

for (let i = 0; i < args.length; i++) {
  if ((args[i] === '--profile' || args[i] === '-p') && args[i + 1]) {
    profile = args[++i]
  } else if ((args[i] === '--target' || args[i] === '-t') && args[i + 1]) {
    target = resolve(args[++i])
  } else if (args[i] === 'init') {
    // 跳过 init 子命令本身
  }
}

runInit(target, { profile })
