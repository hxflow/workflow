/**
 * feature-header.js — 需求文档固定头部解析
 *
 * 把 feature-contract 中「文档头部解析规则」固化为代码。
 * 4 行头部、固定顺序、固定标签，任何格式错误立即抛出。
 */

import { readFileSync } from 'fs'

const HEADER_FIELDS = ['Feature', 'Display Name', 'Source ID', 'Source Fingerprint']
const HEADER_LINE_PATTERN = /^>\s*(Feature|Display Name|Source ID|Source Fingerprint):\s*(.*)$/

/**
 * 从需求文档内容字符串解析头部 4 行。
 *
 * 解析规则（来自 feature-contract）：
 *   - 只识别 4 个固定标签，标签名大小写完全一致
 *   - 4 个字段必须按固定顺序出现
 *   - 4 行头部出现在文档标题下方、正文 ## 小节之前
 *   - Feature 值不能为空，否则视为无效需求文档
 *   - 存在重复字段、缺失字段、换序或未知头部字段，视为格式非法
 *
 * @param {string} content - 需求文档内容
 * @returns {{ feature: string, displayName: string, sourceId: string, sourceFingerprint: string }}
 * @throws {Error} 头部格式非法或 feature 为空时抛出
 */
export function parseFeatureHeader(content) {
  const lines = content.split('\n')
  const titleIndex = lines.findIndex((line) => line.trim() !== '')
  const firstSectionIndex = lines.findIndex((line, index) => index > titleIndex && /^##\s+/.test(line.trim()))
  const preambleEnd = firstSectionIndex === -1 ? lines.length : firstSectionIndex
  const preambleLines = lines.slice(titleIndex + 1, preambleEnd)
  const found = []

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

    if (found.length === 4) break
  }

  if (found.length < 4) {
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

  return {
    feature,
    displayName: found[1].value,
    sourceId: found[2].value,
    sourceFingerprint: found[3].value,
  }
}

/**
 * 从需求文档文件解析头部。
 *
 * @param {string} filePath - 需求文档绝对路径
 * @returns {{ feature: string, displayName: string, sourceId: string, sourceFingerprint: string }}
 * @throws {Error} 文件不存在、无法读取或头部格式非法时抛出
 */
export function parseFeatureHeaderFile(filePath) {
  const content = readFileSync(filePath, 'utf8')
  return parseFeatureHeader(content)
}
