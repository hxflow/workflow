#!/usr/bin/env node
// scripts/hx-new-plan.js
// 用法: npm run hx:plan -- <feature-name> [--profile backend|frontend|mobile:ios]
// 根据 profile 配置创建执行计划与进度文件

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

import {
  extractRequirementInfo,
  getDefaultProfile,
  inferProfileFromRequirementDoc,
  isValidFeatureName,
  loadProfile,
  parseArgs,
  profileUsage
} from './lib/profile-utils.js'
import { buildPlanMarkdown, buildTasks, updateAgentsActiveFeature } from './lib/plan-utils.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { positional, options } = parseArgs(process.argv.slice(2))
const featureName = positional[0]

if (!featureName) {
  console.error('用法: npm run hx:plan -- <feature-name> [--profile <team[:platform]>]')
  console.error(`示例: npm run hx:plan -- user-login --profile ${getDefaultProfile(ROOT)}`)
  process.exit(1)
}

if (!isValidFeatureName(featureName)) {
  console.error('✗ feature-name 必须为 kebab-case（小写字母、数字、连字符）')
  process.exit(1)
}

const inferredProfile = inferProfileFromRequirementDoc(ROOT, featureName)
const profileName = typeof options.profile === 'string'
  ? options.profile
  : inferredProfile || getDefaultProfile(ROOT)

let profile
try {
  profile = loadProfile(ROOT, profileName)
} catch (error) {
  console.error(`✗ ${error.message}`)
  console.error(`  可用 profile: ${profileUsage()}`)
  process.exit(1)
}

const requirementPath = resolve(ROOT, 'docs/requirement', `${featureName}.md`)
if (!existsSync(requirementPath)) {
  console.error(`✗ 需求文档不存在: docs/requirement/${featureName}.md`)
  console.error('  请先运行 npm run hx:doc 创建文档')
  process.exit(1)
}

const plansDir = resolve(ROOT, 'docs/plans')
const mdPath = resolve(plansDir, `${featureName}.md`)
const jsonPath = resolve(plansDir, `${featureName}-progress.json`)
if (existsSync(mdPath) || existsSync(jsonPath)) {
  console.error(`✗ 执行计划已存在: docs/plans/${featureName}.md 或 docs/plans/${featureName}-progress.json`)
  process.exit(1)
}

mkdirSync(plansDir, { recursive: true })

const today = new Date().toISOString().split('T')[0]
const requirementContent = readFileSync(requirementPath, 'utf8')
const requirementInfo = extractRequirementInfo(requirementContent)
const tasks = buildTasks(featureName, profile, requirementInfo)

if (tasks.length === 0) {
  console.error('✗ 未能根据 profile 生成任务，请检查 requirement 文档中勾选的层级与 profile 配置是否一致')
  process.exit(1)
}

const progressJson = {
  feature: featureName,
  profile: profile.profile,
  team: profile.team,
  platform: profile.platform,
  taskPrefix: profile.taskPrefix,
  createdAt: today,
  requirementDoc: `docs/requirement/${featureName}.md`,
  checkedLayers: requirementInfo.checkedLayers,
  acIds: requirementInfo.acs.map((item) => item.id),
  tasks
}

const planMarkdown = buildPlanMarkdown(ROOT, featureName, profile, tasks, requirementInfo, today)
writeFileSync(mdPath, planMarkdown, 'utf8')
writeFileSync(jsonPath, JSON.stringify(progressJson, null, 2), 'utf8')

const agentsUpdated = updateAgentsActiveFeature(ROOT, featureName, profile)
const firstTask = tasks[0]

console.log('✓ 执行计划已创建:')
console.log(`  docs/plans/${featureName}.md（${tasks.length} 个任务）`)
console.log(`  docs/plans/${featureName}-progress.json`)
if (agentsUpdated) {
  console.log('  AGENTS.md 已登记为活跃特性')
}
console.log('\n下一步:')
console.log(`  npm run hx:ctx -- --profile ${profile.profile}`)
console.log(`  npm run hx:run -- ${featureName} ${firstTask.id} --profile ${profile.profile}`)
