#!/usr/bin/env node
// scripts/hx-new-plan.js
// 用法: npm run hx:plan -- <feature-name> [--profile backend|frontend|mobile:ios]
// 根据 profile 配置创建执行计划与进度文件

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

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
import { resolveContext, FRAMEWORK_ROOT } from './lib/resolve-context.js'

const ctx = resolveContext()
const { positional, options } = parseArgs(process.argv.slice(2))
const featureName = positional[0]

if (!featureName) {
  console.error('用法: npm run hx:plan -- <feature-name> [--profile <team[:platform]>]')
  console.error(`示例: hx plan user-login --profile ${ctx.defaultProfile || 'backend'}`)
  process.exit(1)
}

if (!isValidFeatureName(featureName)) {
  console.error('✗ feature-name 必须为 kebab-case（小写字母、数字、连字符）')
  process.exit(1)
}

const inferredProfile = inferProfileFromRequirementDoc(FRAMEWORK_ROOT, featureName, { requirementDir: ctx.requirementDir })
const profileName = typeof options.profile === 'string'
  ? options.profile
  : inferredProfile || ctx.defaultProfile || getDefaultProfile(ctx.projectRoot)

let profile
try {
  profile = loadProfile(FRAMEWORK_ROOT, profileName, { harnessDir: ctx.harnessDir })
} catch (error) {
  console.error(`✗ ${error.message}`)
  console.error(`  可用 profile: ${profileUsage()}`)
  process.exit(1)
}

const requirementPath = resolve(ctx.requirementDir, `${featureName}.md`)
if (!existsSync(requirementPath)) {
  console.error(`✗ 需求文档不存在: ${featureName}.md`)
  console.error('  请先运行 npm run hx:doc 创建文档')
  process.exit(1)
}

const plansDir = ctx.plansDir
const mdPath = resolve(plansDir, `${featureName}.md`)
const jsonPath = resolve(plansDir, `${featureName}-progress.json`)
if (existsSync(mdPath) || existsSync(jsonPath)) {
  console.error(`✗ 执行计划已存在: ${featureName}.md 或 ${featureName}-progress.json`)
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

const relRequirementPath = requirementPath.replace(ctx.projectRoot + '/', '')
const progressJson = {
  feature: featureName,
  profile: profile.profile,
  team: profile.team,
  platform: profile.platform,
  taskPrefix: profile.taskPrefix,
  createdAt: today,
  requirementDoc: relRequirementPath,
  checkedLayers: requirementInfo.checkedLayers,
  acIds: requirementInfo.acs.map((item) => item.id),
  tasks
}

const planMarkdown = buildPlanMarkdown(FRAMEWORK_ROOT, featureName, profile, tasks, requirementInfo, today, { plansDir })
writeFileSync(mdPath, planMarkdown, 'utf8')
writeFileSync(jsonPath, JSON.stringify(progressJson, null, 2), 'utf8')

const agentsUpdated = updateAgentsActiveFeature(FRAMEWORK_ROOT, featureName, profile, { agentsPath: ctx.agentsPath })
const firstTask = tasks[0]

console.log('✓ 执行计划已创建:')
console.log(`  ${mdPath.replace(ctx.projectRoot + '/', '')}（${tasks.length} 个任务）`)
console.log(`  ${jsonPath.replace(ctx.projectRoot + '/', '')}`)
if (agentsUpdated) {
  console.log('  AGENTS.md 已登记为活跃特性')
}
console.log('\n下一步:')
console.log(`  hx ctx --profile ${profile.profile}`)
console.log(`  hx run ${featureName} ${firstTask.id} --profile ${profile.profile}`)
