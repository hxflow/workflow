#!/usr/bin/env node

/**
 * hx-plan.ts — 执行计划事实工具
 *
 * 用法：
 *   hx plan context <feature>       收集生成计划所需的事实（需求、模板、规则）
 *   hx plan validate <feature>      校验已存在的 planDoc + progressFile
 *
 * 所有子命令输出 JSON 到 stdout，失败时 exit 1。
 */

import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

import { parseArgs } from '../lib/config-utils.ts'
import { findProjectRoot, getSafeCwd, FRAMEWORK_ROOT } from '../lib/resolve-context.ts'
import {
  getRequirementDocPath,
  getActivePlanDocPath,
  getActiveProgressFilePath,
} from '../lib/file-paths.ts'
import { parseFeatureHeaderFile } from '../lib/feature-header.ts'
import { getProgressSchemaPaths, validateProgressFile } from '../lib/progress-schema.ts'
import type { ProgressData } from '../lib/types.ts'

const argv = process.argv.slice(2)
const [sub, ...rest] = argv
const { positional } = parseArgs(rest)
const [feature] = positional

function out(data: unknown) {
  console.log(JSON.stringify(data, null, 2))
}

function err(message: string): never {
  console.error(JSON.stringify({ ok: false, error: message }))
  process.exit(1)
}

const projectRoot = findProjectRoot(getSafeCwd())

switch (sub) {
  case 'context': {
    if (!feature) err('用法：hx plan context <feature>')

    const requirementDoc = getRequirementDocPath(projectRoot, feature)
    if (!existsSync(requirementDoc)) err(`需求文档不存在: ${requirementDoc}，请先运行 hx doc context ${feature}`)

    let parsedHeader
    try {
      parsedHeader = parseFeatureHeaderFile(requirementDoc)
    } catch (error) {
      err(`需求文档头部解析失败: ${error instanceof Error ? error.message : String(error)}`)
    }

    const reqContent = readFileSync(requirementDoc, 'utf8')
    const typeMatch = reqContent.match(/^>\s*Type:\s*(.+)$/m)
    const docType = typeMatch ? typeMatch[1].trim().toLowerCase() : 'feature'

    const templateName = docType === 'bugfix' ? 'bugfix-plan-template.md' : 'plan-template.md'
    const projectTemplatePath = resolve(projectRoot, '.hx', 'rules', templateName)
    const frameworkTemplatePath = resolve(FRAMEWORK_ROOT, 'templates', 'rules', templateName)
    const templatePath = existsSync(projectTemplatePath) ? projectTemplatePath : frameworkTemplatePath

    const planDoc = getActivePlanDocPath(projectRoot, feature)
    const progressFile = getActiveProgressFilePath(projectRoot, feature)
    const { schemaPath, templatePath: progressTemplatePath } = getProgressSchemaPaths()
    const planTemplateContent = readFileSync(templatePath, 'utf8')
    const goldenRules = resolveRuleFile(projectRoot, 'golden-rules.md')
    const progressTemplateContent = existsSync(progressTemplatePath) ? readFileSync(progressTemplatePath, 'utf8') : null

    out({
      ok: true,
      feature: parsedHeader.feature,
      displayName: parsedHeader.displayName,
      sourceId: parsedHeader.sourceId,
      docType,
      planDoc,
      progressFile,
      planExists: existsSync(planDoc),
      progressExists: existsSync(progressFile),
      requirementContent: reqContent,
      planTemplate: planTemplateContent,
      goldenRules,
      progressTemplate: progressTemplateContent,
      progressSchemaPath: schemaPath,
    })
    break
  }

  case 'validate': {
    if (!feature) err('用法：hx plan validate <feature>')

    const planDoc = getActivePlanDocPath(projectRoot, feature)
    const progressFile = getActiveProgressFilePath(projectRoot, feature)
    const planExists = existsSync(planDoc)
    const progressExists = existsSync(progressFile)

    if (!planExists) {
      out({ ok: false, feature, planDoc, progressFile, planExists, progressExists, errors: ['planDoc 不存在'] })
      process.exit(1)
    }

    if (!progressExists) {
      out({ ok: false, feature, planDoc, progressFile, planExists, progressExists, errors: ['progressFile 不存在'] })
      process.exit(1)
    }

    const validation = validateProgressFile(progressFile)
    if (!validation.valid) {
      out({ ok: false, feature, planDoc, progressFile, planExists, progressExists, errors: validation.errors })
      process.exit(1)
    }

    const data = validation.data as ProgressData
    out({
      ok: true,
      feature,
      planDoc,
      progressFile,
      planExists,
      progressExists,
      errors: [],
      tasks: data.tasks.map((t) => ({ id: t.id, name: t.name, status: t.status, dependsOn: t.dependsOn, parallelizable: t.parallelizable })),
    })
    break
  }

  default:
    err(`未知子命令 "${sub ?? ''}"，可用：context / validate`)
}

function resolveRuleFile(root: string, name: string): string | null {
  const projectFile = resolve(root, '.hx', 'rules', name)
  const frameworkFile = resolve(FRAMEWORK_ROOT, 'templates', 'rules', name)
  const targetPath = existsSync(projectFile) ? projectFile : frameworkFile
  return existsSync(targetPath) ? readFileSync(targetPath, 'utf8') : null
}
