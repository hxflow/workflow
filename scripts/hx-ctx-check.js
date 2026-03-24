#!/usr/bin/env node
// scripts/hx-ctx-check.js
// 用法: npm run hx:ctx -- [--profile backend|frontend|mobile:ios]
// 校验 AGENTS、requirement、plans 与 profile 资源是否一致

import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

import {
  extractRequirementInfo,
  filterProgressByProfile,
  findProgressFiles,
  getDefaultProfile,
  loadProfile,
  parseArgs,
  profileUsage,
  readJsonFile
} from './lib/profile-utils.js'
import { resolveContext, FRAMEWORK_ROOT } from './lib/resolve-context.js'

const ctx = resolveContext()
const ROOT = ctx.projectRoot
const { options } = parseArgs(process.argv.slice(2))
const profileName = typeof options.profile === 'string' ? options.profile : ctx.defaultProfile || getDefaultProfile(ROOT)

const agentsPath = ctx.agentsPath
if (!existsSync(agentsPath)) {
  console.error('✗ AGENTS.md 不存在，请先创建')
  process.exit(1)
}

const errors = []
const warnings = []
const summary = []

const agentsContent = readFileSync(agentsPath, 'utf8')
const lines = agentsContent.split('\n').length
if (lines > 100) {
  errors.push(`AGENTS.md 超过 100 行（当前 ${lines} 行）`)
} else {
  summary.push(`✓ AGENTS.md: ${lines} 行`)
}

const refs = [...agentsContent.matchAll(/→\s+([\w/\-.]+\.(?:md|json|js|ts))/g)].map((match) => match[1])
let validRefs = 0
for (const refPath of refs) {
  if (existsSync(resolve(ROOT, refPath))) {
    validRefs += 1
  } else {
    errors.push(`文档引用不存在: ${refPath}`)
  }
}
summary.push(`✓ 文档引用: ${validRefs}/${refs.length} 个有效`)

const planPathPattern = /\.harness\/plans\/([\w-]+)\.md|docs\/plans\/([\w-]+)\.md/g
const activeFeatures = [...new Set(
  [...agentsContent.matchAll(planPathPattern)].map((match) => match[1] || match[2])
)]

for (const featureName of activeFeatures) {
  const requirementPath = resolve(ctx.requirementDir, `${featureName}.md`)
  if (!existsSync(requirementPath)) {
    errors.push(`活跃特性缺少需求文档: ${featureName}.md`)
    continue
  }

  const requirement = extractRequirementInfo(readFileSync(requirementPath, 'utf8'))
  if (requirement.acs.length === 0) {
    errors.push(`需求文档缺少 AC: ${featureName}.md`)
  }
}

const progressEntries = findProgressFiles(ROOT, { plansDir: ctx.plansDir }).map((filePath) => ({ filePath, data: readJsonFile(filePath) }))
const filteredProgress = filterProgressByProfile(progressEntries, profileName)

for (const { filePath, data } of filteredProgress) {
  if (!Array.isArray(data.tasks) || data.tasks.length === 0) {
    errors.push(`进度文件缺少 tasks: ${relativePath(filePath)}`)
    continue
  }

  const requirementDoc = typeof data.requirementDoc === 'string' ? data.requirementDoc : null
  if (!requirementDoc || !existsSync(resolve(ROOT, requirementDoc))) {
    errors.push(`进度文件引用的需求文档不存在: ${relativePath(filePath)} -> ${requirementDoc || '未填写'}`)
    continue
  }

  const inProgressWithoutOutput = data.tasks.filter(
    (task) => task.status === 'in-progress' && (!task.output || !task.name)
  )
  for (const task of inProgressWithoutOutput) {
    errors.push(`任务信息不完整: ${relativePath(filePath)} -> ${task.id}`)
  }
}
summary.push(`✓ 进度文件: ${filteredProgress.length} 个已检查`)

checkRequiredAbsDoc(ctx.goldenPrinciplesPath, warnings, summary, '✓ 黄金原则: 存在')
checkRequiredAbsDoc(ctx.mapPath, warnings, summary, '✓ 架构地图: 存在')

if (profileName) {
  try {
    const profile = loadProfile(FRAMEWORK_ROOT, profileName, { harnessDir: ctx.harnessDir })
    const requiredFiles = [
      profile.files.profilePath,
      profile.files.requirementTemplatePath,
      profile.files.planTemplatePath,
      profile.files.reviewChecklistPath,
      profile.files.goldenRulesPath
    ].filter(Boolean)

    for (const filePath of requiredFiles) {
      if (!existsSync(filePath)) {
        errors.push(`profile 资源缺失: ${relativePath(filePath)}`)
      }
    }

    if (profile.files.platformPath && !existsSync(profile.files.platformPath)) {
      errors.push(`平台 profile 缺失: ${relativePath(profile.files.platformPath)}`)
    }

    summary.push(`✓ Profile: ${profile.profile} 完整`)
  } catch (error) {
    errors.push(error.message)
  }
}

const divider = '─'.repeat(50)
console.log(`\n${divider}`)
console.log('上下文校验')
console.log(divider)
summary.forEach((item) => console.log(item))

if (warnings.length > 0) {
  console.log('\n⚠ 警告')
  warnings.forEach((warning) => console.log(`- ${warning}`))
}

if (errors.length > 0) {
  console.log('\n✗ 错误')
  errors.forEach((error) => console.log(`- ${error}`))
  process.exit(1)
}

console.log('\n全部通过，可以开始执行。')

function checkRequiredDoc(relativeFilePath, targetWarnings, targetSummary, successMessage) {
  const absolutePath = resolve(ROOT, relativeFilePath)
  checkRequiredAbsDoc(absolutePath, targetWarnings, targetSummary, successMessage, relativeFilePath)
}

function checkRequiredAbsDoc(absolutePath, targetWarnings, targetSummary, successMessage, label) {
  const displayPath = label || absolutePath.replace(ROOT + '/', '').replace(FRAMEWORK_ROOT + '/', '')
  if (!existsSync(absolutePath)) {
    targetWarnings.push(`${displayPath} 不存在`)
    return
  }

  const content = readFileSync(absolutePath, 'utf8').trim()
  if (!content) {
    targetWarnings.push(`${displayPath} 为空`)
    return
  }

  targetSummary.push(successMessage)
}

function relativePath(filePath) {
  return filePath.replace(`${ROOT}/`, '').replace(`${FRAMEWORK_ROOT}/`, '')
}
