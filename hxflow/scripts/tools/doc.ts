#!/usr/bin/env bun
/**
 * hx-doc.ts — 需求文档事实工具
 *
 * 用法：
 *   hx doc context <feature-or-source> [--type feature|bugfix] [--source-file <path>] [--from-context] [--force]
 *       收集生成需求文档所需的模板、规则、已有头部等事实
 *   hx doc validate <feature-or-source> [--type feature|bugfix]
 *       校验已存在的需求文档头部是否合规
 *
 * 所有子命令输出 JSON 到 stdout，失败时 exit 1。
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { basename, extname, relative, resolve } from 'path'

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
    if (!feature) err('用法：hx doc context <feature-or-source> [--type feature|bugfix] [--source-file <path>] [--from-context] [--force]')

    const rawType = String(options.type ?? 'feature')
    if (!VALID_TYPES.includes(rawType as DocType)) err(`--type "${rawType}" 无效，有效值: ${VALID_TYPES.join(', ')}`)
    const docType = rawType as DocType
    const sourceFile = typeof options['source-file'] === 'string' ? options['source-file'] : null
    const fromContext = options['from-context'] !== undefined
    const force = options.force !== undefined
    const resolvedSource = resolveDocSource(initialProjectRoot, feature, sourceFile, fromContext)
    const effectiveFeature = resolvedSource.feature

    const projectRoot = resolveFeatureArtifactRoot(initialProjectRoot, effectiveFeature)
    const requirementDoc = getRequirementDocPath(projectRoot, effectiveFeature)
    const docExists = existsSync(requirementDoc)

    const existingHeader = docExists
      ? parseRequirementHeaderFields(readFileSync(requirementDoc, 'utf8'))
      : null

    const configKey = docType === 'bugfix' ? 'bugfixRequirement' : 'requirement'
    const templatePath = resolveRequiredRuleTemplatePath(projectRoot, configKey)
    const templateContent = stripRequirementRuntimeMetadata(readFileSync(templatePath, 'utf8'))
    const headerTemplate = buildRequirementHeader(effectiveFeature, docType, existingHeader, resolvedSource.headerDefaults)
    const workspaceProjects = getWorkspaceProjects(projectRoot)

    out({
      ok: true,
      feature: effectiveFeature,
      requestedFeature: feature,
      docType,
      requirementDoc,
      docExists,
      overwrite: force && existingHeader !== null,
      headerTemplate,
      templateContent,
      sourceContent: resolvedSource.sourceContent,
      sourceFile: resolvedSource.sourceFile,
      existingHeader,
      requiredHeaderFields: [...REQUIRED_HEADER_FIELDS],
      workspace: workspaceProjects.length > 0 ? { projects: workspaceProjects } : null,
    })
    break
  }

  case 'validate': {
    if (!feature) err('用法：hx doc validate <feature-or-source> [--type feature|bugfix]')

    const rawType = String(options.type ?? 'feature')
    if (!VALID_TYPES.includes(rawType as DocType)) err(`--type "${rawType}" 无效，有效值: ${VALID_TYPES.join(', ')}`)
    const docType = rawType as DocType

    const directProjectRoot = resolveFeatureArtifactRoot(initialProjectRoot, feature)
    const directRequirementDoc = getRequirementDocPath(directProjectRoot, feature)
    const resolvedSource = existsSync(directRequirementDoc) ? null : resolveDocSource(initialProjectRoot, feature, null)
    const effectiveFeature = resolvedSource?.feature ?? feature
    const projectRoot = resolvedSource ? resolveFeatureArtifactRoot(initialProjectRoot, effectiveFeature) : directProjectRoot
    const requirementDoc = resolvedSource ? getRequirementDocPath(projectRoot, effectiveFeature) : directRequirementDoc
    if (!existsSync(requirementDoc)) {
      out({ ok: false, feature: effectiveFeature, requestedFeature: feature, docType, requirementDoc, exists: false, errors: ['需求文档不存在'] })
      process.exit(1)
    }

    const content = readFileSync(requirementDoc, 'utf8')
    try {
      const headerFields = validateRequirementHeader(content, effectiveFeature, docType)
      out({ ok: true, feature: effectiveFeature, requestedFeature: feature, docType, requirementDoc, exists: true, headerFields, errors: [] })
    } catch (error) {
      out({ ok: false, feature: effectiveFeature, requestedFeature: feature, docType, requirementDoc, exists: true, errors: [error instanceof Error ? error.message : String(error)] })
      process.exit(1)
    }
    break
  }

  default:
    err(`未知子命令 "${sub ?? ''}"，可用：context / validate`)
}

interface ResolvedDocSource {
  feature: string
  sourceFile: string | null
  sourceContent: string | null
  headerDefaults: Record<string, string>
}

function resolveDocSource(projectRoot: string, requestedFeature: string, sourceFile: string | null, fromContext = false): ResolvedDocSource {
  if (sourceFile && fromContext) err('--source-file 与 --from-context 不能同时使用')
  if (fromContext) return { feature: requestedFeature, sourceFile: null, sourceContent: null, headerDefaults: {} }

  if (sourceFile) {
    return buildSourceResult(projectRoot, sourceFile)
  }

  const requestedPath = resolve(cwd, requestedFeature)
  if (isReadableFile(requestedPath)) return buildSourceResult(projectRoot, requestedPath)

  const candidates = findSourceCandidates(projectRoot, requestedFeature)
  if (candidates.length === 0) {
    err(`未找到需求来源文件：${requestedFeature}。请传入 source 文件路径，或先从当前上下文推理出明确的 featureName。`)
  }
  if (candidates.length > 1) {
    err(`找到多个需求来源文件，不能静默选择：${candidates.map((item) => normalizePath(relative(projectRoot, item))).join(', ')}`)
  }

  return buildSourceResult(projectRoot, candidates[0])
}

function buildSourceResult(projectRoot: string, filePath: string): ResolvedDocSource {
  const absPath = resolve(cwd, filePath)
  if (!isReadableFile(absPath)) err(`source file 路径不存在或不是文件: ${absPath}`)
  const featureName = basename(absPath, extname(absPath))
  return {
    feature: featureName,
    sourceFile: absPath,
    sourceContent: readFileSync(absPath, 'utf8'),
    headerDefaults: { 'Source ID': normalizePath(relative(projectRoot, absPath)) },
  }
}

function findSourceCandidates(projectRoot: string, requestedFeature: string): string[] {
  const requested = requestedFeature.trim().toLowerCase()
  const roots = unique([projectRoot, ...getWorkspaceProjects(projectRoot).map((project) => project.root)])
  return unique(roots
    .flatMap((root) => scanMarkdownFiles(root))
    .filter((filePath) => {
      const name = basename(filePath, extname(filePath)).toLowerCase()
      return name === requested || (/^\d+$/.test(requested) && name.startsWith(`${requested}-`))
    }))
}

function scanMarkdownFiles(root: string): string[] {
  if (!existsSync(root)) return []
  const result: string[] = []
  const stack = [root]
  while (stack.length > 0) {
    const dir = stack.pop()
    if (!dir) continue
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const absPath = resolve(dir, entry.name)
      if (entry.isDirectory()) {
        if (!shouldSkipDir(entry.name, absPath, root)) stack.push(absPath)
        continue
      }
      if (entry.isFile() && entry.name.endsWith('.md') && !isGeneratedHxArtifact(absPath, root)) {
        result.push(absPath)
      }
    }
  }
  return result
}

function shouldSkipDir(name: string, absPath: string, root: string): boolean {
  if (['.git', '.hx', 'node_modules', 'dist', 'build', 'coverage'].includes(name)) return true
  const rel = normalizePath(relative(root, absPath))
  return rel === 'docs/requirement' || rel === 'docs/plans' || rel.startsWith('docs/archive/')
}

function isGeneratedHxArtifact(filePath: string, root: string): boolean {
  const rel = normalizePath(relative(root, filePath))
  return rel.startsWith('docs/requirement/') || rel.startsWith('docs/plans/') || rel.startsWith('docs/archive/')
}

function isReadableFile(filePath: string): boolean {
  try {
    return existsSync(filePath) && statSync(filePath).isFile()
  } catch {
    return false
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

function normalizePath(path: string): string {
  return path.replaceAll('\\', '/')
}
