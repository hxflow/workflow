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

import {
  getRequirementDocPath,
  getActivePlanDocPath,
  getActiveProgressFilePath,
  resolveFeatureArtifactRoot,
} from '../lib/file-paths.ts'
import { parseFeatureHeaderFile, parseRequirementHeaderFields } from '../lib/feature-header.ts'
import { exitWithJsonError as err, printJson as out } from '../lib/json-cli.ts'
import { loadValidatedProgressFile } from '../lib/progress-context.ts'
import { resolveRequiredRuleTemplatePath } from '../lib/rule-resolver.ts'
import { createToolContext } from '../lib/tool-cli.ts'

const { sub, positional, projectRoot: initialProjectRoot } = createToolContext()
const [feature] = positional

switch (sub) {
  case 'context': {
    if (!feature) err('用法：hx plan context <feature>')

    const projectRoot = resolveFeatureArtifactRoot(initialProjectRoot, feature)
    const requirementDoc = getRequirementDocPath(projectRoot, feature)
    if (!existsSync(requirementDoc)) err(`需求文档不存在: ${requirementDoc}，请先运行 hx doc context ${feature}`)

    const reqContent = readFileSync(requirementDoc, 'utf8')
    const rawFields = parseRequirementHeaderFields(reqContent)
    const missingLegacyFields = ['Feature', 'Display Name', 'Source ID', 'Source Fingerprint']
      .filter((key) => !rawFields[key]?.trim())

    if (missingLegacyFields.length > 0) {
      err(`需求文档头部解析失败: 缺少字段 ${missingLegacyFields.map((key) => `"${key}"`).join(', ')}`)
    }

    let parsedHeader
    if (rawFields.Type?.trim()) {
      try {
        parsedHeader = parseFeatureHeaderFile(requirementDoc)
      } catch (error) {
        err(`需求文档头部解析失败: ${error instanceof Error ? error.message : String(error)}`)
      }
    } else {
      parsedHeader = {
        feature: rawFields.Feature.trim(),
        displayName: rawFields['Display Name'].trim(),
        sourceId: rawFields['Source ID'].trim(),
        sourceFingerprint: rawFields['Source Fingerprint'].trim(),
        type: 'feature' as const,
      }
    }

    const docType = parsedHeader.type

    const templatePath = resolveRequiredRuleTemplatePath(projectRoot, docType === 'bugfix' ? 'bugfixPlan' : 'plan')

    const planDoc = getActivePlanDocPath(projectRoot, feature)
    const progressFile = getActiveProgressFilePath(projectRoot, feature)
    const planTemplateContent = readFileSync(templatePath, 'utf8')

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
    })
    break
  }

  case 'validate': {
    if (!feature) err('用法：hx plan validate <feature>')

    const projectRoot = resolveFeatureArtifactRoot(initialProjectRoot, feature)
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

    try {
      const { data } = loadValidatedProgressFile(progressFile)
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
    } catch (error) {
      out({
        ok: false,
        feature,
        planDoc,
        progressFile,
        planExists,
        progressExists,
        errors: [error instanceof Error ? error.message : String(error)],
      })
      process.exit(1)
    }
    break
  }

  default:
    err(`未知子命令 "${sub ?? ''}"，可用：context / validate`)
}
