function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function extractTaskSection(planContent: string, taskId: string): string {
  const headingPattern = new RegExp(`^###\\s+${escapeRegExp(taskId)}(?:\\s.*)?$`, 'm')
  const headingMatch = headingPattern.exec(planContent)
  if (!headingMatch || headingMatch.index === undefined) return ''

  const sectionStart = headingMatch.index + headingMatch[0].length
  const remaining = planContent.slice(sectionStart).replace(/^\r?\n/, '')
  const nextHeadingIndex = remaining.search(/^###\s+/m)
  return (nextHeadingIndex === -1 ? remaining : remaining.slice(0, nextHeadingIndex)).trim()
}

export function readTaskField(section: string, label: string): string {
  if (!section) return ''
  const pattern = new RegExp(`^-\\s*${escapeRegExp(label)}:\\s*(.*)$`, 'm')
  const match = section.match(pattern)
  return match ? match[1].trim() : ''
}
