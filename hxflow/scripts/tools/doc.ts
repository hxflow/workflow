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

import { getRequirementDocPath, getWorkspaceProjects, resolveFeatureArtifactRoot } from '../lib/file-paths.ts'
import { exitWithJsonError as err, printJson as out } from '../lib/json-cli.ts'
import { resolveRequiredRuleTemplatePath } from '../lib/rule-resolver.ts'
import { createToolContext } from '../lib/tool-cli.ts'
import {
  buildRequirementHeader,
  parseRequirementHeaderFields,
  stripRequirementRuntimeMetadata,
  validateRequirementHeader,
} from '../lib/feature-header.ts'

const VALID_TYPES = ['feature', 'bugfix'] as const
type DocType = (typeof VALID_TYPES)[number]

const REQUIRED_HEADER_FIELDS = ['Feature', 'Display Name', 'Source ID', 'Source Fingerprint', 'Type'] as const

const { cwd, sub, positional, options, projectRoot: initialProjectRoot } = createToolContext()
const [feature] = positional

switch (sub) {
  case 'context': {
    if (!feature) err('用法：hx doc context <feature> [--type feature|bugfix] [--source-file <path>] [--force]')

    const rawType = String(options.type ?? 'feature')
    if (!VALID_TYPES.includes(rawType as DocType)) err(`--type "${rawType}" 无效，有效值: ${VALID_TYPES.join(', ')}`)
    const docType = rawType as DocType
    const sourceFile = typeof options['source-file'] === 'string' ? options['source-file'] : null
    const force = options.force !== undefined

    const projectRoot = resolveFeatureArtifactRoot(initialProjectRoot, feature)
    const requirementDoc = getRequirementDocPath(projectRoot, feature)
    const docExists = existsSync(requirementDoc)

    const existingHeader = docExists
      ? parseRequirementHeaderFields(readFileSync(requirementDoc, 'utf8'))
      : null

    const sourceContent = sourceFile ? readSourceFile(sourceFile) : null

    const configKey = docType === 'bugfix' ? 'bugfixRequirement' : 'requirement'
    const templatePath = resolveRequiredRuleTemplatePath(projectRoot, configKey)
    const templateContent = stripRequirementRuntimeMetadata(readFileSync(templatePath, 'utf8'))
    const headerTemplate = buildRequirementHeader(feature, docType, existingHeader)
    const workspaceProjects = getWorkspaceProjects(projectRoot)

    out({
      ok: true,
      feature,
      docType,
      requirementDoc,
      docExists,
      overwrite: force && existingHeader !== null,
      headerTemplate,
      templateContent,
      sourceContent,
      existingHeader,
      requiredHeaderFields: [...REQUIRED_HEADER_FIELDS],
      workspace: workspaceProjects.length > 0 ? { projects: workspaceProjects } : null,
    })
    break
  }

  case 'validate': {
    if (!feature) err('用法：hx doc validate <feature> [--type feature|bugfix]')

    const rawType = String(options.type ?? 'feature')
    if (!VALID_TYPES.includes(rawType as DocType)) err(`--type "${rawType}" 无效，有效值: ${VALID_TYPES.join(', ')}`)
    const docType = rawType as DocType

    const projectRoot = resolveFeatureArtifactRoot(initialProjectRoot, feature)
    const requirementDoc = getRequirementDocPath(projectRoot, feature)
    if (!existsSync(requirementDoc)) {
      out({ ok: false, feature, docType, requirementDoc, exists: false, errors: ['需求文档不存在'] })
      process.exit(1)
    }

    const content = readFileSync(requirementDoc, 'utf8')
    try {
      const headerFields = validateRequirementHeader(content, feature, docType)
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

function readSourceFile(filePath: string): string {
  const absPath = resolve(cwd, filePath)
  if (!existsSync(absPath)) err(`--source-file 路径不存在: ${absPath}`)
  return readFileSync(absPath, 'utf8')
}
