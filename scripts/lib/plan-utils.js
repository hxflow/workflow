import { existsSync, readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

import { createTemplateReplacements, renderTemplate } from './profile-utils.js'

export function buildTasks(featureName, profile, requirement) {
  const selectedLayers = new Set(
    requirement.checkedLayers
      .map((layer) => normaliseToken(layer))
      .map((layer) => singulariseToken(layer))
  )

  const templates = Array.isArray(profile.taskSplit.template)
    ? profile.taskSplit.template
    : []
  const order = Array.isArray(profile.taskSplit.order)
    ? profile.taskSplit.order
    : []

  const replacements = createTemplateReplacements(featureName, profile)
  const acIds = requirement.acs.map((item) => item.id)
  const resolvedTasks = templates
    .filter((template, index) => shouldIncludeTask(selectedLayers, order[index]))
    .map((template, index) => {
      const renderedId = renderTemplate(String(template.id || ''), replacements)
      const taskId = renderedId.includes('{PREFIX}')
        ? renderedId.replaceAll('{PREFIX}', profile.taskPrefix)
        : renderedId

      return {
        id: taskId,
        name: String(template.name || `任务 ${index + 1}`),
        status: 'pending',
        output: renderTemplate(String(template.output || ''), replacements),
        description: renderTemplate(String(template.description || ''), replacements),
        phase: order[index] || null,
        acRefs: acIds
      }
    })

  if (resolvedTasks.length > 0) {
    return resolvedTasks
  }

  return templates.map((template, index) => ({
    id: renderTemplate(String(template.id || ''), createTemplateReplacements(featureName, profile)),
    name: String(template.name || `任务 ${index + 1}`),
    status: 'pending',
    output: renderTemplate(String(template.output || ''), createTemplateReplacements(featureName, profile)),
    description: renderTemplate(String(template.description || ''), createTemplateReplacements(featureName, profile)),
    phase: order[index] || null,
    acRefs: acIds
  }))
}

export function buildPlanMarkdown(root, featureName, profile, tasks, requirement, today, opts = {}) {
  const plansDir = opts.plansDir || resolve(root, 'docs/plans')
  const templatePath = existsSync(profile.files.planTemplatePath)
    ? profile.files.planTemplatePath
    : resolve(plansDir, '_template.md')

  const replacements = {
    ...createTemplateReplacements(featureName, profile),
    date: today,
    'YYYY-MM-DD': today
  }

  let output = renderTemplate(readFileSync(templatePath, 'utf8'), replacements)
  output = output.replaceAll('YYYY-MM-DD', today)
  output = replaceTaskSection(output, tasks)
  output = replaceDependencySection(output, tasks)
  output = output.replace(
    /进度文件:\s*`?\{?feature-name\}?-progress\.json`?/g,
    `进度文件: \`${featureName}-progress.json\``
  )
  output = markTargetPlatform(output, profile)

  if (!output.includes('## 任务列表')) {
    output += `\n\n## 任务列表\n\n\`\`\`\n${renderTaskBlock(tasks)}\n\`\`\`\n`
  }

  if (!output.includes('## 进度追踪')) {
    output += `\n## 进度追踪\n\n进度文件: \`${featureName}-progress.json\`\n`
  }

  if (requirement.acs.length > 0 && !output.includes('AC-')) {
    output += `\n## 验收标准引用\n\n${requirement.acs.map((item) => `- ${item.id}: ${item.text}`).join('\n')}\n`
  }

  return output
}

export function renderTaskBlock(tasks) {
  return tasks
    .map((task) => {
      const acText = task.acRefs?.length ? task.acRefs.join(', ') : '待补充'
      return [
        `${task.id}: ${task.name}`,
        `  输出: ${task.output || '待补充'}`,
        `  说明: ${task.description || '待补充'}`,
        `  关联 AC: ${acText}`
      ].join('\n')
    })
    .join('\n\n')
}

export function renderDependencyBlock(tasks) {
  if (tasks.length === 0) {
    return '待补充'
  }

  return tasks.map((task) => task.id).join(' → ')
}

export function markTargetPlatform(markdown, profile) {
  if (profile.team !== 'mobile' || !profile.platformLabel) {
    return markdown
  }

  return markdown
    .replace(/- \[ \] iOS/g, profile.platform === 'ios' ? '- [x] iOS' : '- [ ] iOS')
    .replace(/- \[ \] Android/g, profile.platform === 'android' ? '- [x] Android' : '- [ ] Android')
    .replace(/- \[ \] HarmonyOS/g, profile.platform === 'harmony' ? '- [x] HarmonyOS' : '- [ ] HarmonyOS')
}

export function updateAgentsActiveFeature(root, featureName, profile, opts = {}) {
  const agentsPath = opts.agentsPath || resolve(root, 'AGENTS.md')
  if (!existsSync(agentsPath)) {
    return false
  }

  const current = readFileSync(agentsPath, 'utf8')
  const featureLine = `→ docs/plans/${featureName}.md（${profile.label}${profile.platformLabel ? ` · ${profile.platformLabel}` : ''}，状态：pending）`
  if (current.includes(`docs/plans/${featureName}.md`)) {
    return false
  }

  const sectionStart = current.indexOf('## 当前活跃特性')
  if (sectionStart === -1) {
    return false
  }

  const nextSection = current.indexOf('\n## ', sectionStart + 1)
  const sectionEnd = nextSection === -1 ? current.length : nextSection
  const section = current.slice(sectionStart, sectionEnd)
  let updatedSection = section

  if (section.includes('（无）')) {
    updatedSection = section.replace(/（无）[^\n]*/, featureLine)
  } else {
    updatedSection = `${section.trimEnd()}\n${featureLine}\n`
  }

  const updated = `${current.slice(0, sectionStart)}${updatedSection}${current.slice(sectionEnd)}`
  writeFileSync(agentsPath, updated, 'utf8')
  return true
}

function replaceTaskSection(markdown, tasks) {
  const taskBlock = `## 任务列表\n\n\`\`\`\n${renderTaskBlock(tasks)}\n\`\`\``
  if (/## 任务列表[\s\S]*?(?=\n## |\s*$)/.test(markdown)) {
    return markdown.replace(/## 任务列表[\s\S]*?(?=\n## |\s*$)/, taskBlock)
  }
  return `${markdown.trimEnd()}\n\n${taskBlock}\n`
}

function replaceDependencySection(markdown, tasks) {
  const dependencyBlock = `## 依赖关系\n\n\`\`\`\n${renderDependencyBlock(tasks)}\n\`\`\``
  if (/## 依赖关系[\s\S]*?(?=\n## |\s*$)/.test(markdown)) {
    return markdown.replace(/## 依赖关系[\s\S]*?(?=\n## |\s*$)/, dependencyBlock)
  }
  return `${markdown.trimEnd()}\n\n${dependencyBlock}\n`
}

function shouldIncludeTask(selectedLayers, orderToken) {
  if (selectedLayers.size === 0) {
    return true
  }

  if (!orderToken) {
    return true
  }

  const token = singulariseToken(normaliseToken(orderToken))
  if (token === 'test') {
    return true
  }

  return selectedLayers.has(token)
}

function normaliseToken(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function singulariseToken(value) {
  return value.endsWith('s') ? value.slice(0, -1) : value
}
