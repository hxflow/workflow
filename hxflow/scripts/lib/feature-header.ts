/**
 * feature-header.js — 需求文档固定头部解析
 *
 * 把 feature-contract 中「文档头部解析规则」固化为代码。
 * 4 行头部、固定顺序、固定标签，任何格式错误立即抛出。
 */

import { readFileSync } from 'fs'

const HEADER_FIELDS = ['Feature', 'Display Name', 'Source ID', 'Source Fingerprint', 'Type']
const HEADER_LINE_PATTERN = /^>\s*(Feature|Display Name|Source ID|Source Fingerprint|Type):\s*(.*)$/
const REQUIREMENT_DOC_FIELDS = ['Feature', 'Display Name', 'Source ID', 'Source Fingerprint', 'Type'] as const

export type RequirementDocType = 'feature' | 'bugfix'

export interface RequirementHeaderFields {
  Feature: string
  'Display Name': string
  'Source ID': string
  'Source Fingerprint': string
  Type: RequirementDocType
}

/**
 * 从需求文档内容字符串解析头部 5 行。
 *
 * 解析规则（来自 feature-contract）：
 *   - 只识别 5 个固定标签，标签名大小写完全一致
 *   - 5 个字段必须按固定顺序出现
 *   - 5 行头部出现在文档标题下方、正文 ## 小节之前
 *   - Feature 值不能为空，否则视为无效需求文档
 *   - 存在重复字段、缺失字段、换序或未知头部字段，视为格式非法
 *
 * @param {string} content - 需求文档内容
 * @returns {{ feature: string, displayName: string, sourceId: string, sourceFingerprint: string, type: RequirementDocType }}
 * @throws {Error} 头部格式非法或 feature 为空时抛出
 */
export function parseFeatureHeader(content: string) {
  const lines = content.split('\n')
  const titleIndex = lines.findIndex((line: string) => line.trim() !== '')
  const firstSectionIndex = lines.findIndex((line: string, index: number) => index > titleIndex && /^##\s+/.test(line.trim()))
  const preambleEnd = firstSectionIndex === -1 ? lines.length : firstSectionIndex
  const preambleLines = lines.slice(titleIndex + 1, preambleEnd)
  const found: Array<{ label: string; value: string }> = []

  for (const line of preambleLines) {
    const trimmed = line.trim()
    if (trimmed === '') continue
    if (!trimmed.startsWith('>')) continue

    const match = line.match(HEADER_LINE_PATTERN)
    if (!match) {
      throw new Error(`头部格式非法：存在未知头部字段 "${trimmed}"`)
    }

    const label = match[1]
    const value = match[2].trim()

    if (found.some((item) => item.label === label)) {
      throw new Error(`头部格式非法：存在重复字段 "${label}"`)
    }

    found.push({ label, value })

    if (found.length === 5) break
  }

  if (found.length < 5) {
    const missing = HEADER_FIELDS.filter((f) => !found.some((item) => item.label === f))
    throw new Error(`头部格式非法：缺少字段 ${missing.map((f) => `"${f}"`).join(', ')}`)
  }

  for (let i = 0; i < HEADER_FIELDS.length; i++) {
    if (found[i].label !== HEADER_FIELDS[i]) {
      throw new Error(
        `头部格式非法：字段顺序错误，期望第 ${i + 1} 个为 "${HEADER_FIELDS[i]}"，实际为 "${found[i].label}"`
      )
    }
  }

  const feature = found[0].value
  if (!feature) {
    throw new Error('无效需求文档：Feature 字段值为空')
  }

  const typeValue = found[4].value.toLowerCase()
  if (typeValue !== 'feature' && typeValue !== 'bugfix') {
    throw new Error(`头部格式非法：Type 值 "${found[4].value}" 无效，有效值: feature, bugfix`)
  }

  return {
    feature,
    displayName: found[1].value,
    sourceId: found[2].value,
    sourceFingerprint: found[3].value,
    type: typeValue as RequirementDocType,
  }
}

/**
 * 从需求文档文件解析头部。
 *
 * @param {string} filePath - 需求文档绝对路径
 * @returns {{ feature: string, displayName: string, sourceId: string, sourceFingerprint: string, type: RequirementDocType }}
 * @throws {Error} 文件不存在、无法读取或头部格式非法时抛出
 */
export function parseFeatureHeaderFile(filePath: string) {
  const content = readFileSync(filePath, 'utf8')
  return parseFeatureHeader(content)
}

export function parseRequirementHeaderFields(content: string): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const line of content.split('\n')) {
    const match = line.match(/^>\s*(.+?):\s*(.+)$/)
    if (match) fields[match[1].trim()] = match[2].trim()
    if (line.trim() && !line.startsWith('>') && !line.startsWith('#') && Object.keys(fields).length > 0) break
  }
  return fields
}

export function buildRequirementHeader(
  feature: string,
  docType: RequirementDocType,
  existingHeader: Record<string, string> | null,
): string {
  const fields: RequirementHeaderFields = {
    Feature: existingHeader?.Feature ?? feature,
    'Display Name': existingHeader?.['Display Name'] ?? '',
    'Source ID': existingHeader?.['Source ID'] ?? '',
    'Source Fingerprint': existingHeader?.['Source Fingerprint'] ?? '',
    Type: ((existingHeader?.Type ?? docType) as RequirementDocType),
  }

  return [
    `> Feature: ${fields.Feature}`,
    `> Display Name: ${fields['Display Name']}`,
    `> Source ID: ${fields['Source ID']}`,
    `> Source Fingerprint: ${fields['Source Fingerprint']}`,
    `> Type: ${fields.Type}`,
  ].join('\n')
}

export function stripRequirementRuntimeMetadata(templateContent: string): string {
  return templateContent
    .replace(/^>\s*Feature:.*\n?/gm, '')
    .replace(/^>\s*Display Name:.*\n?/gm, '')
    .replace(/^>\s*Source ID:.*\n?/gm, '')
    .replace(/^>\s*Source Fingerprint:.*\n?/gm, '')
    .replace(/^>\s*Type:.*\n?/gm, '')
    .replace(/\n{3,}/g, '\n\n')
}

export function validateRequirementHeader(
  content: string,
  expectedFeature: string,
  expectedType: RequirementDocType,
): Record<string, string> {
  const fields = parseRequirementHeaderFields(content)

  for (const required of REQUIREMENT_DOC_FIELDS) {
    if (!fields[required] || !fields[required].trim()) {
      throw new Error(`需求文档头部缺少必填字段: "${required}"`)
    }
  }

  if (fields.Feature !== expectedFeature) {
    throw new Error(`头部 Feature 值 "${fields.Feature}" 与参数 feature "${expectedFeature}" 不匹配`)
  }

  const aiType = fields.Type.toLowerCase()
  if (aiType !== 'feature' && aiType !== 'bugfix') {
    throw new Error(`头部 Type 值 "${fields.Type}" 无效，有效值: feature, bugfix`)
  }

  if (aiType !== expectedType) {
    throw new Error(`头部 Type "${aiType}" 与 --type "${expectedType}" 不匹配`)
  }

  return fields
}
