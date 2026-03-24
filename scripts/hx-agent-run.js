#!/usr/bin/env node
// scripts/hx-agent-run.js
// 用法:
//   npm run hx:run -- <feature-name> <TASK-ID> [--profile backend|frontend|mobile:ios]
//   npm run hx:run -- <TASK-ID> [--profile ...]
// 读取执行计划，生成带 profile 上下文的 Agent Prompt

import { existsSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

import {
  findProgressByTask,
  getDefaultProfile,
  guessProfileFromTaskId,
  inferProfileFromProgress,
  isTaskId,
  loadProfile,
  parseArgs,
  profileUsage
} from './lib/profile-utils.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { positional, options } = parseArgs(process.argv.slice(2))

const parsed = parseCommand(positional)
if (!parsed.taskId) {
  console.error('用法: npm run hx:run -- <feature-name> <TASK-ID> [--profile <team[:platform]>]')
  console.error('示例: npm run hx:run -- user-login TASK-BE-03 --profile backend')
  process.exit(1)
}

const progressEntry = findProgressByTask(ROOT, parsed.taskId, parsed.featureName)
if (!progressEntry) {
  console.error(`✗ 未找到任务 ${parsed.taskId}`)
  console.error('  请先运行 npm run hx:plan 生成执行计划')
  process.exit(1)
}

const featureName = parsed.featureName || progressEntry.data.feature
const profileName = typeof options.profile === 'string'
  ? options.profile
  : inferProfileFromProgress(progressEntry.data) || guessProfileFromTaskId(parsed.taskId) || getDefaultProfile(ROOT)

let profile
try {
  profile = loadProfile(ROOT, profileName)
} catch (error) {
  console.error(`✗ ${error.message}`)
  console.error(`  可用 profile: ${profileUsage()}`)
  process.exit(1)
}

const expectedProfile = inferProfileFromProgress(progressEntry.data)
if (expectedProfile && expectedProfile !== profile.profile) {
  console.error(`✗ 计划文件中的 profile 为 ${expectedProfile}，与当前参数 ${profile.profile} 不一致`)
  process.exit(1)
}

const task = progressEntry.task
if (task.status === 'done') {
  console.log(`ℹ  ${task.id} 已完成（${task.completedAt || '时间未知'}）`)
  console.log('  如需重新执行，先将进度文件中的状态改回 pending')
  process.exit(0)
}

const requirementRelPath = progressEntry.data.requirementDoc || `docs/requirement/${featureName}.md`
const requirementPath = resolve(ROOT, requirementRelPath)
const planRelPath = `docs/plans/${featureName}.md`
const planPath = resolve(ROOT, planRelPath)
const goldenRulesRelPath = relativePath(profile.files.goldenRulesPath)
const profileRelPath = relativePath(profile.files.profilePath)
const platformRelPath = profile.files.platformPath ? relativePath(profile.files.platformPath) : null

const contextFiles = [
  'AGENTS.md',
  'docs/golden-principles.md',
  goldenRulesRelPath,
  profileRelPath,
  platformRelPath,
  planRelPath,
  requirementRelPath
].filter(Boolean)

const layerSummary = profile.architecture.layers
  .map((layer) => {
    const allowed = Array.isArray(layer.can_import) && layer.can_import.length > 0
      ? layer.can_import.join(', ')
      : '无'
    return `- ${layer.label}（${layer.path}）→ 可导入: ${allowed}`
  })
  .join('\n')

const constraints = profile.constraints.length > 0
  ? profile.constraints.map((item) => `- ${item}`).join('\n')
  : '- 无额外平台约束'

const gateCommands = Object.entries(profile.gateCommands)
  .map(([step, command]) => `- ${step}: ${command}`)
  .join('\n') || '- 未定义'

const divider = '═'.repeat(60)
console.log(`\n${divider}`)
console.log(`  Agent Prompt — ${task.id} (${profile.label}${profile.platformLabel ? ` · ${profile.platformLabel}` : ''})`)
console.log('  复制下方内容，粘贴给 Claude/Codex 执行')
console.log(divider)
console.log()

const prompt = `按照 ${planRelPath} 中的 **${task.id}** 执行。

在开始前，请依次读取以下文件获取上下文：
${contextFiles.map((filePath) => `- ${filePath}`).join('\n')}

**任务信息：**
- 任务 ID：${task.id}
- 特性：${featureName}
- 团队：${profile.label}${profile.platformLabel ? ` · ${profile.platformLabel}` : ''}
- 描述：${task.name}
- 当前状态：${task.status}
- 预期输出：${task.output || '待补充'}

**架构约束：**
${layerSummary}

**平台 / 团队补充约束：**
${constraints}

**执行要求：**
1. 严格对照 ${requirementRelPath} 中的验收标准（AC）实现
2. 不重复发明已有类型或契约，优先复用 src/types/ 与需求文档中的定义
3. 代码必须落在约定目录中，避免越层导入
4. 错误处理遵循 docs/golden-principles.md 与团队 golden-rules
5. 如果遇到歧义，先回到 requirement / plan 文档确认，不要自行猜测

**门控命令：**
${gateCommands}

**完成标准：**
1. 运行对应 profile 的门控命令并全部通过
2. 无 console.log、无 : any 类型泄漏、无裸 throw new Error
3. 完成后运行 \`npm run hx:done -- ${task.id}\` 更新进度
4. PR 标题需包含 ${task.id}
`

console.log(prompt)
console.log()
console.log(divider)
console.log()

if (!existsSync(requirementPath)) {
  console.warn(`⚠  需求文档不存在: ${requirementRelPath}`)
}

if (!existsSync(planPath)) {
  console.warn(`⚠  计划文件不存在: ${planRelPath}`)
}

function parseCommand(args) {
  if (args.length === 1 && isTaskId(args[0])) {
    return { featureName: null, taskId: args[0] }
  }

  if (args.length >= 2) {
    if (args[0] && args[1] && isTaskId(args[1])) {
      return { featureName: args[0], taskId: args[1] }
    }
  }

  return { featureName: null, taskId: null }
}

function relativePath(filePath) {
  return filePath.replace(`${ROOT}/`, '')
}
