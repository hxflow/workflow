#!/usr/bin/env node

/**
 * hx-plan.ts — 执行计划 orchestrator
 *
 * 第一次调用（planDoc 不存在）：收集需求/模板/规则上下文，输出供 AI 生成计划。
 * 第二次调用（planDoc 已写入）：验证 progressFile schema，输出完成状态。
 */

import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

import { parseArgs } from './lib/config-utils.ts'
import { findProjectRoot, getSafeCwd, FRAMEWORK_ROOT } from './lib/resolve-context.ts'
import {
  getRequirementDocPath,
  getActivePlanDocPath,
  getActiveProgressFilePath,
} from './lib/file-paths.ts'
import { parseFeatureHeaderFile } from './lib/feature-header.ts'
import { getProgressSchemaPaths, validateProgressFile } from './lib/progress-schema.ts'
import type { ProgressData } from './lib/types.ts'

const argv = process.argv.slice(2)
const { positional } = parseArgs(argv)
const [feature] = positional

if (!feature) {
  console.error('用法: hx plan <feature>')
  process.exit(1)
}

const projectRoot = findProjectRoot(getSafeCwd())

// 1. 定位并验证需求文档
const requirementDoc = getRequirementDocPath(projectRoot, feature)
if (!existsSync(requirementDoc)) {
  console.error(`❌ 需求文档不存在: ${requirementDoc}`)
  console.error(`   请先运行 hx doc ${feature}`)
  process.exit(1)
}

// 2. 解析 feature 头部（固化解析，不由 AI 解释）
let parsedHeader
try {
  parsedHeader = parseFeatureHeaderFile(requirementDoc)
} catch (err) {
  console.error(`❌ 需求文档头部解析失败: ${err.message}`)
  process.exit(1)
}

// 3. 读取文档类型（> Type: 字段）
const reqContent = readFileSync(requirementDoc, 'utf8')
const typeMatch = reqContent.match(/^>\s*Type:\s*(.+)$/m)
const docType = typeMatch ? typeMatch[1].trim().toLowerCase() : 'feature'

// 4. 选择计划模板（项目层优先，回退框架层）
const templateName = docType === 'bugfix' ? 'bugfix-plan-template.md' : 'plan-template.md'
const projectTemplatePath = resolve(projectRoot, '.hx', 'rules', templateName)
const frameworkTemplatePath = resolve(FRAMEWORK_ROOT, 'templates', 'rules', templateName)
const templatePath = existsSync(projectTemplatePath) ? projectTemplatePath : frameworkTemplatePath

// 5. 检查现有产物
const planDoc = getActivePlanDocPath(projectRoot, feature)
const progressFile = getActiveProgressFilePath(projectRoot, feature)
const { schemaPath, templatePath: progressTemplatePath } = getProgressSchemaPaths()
const planTemplateContent = readFileSync(templatePath, 'utf8')

const planExists = existsSync(planDoc)
const progressExists = existsSync(progressFile)

// ── 阶段二：planDoc 已存在 → 校验 progressFile ──────────────────────────────
if (planExists && progressExists) {
  const validation = validateProgressFile(progressFile)
  if (!validation.valid) {
    printSummary({
      ok: false,
      actionRequired: false,
      completed: false,
      feature,
      planDoc,
      progressFile,
      tasks: [],
      validation,
      nextAction: `hx fix ${feature}`,
    })
    process.exit(1)
  }

  const data = validation.data as ProgressData
  printSummary({
    ok: true,
    actionRequired: false,
    completed: true,
    feature,
    planDoc,
    progressFile,
    tasks: data.tasks.map((t) => ({ id: t.id, name: t.name, status: t.status, dependsOn: t.dependsOn, parallelizable: t.parallelizable })),
    validation: { valid: true, errors: [] },
    nextAction: `hx run ${feature}`,
  })
  process.exit(0)
}

// ── 阶段一：planDoc 不存在 → 收集上下文，供 AI 生成 ──────────────────────────
const goldenRules = resolveRuleFile(projectRoot, 'golden-rules.md')
const progressTemplateContent = existsSync(progressTemplatePath) ? readFileSync(progressTemplatePath, 'utf8') : null

printSummary({
  ok: true,
  actionRequired: true,
  completed: false,
  feature,
  planDoc,
  progressFile,
  tasks: [],
  validation: { valid: true, errors: [] },
  nextAction: `hx plan ${feature}`,
  context: {
    feature: parsedHeader.feature,
    displayName: parsedHeader.displayName,
    sourceId: parsedHeader.sourceId,
    docType,
    requirementContent: reqContent,
    planTemplate: planTemplateContent,
    goldenRules,
    progressTemplate: progressTemplateContent,
    progressSchemaPath: schemaPath,
    expectedOutput: { planDoc, progressFile },
  },
})

function resolveRuleFile(root: string, name: string): string | null {
  const projectFile = resolve(root, '.hx', 'rules', name)
  const frameworkFile = resolve(FRAMEWORK_ROOT, 'templates', 'rules', name)
  const targetPath = existsSync(projectFile) ? projectFile : frameworkFile
  return existsSync(targetPath) ? readFileSync(targetPath, 'utf8') : null
}

function toProjectRelativePath(filePath: string): string {
  return filePath.startsWith(`${projectRoot}/`) ? filePath.slice(projectRoot.length + 1) : filePath
}

function printSummary(summary: {
  ok: boolean
  actionRequired: boolean
  completed: boolean
  feature: string
  planDoc: string
  progressFile: string
  tasks: Array<{ id: string; name: string; status?: string; dependsOn: string[]; parallelizable: boolean }>
  validation: { valid: boolean; errors: string[] }
  nextAction: string
  context?: Record<string, unknown>
}) {
  const out: Record<string, unknown> = {
    ok: summary.ok,
    actionRequired: summary.actionRequired,
    completed: summary.completed,
    feature: summary.feature,
    planDoc: summary.planDoc,
    progressFile: summary.progressFile,
    tasks: summary.tasks,
    validation: summary.validation,
    nextAction: summary.nextAction,
  }
  if (summary.context) out.context = summary.context
  console.log(JSON.stringify(out, null, 2))
}
