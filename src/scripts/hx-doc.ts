#!/usr/bin/env node

/**
 * hx-doc.ts — 需求文档 orchestrator
 *
 * 阶段一（文档不存在）：收集模板和上下文，actionRequired:true，AI 写文件。
 * 阶段二（文档已存在）：校验头部 5 字段，completed:true。
 * --force：跳过阶段二，重新进入阶段一。
 */

import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

import { parseArgs } from './lib/config-utils.ts'
import { FRAMEWORK_ROOT, findProjectRoot, getSafeCwd } from './lib/resolve-context.ts'
import { getRequirementDocPath } from './lib/file-paths.ts'

const VALID_TYPES = ['feature', 'bugfix'] as const
type DocType = (typeof VALID_TYPES)[number]

const REQUIRED_HEADER_FIELDS = ['Feature', 'Display Name', 'Source ID', 'Source Fingerprint', 'Type'] as const

const argv = process.argv.slice(2)
const { positional, options } = parseArgs(argv)
const [feature] = positional

if (!feature) {
  console.error('用法: hx doc <feature> [--type <feature|bugfix>] [--source-file <path>] [--force]')
  process.exit(1)
}

const rawType = options.type ?? 'feature'
if (!VALID_TYPES.includes(rawType as DocType)) {
  console.error(`❌ --type "${rawType}" 无效，有效值: ${VALID_TYPES.join(', ')}`)
  process.exit(1)
}
const docType = rawType as DocType
const sourceFile = options['source-file'] ?? null
const force = options.force !== undefined

const projectRoot = findProjectRoot(getSafeCwd())
const requirementDoc = getRequirementDocPath(projectRoot, feature)

// ── 阶段二：文档已存在且非 force → 校验 header ───────────────────────────────
if (existsSync(requirementDoc) && !force) {
  const content = readFileSync(requirementDoc, 'utf8')
  let headerFields: Record<string, string>
  try {
    headerFields = validateDocHeader(content, feature, docType)
  } catch (err) {
    console.log(JSON.stringify({
      ok: false,
      actionRequired: false,
      completed: false,
      feature,
      docType,
      requirementDoc,
      reason: err instanceof Error ? err.message : String(err),
      nextAction: `hx doc ${feature} --force`,
    }, null, 2))
    process.exit(1)
  }

  console.log(JSON.stringify({
    ok: true,
    actionRequired: false,
    completed: true,
    feature,
    docType,
    requirementDoc,
    headerFields,
    nextAction: `hx plan ${feature}`,
  }, null, 2))
  process.exit(0)
}

// ── 阶段一：收集上下文，供 AI 生成文档 ──────────────────────────────────────
const existingHeader = existsSync(requirementDoc) && force
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

console.log(JSON.stringify({
  ok: true,
  actionRequired: true,
  completed: false,
  feature,
  docType,
  requirementDoc,
  context: {
    feature,
    docType,
    templateContent,
    goldenRules,
    featureContract,
    sourceContent,
    existingHeader,
    overwrite: force && existingHeader !== null,
    requiredHeaderFields: REQUIRED_HEADER_FIELDS,
  },
  nextAction: `hx doc ${feature}`,
}, null, 2))

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
  if (!existsSync(absPath)) {
    console.error(`❌ --source-file 路径不存在: ${absPath}`)
    process.exit(1)
  }
  return readFileSync(absPath, 'utf8')
}

function resolveRuleFile(projectRootPath: string, name: string): string | null {
  const project = resolve(projectRootPath, '.hx', 'rules', name)
  const framework = resolve(FRAMEWORK_ROOT, 'templates', 'rules', name)
  if (existsSync(project)) return readFileSync(project, 'utf8')
  if (existsSync(framework)) return readFileSync(framework, 'utf8')
  return null
}
