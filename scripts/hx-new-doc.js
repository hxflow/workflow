#!/usr/bin/env node
// scripts/hx-new-doc.js
// 用法: npm run hx:doc -- <feature-name> [--profile backend|frontend|mobile:ios]
// 从 profile 模板创建需求文档

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

import {
  createTemplateReplacements,
  getDefaultProfile,
  isValidFeatureName,
  loadProfile,
  parseArgs,
  profileUsage,
  renderTemplate
} from './lib/profile-utils.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { positional, options } = parseArgs(process.argv.slice(2))
const featureName = positional[0]
const profileName = typeof options.profile === 'string' ? options.profile : getDefaultProfile(ROOT)
const taskId = typeof options.task === 'string' ? options.task : null

if (!featureName) {
  console.error('用法: npm run hx:doc -- <feature-name> [--profile <team[:platform]>]')
  console.error(`示例: npm run hx:doc -- user-login --profile ${getDefaultProfile(ROOT)}`)
  process.exit(1)
}

if (!isValidFeatureName(featureName)) {
  console.error('✗ feature-name 必须为 kebab-case（小写字母、数字、连字符）')
  process.exit(1)
}

let profile
try {
  profile = loadProfile(ROOT, profileName)
} catch (error) {
  console.error(`✗ ${error.message}`)
  console.error(`  可用 profile: ${profileUsage()}`)
  process.exit(1)
}

const docsDir = resolve(ROOT, 'docs/requirement')
const outputPath = resolve(docsDir, `${featureName}.md`)
if (existsSync(outputPath)) {
  console.error(`✗ 文档已存在: docs/requirement/${featureName}.md`)
  console.error('  如需重新创建，请先删除现有文件')
  process.exit(1)
}

const templatePath = existsSync(profile.files.requirementTemplatePath)
  ? profile.files.requirementTemplatePath
  : resolve(ROOT, 'docs/requirement/_template.md')

mkdirSync(docsDir, { recursive: true })

const today = new Date().toISOString().split('T')[0]
const replacements = {
  ...createTemplateReplacements(featureName, profile),
  date: today,
  'YYYY-MM-DD': today
}

let output = renderTemplate(readFileSync(templatePath, 'utf8'), replacements)
output = output.replaceAll('YYYY-MM-DD', today)
if (taskId && !output.includes('来源任务')) {
  output = output.replace(/^>.*$/m, (line) => `${line}\n> 来源任务：DevOps #${taskId}`)
}

writeFileSync(outputPath, output, 'utf8')

console.log(`✓ 需求文档已创建: docs/requirement/${featureName}.md`)
console.log(`  团队: ${profile.label}${profile.platformLabel ? ` · ${profile.platformLabel}` : ''}`)
if (taskId) {
  console.log(`  来源任务: DevOps #${taskId}`)
}
console.log(`\n下一步: npm run hx:plan -- ${featureName} --profile ${profile.profile}`)
