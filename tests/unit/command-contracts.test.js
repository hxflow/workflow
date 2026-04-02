import { readFileSync, readdirSync } from 'fs'
import { resolve } from 'path'

import { describe, expect, it } from 'vitest'

const COMMANDS_DIR = resolve(process.cwd(), 'src', 'commands')
const CONTRACTS_DIR = resolve(process.cwd(), 'src', 'contracts')
const commandFiles = readdirSync(COMMANDS_DIR)
  .filter((file) => file.startsWith('hx-') && file.endsWith('.md'))
  .sort()

const PROTECTED_COMMANDS = [
  'hx-cli',
  'hx-init',
  'hx-status',
]

const HOOKED_COMMANDS = [
  'hx-check',
  'hx-doc',
  'hx-fix',
  'hx-mr',
  'hx-plan',
  'hx-run',
]

const FAILURE_HANDLING_COMMANDS = [
  'hx-cli',
]

const ALL_COMMANDS = [
  'hx-check',
  'hx-cli',
  'hx-doc',
  'hx-fix',
  'hx-go',
  'hx-init',
  'hx-mr',
  'hx-plan',
  'hx-rules',
  'hx-run',
  'hx-status',
]

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/)
  if (!match) {
    return {}
  }

  const metadata = {}
  let currentKey = null

  for (const rawLine of match[1].split('\n')) {
    const line = rawLine.trimEnd()
    const keyMatch = line.match(/^([a-zA-Z][\w-]*):\s*(.*)$/)

    if (keyMatch) {
      currentKey = keyMatch[1]
      const value = keyMatch[2].trim()

      if (value === '') {
        metadata[currentKey] = []
      } else {
        metadata[currentKey] = value.replace(/^['"]|['"]$/g, '')
      }
      continue
    }

    const listMatch = line.match(/^\s*-\s*(.+)$/)
    if (listMatch && currentKey) {
      metadata[currentKey].push(listMatch[1].trim())
    }
  }

  return metadata
}

describe('command contracts', () => {
  it('keeps filename, frontmatter, and structure aligned', () => {
    expect(commandFiles.map((file) => file.replace(/\.md$/, ''))).toEqual(ALL_COMMANDS)

    for (const file of commandFiles) {
      const commandName = file.replace(/\.md$/, '')
      const content = readFileSync(resolve(COMMANDS_DIR, file), 'utf8')
      const metadata = parseFrontmatter(content)

      expect(metadata.name).toBe(commandName)
      expect(typeof metadata.description).toBe('string')
      expect(metadata.description.length).toBeGreaterThan(0)
      expect(typeof metadata.usage).toBe('string')
      expect(metadata.usage.length).toBeGreaterThan(0)
      expect(content).toContain('## 目标')
      expect(content).toContain('## 何时使用')
      expect(content).toContain('## 输入')
      expect(content).toContain('## 执行步骤')
      expect(content).toContain('## 成功结果')
      expect(content).toContain('## 失败边界')
      expect(content).toContain('## 下一步')
      expect(content).toContain('## 约束')
      expect(content).toContain('命令参数：')
      expect(content).toContain('必选参数：')
      expect(content).toContain('可选参数：')
      expect(content).toContain('默认值：')
      expect(content).toContain('依赖输入：')
    }
  })

  it('locks the protected and hook-capable command sets', () => {
    const protectedCommands = []
    const hookedCommands = []

    for (const file of commandFiles) {
      const commandName = file.replace(/\.md$/, '')
      const content = readFileSync(resolve(COMMANDS_DIR, file), 'utf8')
      const metadata = parseFrontmatter(content)

      if (metadata.protected === 'true') {
        protectedCommands.push(commandName)
      }

      if (Array.isArray(metadata.hooks) && metadata.hooks.length > 0) {
        hookedCommands.push(commandName)
        expect(metadata.hooks).toEqual(['pre', 'post'])
      }
    }

    expect(protectedCommands).toEqual(PROTECTED_COMMANDS)
    expect(hookedCommands).toEqual(HOOKED_COMMANDS)
  })

  it('keeps command section usage consistent', () => {
    const failureHandlingCommands = []

    for (const file of commandFiles) {
      const commandName = file.replace(/\.md$/, '')
      const content = readFileSync(resolve(COMMANDS_DIR, file), 'utf8')

      if (content.includes('## 失败处理')) {
        failureHandlingCommands.push(commandName)
      }

      if (HOOKED_COMMANDS.includes(commandName)) {
        expect(content).not.toContain('src/hooks/README.md')
      }
    }

    expect(failureHandlingCommands).toEqual(FAILURE_HANDLING_COMMANDS)
  })

  it('keeps shared contracts split by concern', () => {
    const commandsReadme = readFileSync(resolve(CONTRACTS_DIR, 'command-contract.md'), 'utf8')
    const featureContract = readFileSync(resolve(CONTRACTS_DIR, 'feature-contract.md'), 'utf8')
    const runtimeContract = readFileSync(resolve(CONTRACTS_DIR, 'runtime-contract.md'), 'utf8')
    const progressContract = readFileSync(resolve(CONTRACTS_DIR, 'progress-contract.md'), 'utf8')
    const resolutionContract = readFileSync(resolve(CONTRACTS_DIR, 'resolution-contract.md'), 'utf8')
    const ownershipContract = readFileSync(resolve(CONTRACTS_DIR, 'ownership-contract.md'), 'utf8')
    const hxGo = readFileSync(resolve(COMMANDS_DIR, 'hx-go.md'), 'utf8')

    expect(commandsReadme).toContain('## Frontmatter')
    expect(commandsReadme).toContain('## 正文结构')
    expect(commandsReadme).toContain('必选参数')
    expect(commandsReadme).toContain('可选参数')
    expect(commandsReadme).toContain('默认值')
    expect(commandsReadme).toContain('status')
    expect(commandsReadme).toContain('command')
    expect(commandsReadme).toContain('feature')
    expect(commandsReadme).toContain('固定字段顺序')
    expect(commandsReadme).toContain('post_*` Hook 的 `result` 输入直接复用')
    expect(commandsReadme).toContain('## 参数对象约定')
    expect(commandsReadme).toContain('`raw`')
    expect(commandsReadme).toContain('`positional`')
    expect(commandsReadme).toContain('`options`')
    expect(commandsReadme).toContain('### `artifacts`')
    expect(commandsReadme).toContain('### `issues`')
    expect(commandsReadme).toContain('### `nextAction`')
    expect(commandsReadme).toContain('Record<string, unknown>')
    expect(commandsReadme).toContain('level: "info" | "warning" | "error"')
    expect(commandsReadme).toContain('`code` 必须稳定、可机读')
    expect(commandsReadme).toContain('{ command: string | null; reason: string }')
    expect(commandsReadme).not.toContain('## 共享事实')
    expect(commandsReadme).toContain('运行时解析、命令写权和对象 schema 不在本文定义')
    expect(runtimeContract).toContain('## 默认读取')
    expect(runtimeContract).toContain('## 按需读取')
    expect(runtimeContract).toContain('## 常见映射')
    expect(runtimeContract).toContain('## 执行入口')
    expect(runtimeContract).toContain('src/contracts/resolution-contract.md')
    expect(runtimeContract).toContain('src/contracts/command-contract.md')
    expect(runtimeContract).toContain('src/contracts/ownership-contract.md')
    expect(runtimeContract).toContain('本文件是所有 `hx-*` 命令的系统层 prompt')
    expect(runtimeContract).toContain('命令正文显式提到哪个 contract，就继续读取哪个 contract')
    expect(runtimeContract).toContain('不要一次性读取整个 `src/contracts/`')
    expect(featureContract).toContain('Feature Contract')
    expect(progressContract).toContain('Progress Contract')
    expect(hxGo).not.toContain('src/contracts/resolution-contract.md')
    expect(resolutionContract).toContain('`protected: true` 的 command 只允许读取框架层实体文件。')
    expect(resolutionContract).toContain('~/.claude/skills/*/SKILL.md')
    expect(resolutionContract).toContain('~/.agents/skills/*/SKILL.md')
    expect(ownershipContract).toContain('## Feature 写权')
    expect(ownershipContract).toContain('## Progress 写权')
    expect(ownershipContract).toContain('hx-go` 负责编排')
  })

  it('keeps the main-chain parameter model aligned', () => {
    const hxDoc = readFileSync(resolve(COMMANDS_DIR, 'hx-doc.md'), 'utf8')
    const featureContract = readFileSync(resolve(CONTRACTS_DIR, 'feature-contract.md'), 'utf8')
    const hxCheck = readFileSync(resolve(COMMANDS_DIR, 'hx-check.md'), 'utf8')
    const hxGo = readFileSync(resolve(COMMANDS_DIR, 'hx-go.md'), 'utf8')
    const hxRun = readFileSync(resolve(COMMANDS_DIR, 'hx-run.md'), 'utf8')
    const hxPlan = readFileSync(resolve(COMMANDS_DIR, 'hx-plan.md'), 'utf8')
    const hxMr = readFileSync(resolve(COMMANDS_DIR, 'hx-mr.md'), 'utf8')
    const hxCli = readFileSync(resolve(COMMANDS_DIR, 'hx-cli.md'), 'utf8')
    const readme = readFileSync(resolve(process.cwd(), 'README.md'), 'utf8')

    expect(hxDoc).not.toContain('--task <task-id>')
    expect(hxDoc).toContain('usage: hx-doc')
    expect(hxDoc).not.toContain('[<title>]')
    expect(hxGo).not.toContain('--task <task-id>')
    expect(hxRun).toContain('--plan-task <task-id>')
    expect(hxRun).not.toContain('--task <task-id>')
    expect(hxGo).toContain('usage: hx-go [<feature>] [--from <step-id>] [--pipeline <name>]')
    expect(hxDoc).toContain('src/contracts/feature-contract.md')
    expect(hxDoc).toContain('唯一的 feature 事实源')
    expect(hxDoc).toContain('先复用已有 `feature`')
    expect(hxDoc).toContain('displayName')
    expect(hxDoc).toContain('新开一个子 agent')
    expect(hxDoc).toContain('主 agent 必须根据子 agent 的评审结论修正后再输出')
    expect(featureContract).toContain('sourceFingerprint')
    expect(featureContract).toContain('displayName')
    expect(featureContract).toContain('先复用，后生成')
    expect(hxDoc).toContain('docs/requirement/{feature}.md')
    expect(hxPlan).toContain('src/contracts/feature-contract.md')
    expect(hxPlan).toContain('src/contracts/progress-contract.md')
    expect(hxPlan).toContain('src/templates/progress.json')
    expect(hxPlan).toContain('validateProgressData(progressData)')
    expect(hxPlan).toContain('task 依赖关系和并行约束')
    expect(hxPlan).toContain('`planDoc` 中不得出现对应描述')
    expect(hxPlan).toContain('新开一个子 agent')
    expect(hxPlan).toContain('planDoc')
    expect(hxPlan).toContain('progressFile')
    expect(hxPlan).toContain('主 agent 必须根据评审结论修正')
    expect(hxCheck).toContain('usage: hx-check [--scope <review|qa|clean|all>]')
    expect(hxCheck).toContain('审查、质量门和工程卫生扫描')
    expect(hxCheck).toContain('review-checklist.md')
    expect(hxCheck).toContain('gates.*')
    expect(hxRun).toContain('src/contracts/feature-contract.md')
    expect(hxRun).toContain('src/contracts/progress-contract.md')
    expect(hxRun).toContain('调度规则')
    expect(hxRun).toContain('回写规则')
    expect(hxRun).toContain('可运行的 pending task')
    expect(hxRun).toContain('recoverable')
    expect(hxRun).toContain('不重复执行阶段一')
    expect(hxRun).toContain('`lastRun` 与 task 状态必须保持一致')
    expect(hxRun).toContain('在进入调度前调用')
    expect(hxRun).toContain('不得在坏状态的 `progressFile` 上继续执行')
    expect(hxRun).toContain('输入完整性校验是固定步骤')
    expect(hxRun).toContain('校验 `requirementDoc`、`planDoc`、`progressFile`、规则文件和 `gates`')
    expect(hxRun).toContain('validateProgressFile(progressFile)')
    expect(hxRun).toContain('质量复查子 agent')
    expect(hxRun).toContain('边界条件')
    expect(hxRun).toContain('回归风险')
    expect(hxRun).toContain('主 agent 必须根据复查结论补齐必要修正')
    expect(hxPlan).toContain('不允许在本阶段生成或修改')
    expect(hxRun).toContain('不生成、不改写、不重算')
    expect(hxMr).toContain('不允许在 MR 阶段生成或重算')
    expect(hxMr).toContain('src/contracts/feature-contract.md')
    expect(hxGo).toContain('src/contracts/feature-contract.md')
    expect(hxGo).toContain('--from <step-id>')
    expect(hxGo).toContain('恢复起点')
    expect(hxGo).toContain('`doc`')
    expect(hxGo).toContain('`plan`')
    expect(hxGo).toContain('`run`')
    expect(hxGo).toContain('`check`、`mr`')
    expect(hxGo).toContain('不得跳过最早未完成 step')
    expect(hxCli).toContain('usage: hx-cli <doctor|issue> [options]')
    expect(hxCli).toContain('`<doctor|issue>`')
    expect(hxCli).toContain('`--title <title>`')
    expect(hxCli).not.toContain('--agent <')
    expect(readme).toContain('hx migrate')
  })
})
