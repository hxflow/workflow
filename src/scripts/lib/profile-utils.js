import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

const DEFAULT_PROFILE = 'base'
const PROFILE_USAGE = '任意存在的 profile 名称（默认 base）'

const SHORT_FLAGS = {
  p: 'profile',
  t: 'target',
  y: 'yes',
  h: 'help',
}

export function parseArgs(argv) {
  const positional = []
  const options = {}

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg.startsWith('-') && !arg.startsWith('--') && arg.length === 2) {
      const longKey = SHORT_FLAGS[arg[1]]
      if (longKey) {
        const next = argv[index + 1]
        if (next && !next.startsWith('-')) {
          options[longKey] = next
          index += 1
        } else {
          options[longKey] = true
        }
      } else {
        positional.push(arg)
      }
      continue
    }

    if (!arg.startsWith('--')) {
      positional.push(arg)
      continue
    }

    const eqIndex = arg.indexOf('=')
    if (eqIndex !== -1) {
      const key = arg.slice(2, eqIndex)
      const value = arg.slice(eqIndex + 1)
      options[key] = value === '' ? true : value
      continue
    }

    const key = arg.slice(2)
    const next = argv[index + 1]
    if (next && !next.startsWith('-')) {
      options[key] = next
      index += 1
      continue
    }

    options[key] = true
  }

  return { positional, options }
}

export function parseProfileSpecifier(specifier) {
  const raw = (specifier || '').trim()
  if (!raw) {
    return null
  }

  if (raw.includes('/') || raw.includes('\\') || raw === '.' || raw === '..') {
    throw new Error(`无效的 profile: ${raw}。可用值: ${PROFILE_USAGE}`)
  }

  return {
    profile: raw,
    team: raw,
    platform: null,
    label: raw,
    platformLabel: null
  }
}

/**
 * 加载 profile。
 *
 * @param {string}   frameworkRoot - 框架安装目录（内置 profiles）
 * @param {string}   specifier     - profile 标识符，如 "base"、"my-team"、"go-ddd"
 * @param {object}   [opts]
 * @param {string[]} [opts.searchRoots] - profile 查找根目录列表（优先级高→低），默认 [frameworkRoot]
 */
export function loadProfile(frameworkRoot, specifier, opts = {}) {
  const searchRoots = opts.searchRoots || [frameworkRoot]
  const parsed = parseProfileSpecifier(specifier || DEFAULT_PROFILE)
  if (!parsed) throw new Error(`缺少 profile。可用值: ${PROFILE_USAGE}`)

  const teamRoot = findProfileRoot(searchRoots, parsed.team)
  if (!teamRoot) {
    throw new Error(`profile 文件不存在: profiles/${parsed.team}/profile.yaml`)
  }

  const teamDir = resolve(teamRoot, 'profiles', parsed.team)
  const profilePath = resolve(teamDir, 'profile.yaml')
  const teamConfig = loadProfileWithInheritance(frameworkRoot, parsed.team, new Set(), { searchRoots })

  const platformConfig = {}
  const platformPath = null
  const merged = deepMerge(teamConfig, platformConfig)
  const paths = merged.paths || {}
  const layerPaths = merged.layer_paths || {}
  const architecture = normaliseArchitecture(merged.architecture, paths, layerPaths)
  const taskSplit = merged.task_split || { order: [], template: [] }
  const taskPrefix = merged.task_prefix || teamConfig.task_prefix || ''
  const profileName = parsed.profile
  const baseRoot = searchRoots[searchRoots.length - 1]

  return {
    profile: profileName,
    team: parsed.team,
    platform: parsed.platform,
    label: teamConfig.label || parsed.team,
    platformLabel: platformConfig.label || parsed.platformLabel,
    taskPrefix,
    architecture,
    taskSplit,
    gateCommands: isPlainObject(merged.gate_commands) ? merged.gate_commands : {},
    constraints: merged.constraints || [],
    reviewExtra: merged.review_extra || [],
    qa: merged.qa || {},
    qaExtra: merged.qa_extra || [],
    executionRules: merged.execution_rules || [],
    commitFormat: merged.commit_format || '',
    commitTypes: merged.commit_types || [],
    paths,
    docPath: merged.doc_path || null,
    planPath: merged.plan_path || null,
    taskDocPattern: merged.task_doc_pattern || null,
    taskIdFormat: merged.task_id_format || null,
    progressTracking: merged.progress_tracking !== false,
    workflow: Array.isArray(merged.workflow) ? merged.workflow : null,
    knowledgeBase: Array.isArray(merged.knowledge_base) ? merged.knowledge_base : [],
    raw: merged,
    files: {
      profilePath,
      platformPath,
      teamDir,
      requirementTemplatePath: resolve(teamDir, 'requirement-template.md'),
      planTemplatePath: resolve(teamDir, 'plan-template.md'),
      reviewChecklistPath: resolve(teamDir, 'review-checklist.md'),
      goldenRulesPath: resolve(teamDir, 'golden-rules.md'),
      baseGoldenRulesPath: resolve(baseRoot, 'profiles', 'base', 'golden-rules.md')
    }
  }
}

function findProfileRoot(searchRoots, profileName) {
  for (const root of searchRoots) {
    if (existsSync(resolve(root, 'profiles', profileName, 'profile.yaml'))) {
      return root
    }
  }
  return null
}

function loadProfileWithInheritance(frameworkRoot, profileName, visited = new Set(), opts = {}) {
  const searchRoots = opts.searchRoots || [frameworkRoot]

  if (visited.has(profileName)) {
    throw new Error(`profile 循环继承检测: ${[...visited, profileName].join(' → ')}`)
  }
  visited.add(profileName)

  const foundRoot = findProfileRoot(searchRoots, profileName)
  if (!foundRoot) {
    throw new Error(`profile 文件不存在: profiles/${profileName}/profile.yaml`)
  }

  const profileDir = resolve(foundRoot, 'profiles', profileName)
  const config = parseSimpleYaml(readFileSync(resolve(profileDir, 'profile.yaml'), 'utf8'))
  const parentName = config.extends

  if (!parentName) return config

  const parentConfig = loadProfileWithInheritance(frameworkRoot, parentName, visited, opts)
  return deepMerge(parentConfig, config)
}

function normaliseArchitecture(architecture, paths, layerPaths) {
  const layers = Array.isArray(architecture?.layers) ? architecture.layers : []
  return {
    ...(architecture || {}),
    layers: layers.map((layer) => ({
      ...layer,
      path: layerPaths[layer.id] || replacePathPlaceholders(layer.path, paths)
    }))
  }
}

function replacePathPlaceholders(pathValue, paths) {
  if (typeof pathValue !== 'string') return pathValue
  return pathValue.replace(/\{(\w+)\}/g, (_, key) => paths[key] || `{${key}}`)
}

function deepMerge(baseValue, overrideValue) {
  if (Array.isArray(baseValue) && Array.isArray(overrideValue)) return [...overrideValue]
  if (!isPlainObject(baseValue) || !isPlainObject(overrideValue)) return overrideValue ?? baseValue

  const result = { ...baseValue }
  for (const [key, value] of Object.entries(overrideValue)) {
    if (value === undefined) continue
    result[key] = key in baseValue ? deepMerge(baseValue[key], value) : value
  }
  return result
}

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

// ── YAML 解析器 ──────────────────────────────────────────────────────────────

export function parseSimpleYaml(content) {
  const lines = preprocessYaml(content)
  if (lines.length === 0) return {}
  const [value] = parseBlock(lines, 0, lines[0].indent)
  return value
}

function preprocessYaml(content) {
  return content
    .split(/\r?\n/)
    .map((line) => stripYamlComment(line))
    .filter((line) => line.trim() !== '')
    .map((line) => ({
      indent: line.match(/^ */)?.[0].length || 0,
      text: line.trimStart()
    }))
}

function stripYamlComment(line) {
  let inSingle = false
  let inDouble = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const previous = index > 0 ? line[index - 1] : ''

    if (char === "'" && !inDouble && previous !== '\\') { inSingle = !inSingle; continue }
    if (char === '"' && !inSingle && previous !== '\\') { inDouble = !inDouble; continue }
    if (char === '#' && !inSingle && !inDouble) {
      if (index === 0 || /\s/.test(previous)) return line.slice(0, index).trimEnd()
    }
  }
  return line
}

function parseBlock(lines, startIndex, indent) {
  const line = lines[startIndex]
  if (!line) return [undefined, startIndex]
  return line.text.startsWith('- ')
    ? parseSequence(lines, startIndex, indent)
    : parseMap(lines, startIndex, indent)
}

function parseMap(lines, startIndex, indent) {
  const result = {}
  let index = startIndex

  while (index < lines.length) {
    const line = lines[index]
    if (line.indent < indent || line.indent !== indent || line.text.startsWith('- ')) break

    const colonIndex = findUnquotedColon(line.text)
    if (colonIndex === -1) throw new Error(`无法解析 YAML 行: ${line.text}`)

    const key = line.text.slice(0, colonIndex).trim()
    const rawValue = line.text.slice(colonIndex + 1).trim()

    if (rawValue !== '') {
      result[key] = parseScalar(rawValue)
      index += 1
      continue
    }

    const nextLine = lines[index + 1]
    if (nextLine && nextLine.indent > indent) {
      const [child, nextIndex] = parseBlock(lines, index + 1, nextLine.indent)
      result[key] = child
      index = nextIndex
      continue
    }

    result[key] = ''
    index += 1
  }

  return [result, index]
}

function parseSequence(lines, startIndex, indent) {
  const result = []
  let index = startIndex

  while (index < lines.length) {
    const line = lines[index]
    if (line.indent < indent || line.indent !== indent || !line.text.startsWith('- ')) break

    const rawValue = line.text.slice(2).trim()
    if (rawValue === '') {
      const nextLine = lines[index + 1]
      if (nextLine && nextLine.indent > indent) {
        const [child, nextIndex] = parseBlock(lines, index + 1, nextLine.indent)
        result.push(child)
        index = nextIndex
      } else {
        result.push(null)
        index += 1
      }
      continue
    }

    const colonIndex = findUnquotedColon(rawValue)
    if (colonIndex === -1) {
      result.push(parseScalar(rawValue))
      index += 1
      continue
    }

    const key = rawValue.slice(0, colonIndex).trim()
    const inlineValue = rawValue.slice(colonIndex + 1).trim()
    const item = { [key]: inlineValue !== '' ? parseScalar(inlineValue) : '' }
    index += 1

    const nextLine = lines[index]
    if (nextLine && nextLine.indent > indent) {
      const [child, nextIndex] = parseBlock(lines, index, nextLine.indent)
      if (isPlainObject(child)) Object.assign(item, child)
      else if (item[key] === '') item[key] = child
      index = nextIndex
    }

    result.push(item)
  }

  return [result, index]
}

function findUnquotedColon(text) {
  let inSingle = false
  let inDouble = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const previous = index > 0 ? text[index - 1] : ''

    if (char === "'" && !inDouble && previous !== '\\') { inSingle = !inSingle; continue }
    if (char === '"' && !inSingle && previous !== '\\') { inDouble = !inDouble; continue }
    if (char === ':' && !inSingle && !inDouble) return index
  }
  return -1
}

function parseScalar(value) {
  if (value.startsWith('"') && value.endsWith('"')) return value.slice(1, -1)
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1)

  if (value.startsWith('[') && value.endsWith(']')) {
    const body = value.slice(1, -1).trim()
    if (!body) return []
    return splitInlineArray(body).map((item) => parseScalar(item.trim()))
  }

  if (value === 'true') return true
  if (value === 'false') return false
  if (value === 'null') return null
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value)
  return value
}

function splitInlineArray(value) {
  const items = []
  let current = ''
  let inSingle = false
  let inDouble = false

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    const previous = index > 0 ? value[index - 1] : ''

    if (char === "'" && !inDouble && previous !== '\\') { inSingle = !inSingle; current += char; continue }
    if (char === '"' && !inSingle && previous !== '\\') { inDouble = !inDouble; current += char; continue }
    if (char === ',' && !inSingle && !inDouble) { items.push(current); current = ''; continue }
    current += char
  }

  if (current) items.push(current)
  return items
}
