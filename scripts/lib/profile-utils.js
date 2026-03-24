import { existsSync, readFileSync, readdirSync } from 'fs'
import { resolve } from 'path'

const DEFAULT_PROFILE = 'frontend'
const CONFIG_FILE = 'harness.config.json'
const PROFILE_USAGE = 'backend | frontend | mobile:ios | mobile:android | mobile:harmony'

const TEAM_LABELS = {
  backend: '服务端',
  frontend: '前端',
  mobile: '移动端'
}

const TEAM_BY_LABEL = {
  服务端: 'backend',
  前端: 'frontend',
  移动端: 'mobile'
}

const PLATFORM_BY_LABEL = {
  ios: 'ios',
  iOS: 'ios',
  android: 'android',
  Android: 'android',
  harmony: 'harmony',
  HarmonyOS: 'harmony',
  'HarmonyOS (鸿蒙)': 'harmony',
  鸿蒙: 'harmony'
}

const PLATFORM_LABELS = {
  ios: 'iOS',
  android: 'Android',
  harmony: 'HarmonyOS'
}

export function parseArgs(argv) {
  const positional = []
  const options = {}

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
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
    if (next && !next.startsWith('--')) {
      options[key] = next
      index += 1
      continue
    }

    options[key] = true
  }

  return { positional, options }
}

export function profileUsage() {
  return PROFILE_USAGE
}

export function getDefaultProfile(root = process.cwd()) {
  const configured = readConfiguredProfile(root)
  return configured || DEFAULT_PROFILE
}

export function isValidFeatureName(featureName) {
  return /^[a-z0-9-]+$/.test(featureName)
}

export function isTaskId(taskId) {
  return /^TASK-[A-Z]+-\d{2}$/.test(taskId)
}

export function parseProfileSpecifier(specifier) {
  const raw = (specifier || '').trim()
  if (!raw) {
    return null
  }

  const [team, platform] = raw.split(':')
  if (!team || !['backend', 'frontend', 'mobile'].includes(team)) {
    throw new Error(`无效的 profile: ${raw}。可用值: ${PROFILE_USAGE}`)
  }

  if (team !== 'mobile' && platform) {
    throw new Error(`profile ${raw} 不需要平台后缀`)
  }

  if (team === 'mobile' && platform && !['ios', 'android', 'harmony'].includes(platform)) {
    throw new Error(`无效的移动端平台: ${platform}。可用值: ios | android | harmony`)
  }

  return {
    profile: team === 'mobile' && platform ? `${team}:${platform}` : team,
    team,
    platform: team === 'mobile' ? platform || null : null,
    label: TEAM_LABELS[team] || team,
    platformLabel: team === 'mobile' && platform ? PLATFORM_LABELS[platform] : null
  }
}

export function guessProfileFromTaskId(taskId) {
  if (!isTaskId(taskId)) {
    return null
  }

  const prefix = taskId.split('-')[1]
  switch (prefix) {
    case 'BE':
      return 'backend'
    case 'FE':
      return 'frontend'
    case 'IOS':
      return 'mobile:ios'
    case 'AND':
      return 'mobile:android'
    case 'HM':
      return 'mobile:harmony'
    case 'MB':
      return 'mobile'
    default:
      return null
  }
}

export function inferProfileFromRequirementDoc(root, featureName, opts = {}) {
  if (!featureName) {
    return null
  }

  const reqDir = opts.requirementDir || resolve(root, 'docs/requirement')
  const requirementPath = resolve(reqDir, `${featureName}.md`)
  if (!existsSync(requirementPath)) {
    return null
  }

  const content = readFileSync(requirementPath, 'utf8')
  const teamLabel = content.match(/团队：([^\n｜]+)/)?.[1]?.trim()
  const platformLabel = content.match(/平台：([^\n｜]+)/)?.[1]?.trim()
  const team = teamLabel ? TEAM_BY_LABEL[teamLabel] : null

  if (!team) {
    return null
  }

  if (team !== 'mobile') {
    return team
  }

  const platform = platformLabel ? PLATFORM_BY_LABEL[platformLabel] : null
  return platform ? `mobile:${platform}` : 'mobile'
}

export function findProgressFiles(root, opts = {}) {
  const plansDir = opts.plansDir || resolve(root, 'docs/plans')
  if (!existsSync(plansDir)) {
    return []
  }

  return readdirSync(plansDir)
    .filter((fileName) => fileName.endsWith('-progress.json'))
    .map((fileName) => resolve(plansDir, fileName))
}

export function readJsonFile(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'))
}

export function findProgressByTask(root, taskId, featureName = null, opts = {}) {
  const plansDir = opts.plansDir || resolve(root, 'docs/plans')
  const progressFiles = featureName
    ? [resolve(plansDir, `${featureName}-progress.json`)].filter(existsSync)
    : findProgressFiles(root, opts)

  for (const filePath of progressFiles) {
    const data = readJsonFile(filePath)
    const task = data.tasks?.find((item) => item.id === taskId)
    if (task) {
      return { filePath, data, task }
    }
  }

  return null
}

export function inferProfileFromProgress(data) {
  if (!data) {
    return null
  }

  if (typeof data.profile === 'string' && data.profile.trim()) {
    if (data.profile === 'mobile' && data.platform) {
      return `mobile:${data.platform}`
    }
    return data.profile
  }

  if (data.team === 'mobile' && data.platform) {
    return `mobile:${data.platform}`
  }

  if (typeof data.team === 'string' && data.team.trim()) {
    return data.team
  }

  return null
}

export function filterProgressByProfile(progressEntries, profileSpecifier) {
  if (!profileSpecifier) {
    return progressEntries
  }

  const requested = parseProfileSpecifier(profileSpecifier)

  return progressEntries.filter(({ data }) => {
    const actualProfile = inferProfileFromProgress(data)
    if (!actualProfile) {
      return false
    }

    const actual = parseProfileSpecifier(actualProfile)
    if (!actual) {
      return false
    }

    if (requested.team !== actual.team) {
      return false
    }

    if (!requested.platform) {
      return true
    }

    return actual.platform === requested.platform
  })
}

export function extractRequirementInfo(content) {
  const acs = []
  const checkedLayers = []

  for (const line of content.split('\n')) {
    const acMatch = line.match(/^- (AC-\d+):\s*(.+)?$/)
    if (acMatch) {
      acs.push({
        id: acMatch[1],
        text: (acMatch[2] || '').trim()
      })
    }

    const layerMatch = line.match(/^- \[(x|X)\]\s*([^—-]+?)\s*(?:—|-)/)
    if (layerMatch) {
      checkedLayers.push(layerMatch[2].trim())
    }
  }

  return { acs, checkedLayers }
}

export function renderTemplate(template, replacements) {
  let output = template

  for (const [key, value] of Object.entries(replacements)) {
    if (value == null) {
      continue
    }

    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    output = output.replace(new RegExp(`\\{${escapedKey}\\}`, 'g'), String(value))
    output = output.replace(new RegExp(`\\[${escapedKey}\\]`, 'g'), String(value))
    if (key.includes('-')) {
      output = output.replace(new RegExp(escapedKey, 'g'), String(value))
    }
  }

  return output
}

export function createTemplateReplacements(featureName, profile) {
  const pascal = toPascalCase(featureName)
  return {
    'feature-name': featureName,
    feature: featureName,
    Feature: pascal,
    FeatureName: pascal,
    Component: pascal,
    ComponentName: pascal,
    PageName: `${pascal}Page`,
    entity: featureName,
    domain: featureName.split('-')[0] || featureName,
    platform: profile?.platformLabel || profile?.platform || '',
    team: profile?.label || '',
    platform_src: profile?.paths?.platform_src || '',
    platform_test: profile?.paths?.platform_test || '',
    PREFIX: profile?.taskPrefix || ''
  }
}

export function toPascalCase(value) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

export function readHarnessConfig(root = process.cwd()) {
  const configPath = resolve(root, CONFIG_FILE)
  if (!existsSync(configPath)) {
    return {}
  }

  try {
    return JSON.parse(readFileSync(configPath, 'utf8'))
  } catch {
    return {}
  }
}

function readConfiguredProfile(root) {
  const config = readHarnessConfig(root)
  if (typeof config.defaultProfile !== 'string' || !config.defaultProfile.trim()) {
    return null
  }

  try {
    return parseProfileSpecifier(config.defaultProfile)?.profile || null
  } catch {
    return null
  }
}

export function loadProfile(root, specifier) {
  const parsed = parseProfileSpecifier(specifier || DEFAULT_PROFILE)
  if (!parsed) {
    throw new Error(`缺少 profile。可用值: ${PROFILE_USAGE}`)
  }

  const teamDir = resolve(root, 'profiles', parsed.team)
  const profilePath = resolve(teamDir, 'profile.yaml')
  if (!existsSync(profilePath)) {
    throw new Error(`profile 文件不存在: profiles/${parsed.team}/profile.yaml`)
  }

  // 加载当前 profile 并沿 extends 链递归合并父 profile
  const teamConfig = loadProfileWithInheritance(root, parsed.team)

  let platformConfig = {}
  let platformPath = null

  if (parsed.team === 'mobile' && parsed.platform) {
    platformPath = resolve(teamDir, 'platforms', `${parsed.platform}.yaml`)
    if (!existsSync(platformPath)) {
      throw new Error(`平台 profile 不存在: profiles/mobile/platforms/${parsed.platform}.yaml`)
    }
    platformConfig = parseSimpleYaml(readFileSync(platformPath, 'utf8'))
  }

  const merged = deepMerge(teamConfig, platformConfig)
  const paths = merged.paths || {}
  const layerPaths = merged.layer_paths || {}
  const architecture = normaliseArchitecture(merged.architecture, paths, layerPaths)

  const taskSplit = merged.task_split || { order: [], template: [] }
  const taskPrefix = merged.task_prefix || teamConfig.task_prefix || ''
  const profileName = parsed.team === 'mobile' && parsed.platform ? `${parsed.team}:${parsed.platform}` : parsed.team

  return {
    profile: profileName,
    team: parsed.team,
    platform: parsed.platform,
    label: teamConfig.label || TEAM_LABELS[parsed.team] || parsed.team,
    platformLabel: platformConfig.label || parsed.platformLabel,
    taskPrefix,
    architecture,
    taskSplit,
    gateCommands: merged.gate_commands || {},
    constraints: merged.constraints || [],
    reviewExtra: merged.review_extra || [],
    qa: merged.qa || {},
    qaExtra: merged.qa_extra || [],
    executionRules: merged.execution_rules || [],
    commitFormat: merged.commit_format || '',
    commitTypes: merged.commit_types || [],
    paths,
    raw: merged,
    files: {
      profilePath,
      platformPath,
      teamDir,
      requirementTemplatePath: resolve(teamDir, 'requirement-template.md'),
      planTemplatePath: resolve(teamDir, 'plan-template.md'),
      reviewChecklistPath: resolve(teamDir, 'review-checklist.md'),
      goldenRulesPath: resolve(teamDir, 'golden-rules.md'),
      baseGoldenRulesPath: resolve(root, 'profiles', 'base', 'golden-rules.md')
    }
  }
}

/**
 * 沿 extends 链递归加载 profile，从根基类向下逐层 deepMerge。
 * 防循环检测：visited 集合记录已加载的 profile 名。
 */
function loadProfileWithInheritance(root, profileName, visited = new Set()) {
  if (visited.has(profileName)) {
    throw new Error(`profile 循环继承检测: ${[...visited, profileName].join(' → ')}`)
  }
  visited.add(profileName)

  const profileDir = resolve(root, 'profiles', profileName)
  const profilePath = resolve(profileDir, 'profile.yaml')
  if (!existsSync(profilePath)) {
    throw new Error(`profile 文件不存在: profiles/${profileName}/profile.yaml`)
  }

  const config = parseSimpleYaml(readFileSync(profilePath, 'utf8'))
  const parentName = config.extends

  if (!parentName) {
    return config
  }

  // 递归加载父 profile，然后用当前 config 覆盖
  const parentConfig = loadProfileWithInheritance(root, parentName, visited)
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
  if (typeof pathValue !== 'string') {
    return pathValue
  }

  return pathValue.replace(/\{(\w+)\}/g, (_, key) => {
    return paths[key] || `{${key}}`
  })
}

function deepMerge(baseValue, overrideValue) {
  if (Array.isArray(baseValue) && Array.isArray(overrideValue)) {
    return [...overrideValue]
  }

  if (!isPlainObject(baseValue) || !isPlainObject(overrideValue)) {
    return overrideValue ?? baseValue
  }

  const result = { ...baseValue }

  for (const [key, value] of Object.entries(overrideValue)) {
    if (value === undefined) {
      continue
    }
    result[key] = key in baseValue ? deepMerge(baseValue[key], value) : value
  }

  return result
}

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function parseSimpleYaml(content) {
  const lines = preprocessYaml(content)
  if (lines.length === 0) {
    return {}
  }

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

    if (char === "'" && !inDouble && previous !== '\\') {
      inSingle = !inSingle
      continue
    }

    if (char === '"' && !inSingle && previous !== '\\') {
      inDouble = !inDouble
      continue
    }

    if (char === '#' && !inSingle && !inDouble) {
      if (index === 0 || /\s/.test(previous)) {
        return line.slice(0, index).trimEnd()
      }
    }
  }

  return line
}

function parseBlock(lines, startIndex, indent) {
  const line = lines[startIndex]
  if (!line) {
    return [undefined, startIndex]
  }

  if (line.text.startsWith('- ')) {
    return parseSequence(lines, startIndex, indent)
  }

  return parseMap(lines, startIndex, indent)
}

function parseMap(lines, startIndex, indent) {
  const result = {}
  let index = startIndex

  while (index < lines.length) {
    const line = lines[index]
    if (line.indent < indent) {
      break
    }
    if (line.indent !== indent || line.text.startsWith('- ')) {
      break
    }

    const colonIndex = findUnquotedColon(line.text)
    if (colonIndex === -1) {
      throw new Error(`无法解析 YAML 行: ${line.text}`)
    }

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
    if (line.indent < indent) {
      break
    }
    if (line.indent !== indent || !line.text.startsWith('- ')) {
      break
    }

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
    const item = {}
    item[key] = inlineValue !== '' ? parseScalar(inlineValue) : ''
    index += 1

    const nextLine = lines[index]
    if (nextLine && nextLine.indent > indent) {
      const [child, nextIndex] = parseBlock(lines, index, nextLine.indent)
      if (isPlainObject(child)) {
        Object.assign(item, child)
      } else if (item[key] === '') {
        item[key] = child
      }
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

    if (char === "'" && !inDouble && previous !== '\\') {
      inSingle = !inSingle
      continue
    }

    if (char === '"' && !inSingle && previous !== '\\') {
      inDouble = !inDouble
      continue
    }

    if (char === ':' && !inSingle && !inDouble) {
      return index
    }
  }

  return -1
}

function parseScalar(value) {
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1)
  }

  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1)
  }

  if (value.startsWith('[') && value.endsWith(']')) {
    const body = value.slice(1, -1).trim()
    if (!body) {
      return []
    }

    return splitInlineArray(body).map((item) => parseScalar(item.trim()))
  }

  if (value === 'true') {
    return true
  }

  if (value === 'false') {
    return false
  }

  if (value === 'null') {
    return null
  }

  if (/^-?\d+(?:\.\d+)?$/.test(value)) {
    return Number(value)
  }

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

    if (char === "'" && !inDouble && previous !== '\\') {
      inSingle = !inSingle
      current += char
      continue
    }

    if (char === '"' && !inSingle && previous !== '\\') {
      inDouble = !inDouble
      current += char
      continue
    }

    if (char === ',' && !inSingle && !inDouble) {
      items.push(current)
      current = ''
      continue
    }

    current += char
  }

  if (current) {
    items.push(current)
  }

  return items
}
