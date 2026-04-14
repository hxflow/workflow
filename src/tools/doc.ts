#!/usr/bin/env node

/**
 * hx-doc.ts — 需求文档事实工具
 *
 * 用法：
 *   hx doc context <feature> [--type feature|bugfix] [--source-file <path>] [--force]
 *       收集生成需求文档所需的模板、规则、已有头部等事实
 *   hx doc validate <feature> [--type feature|bugfix]
 *       校验已存在的需求文档头部是否合规
 *
 * 所有子命令输出 JSON 到 stdout，失败时 exit 1。
 */

import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

import { parseArgs } from '../lib/config-utils.ts'
import { FRAMEWORK_ROOT, findProjectRoot, getSafeCwd } from '../lib/resolve-context.ts'
import { getRequirementDocPath } from '../lib/file-paths.ts'

const VALID_TYPES = ['feature', 'bugfix'] as const
type DocType = (typeof VALID_TYPES)[number]

const REQUIRED_HEADER_FIELDS = ['Feature', 'Display Name', 'Source ID', 'Source Fingerprint', 'Type'] as const

const argv = process.argv.slice(2)
const [sub, ...rest] = argv
const { positional, options } = parseArgs(rest)
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
    if (!feature) err('用法：hx doc context <feature> [--type feature|bugfix] [--source-file <path>] [--force]')

    const rawType = options.type ?? 'feature'
    if (!VALID_TYPES.includes(rawType as DocType)) err(`--type "${rawType}" 无效，有效值: ${VALID_TYPES.join(', ')}`)
    const docType = rawType as DocType
    const sourceFile = options['source-file'] ?? null
    const force = options.force !== undefined

    const requirementDoc = getRequirementDocPath(projectRoot, feature)
    const docExists = existsSync(requirementDoc)

    const existingHeader = docExists
      ? parseHeaderFields(readFileSync(requirementDoc, 'utf8'))
      : null

    const sourceContent = sourceFile ? readSourceFile(sourceFile) : null

    const templateName = docType === 'bugfix' ? 'bugfix-requirement-template.md' : 'requirement-template.md'
    const projectTemplate = resolve(projectRoot, '.hx', 'rules', templateName)
    const frameworkTemplate = resolve(FRAMEWORK_ROOT, 'templates', 'rules', templateName)
    const templatePath = existsSync(projectTemplate) ? projectTemplate : frameworkTemplate
    const templateContent = readFileSync(templatePath, 'utf8')

    const goldenRules = resolveRuleFile(projectRoot, 'golden-rules.md')
    const featureContractPath = resolve(FRAMEWORK_ROOT, 'contracts', 'feature-contract.md')
    const featureContract = existsSync(featureContractPath) ? readFileSync(featureContractPath, 'utf8') : null

    out({
      ok: true,
      feature,
      docType,
      requirementDoc,
      docExists,
      overwrite: force && existingHeader !== null,
      templateContent,
      goldenRules,
      featureContract,
      sourceContent,
      existingHeader,
      requiredHeaderFields: [...REQUIRED_HEADER_FIELDS],
    })
    break
  }

  case 'validate': {
    if (!feature) err('用法：hx doc validate <feature> [--type feature|bugfix]')

    const rawType = options.type ?? 'feature'
    if (!VALID_TYPES.includes(rawType as DocType)) err(`--type "${rawType}" 无效，有效值: ${VALID_TYPES.join(', ')}`)
    const docType = rawType as DocType

    const requirementDoc = getRequirementDocPath(projectRoot, feature)
    if (!existsSync(requirementDoc)) {
      out({ ok: false, feature, docType, requirementDoc, exists: false, errors: ['需求文档不存在'] })
      process.exit(1)
    }

    const content = readFileSync(requirementDoc, 'utf8')
    try {
      const headerFields = validateDocHeader(content, feature, docType)
      out({ ok: true, feature, docType, requirementDoc, exists: true, headerFields, errors: [] })
    } catch (error) {
      out({ ok: false, feature, docType, requirementDoc, exists: true, errors: [error instanceof Error ? error.message : String(error)] })
      process.exit(1)
    }
    break
  }

  default:
    err(`未知子命令 "${sub ?? ''}"，可用：context / validate`)
}

// ── helpers ──────────────────────────────────────────────────────────────────

function parseHeaderFields(content: string): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const line of content.split('\n')) {
    const m = line.match(/^>\s*(.+?):\s*(.+)$/)
    if (m) fields[m[1].trim()] = m[2].trim()
    if (line.trim() && !line.startsWith('>') && !line.startsWith('#') && Object.keys(fields).length > 0) break
  }
  return fields
}

function validateDocHeader(content: string, expectedFeature: string, expectedType: DocType): Record<string, string> {
  const fields = parseHeaderFields(content)

  for (const required of REQUIRED_HEADER_FIELDS) {
    if (!fields[required] || !fields[required].trim()) {
      throw new Error(`需求文档头部缺少必填字段: "${required}"`)
    }
  }

  if (fields['Feature'] !== expectedFeature) {
    throw new Error(`头部 Feature 值 "${fields['Feature']}" 与参数 feature "${expectedFeature}" 不匹配`)
  }

  const aiType = fields['Type'].toLowerCase()
  if (!VALID_TYPES.includes(aiType as DocType)) {
    throw new Error(`头部 Type 值 "${fields['Type']}" 无效，有效值: ${VALID_TYPES.join(', ')}`)
  }

  if (aiType !== expectedType) {
    throw new Error(`头部 Type "${aiType}" 与 --type "${expectedType}" 不匹配`)
  }

  return fields
}

function readSourceFile(filePath: string): string {
  const absPath = resolve(filePath)
  if (!existsSync(absPath)) err(`--source-file 路径不存在: ${absPath}`)
  return readFileSync(absPath, 'utf8')
}

function resolveRuleFile(projectRootPath: string, name: string): string | null {
  const project = resolve(projectRootPath, '.hx', 'rules', name)
  const framework = resolve(FRAMEWORK_ROOT, 'templates', 'rules', name)
  if (existsSync(project)) return readFileSync(project, 'utf8')
  if (existsSync(framework)) return readFileSync(framework, 'utf8')
  return null
}
