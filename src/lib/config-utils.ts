const SHORT_FLAGS = {
  h: 'help',
}

export function parseArgs(argv: string[]): { positional: string[]; options: Record<string, string | true> } {
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

export function readTopLevelYamlScalar(content: string, key: string): string | undefined {
  const pattern = new RegExp(`^${escapeRegExp(key)}:\\s*(.*?)\\s*$`, 'm')
  const match = content.match(pattern)

  if (!match) {
    return undefined
  }

  return normalizeYamlScalar(match[1])
}

export function upsertTopLevelYamlScalar(content: string, key: string, value: string): string {
  const renderedLine = `${key}: ${value}`
  const pattern = new RegExp(`^${escapeRegExp(key)}:\\s*.*$`, 'm')

  if (pattern.test(content)) {
    return content.replace(pattern, renderedLine)
  }

  const trimmed = content.trimEnd()
  return trimmed ? `${trimmed}\n${renderedLine}\n` : `${renderedLine}\n`
}

function normalizeYamlScalar(rawValue: string): string {
  const value = stripInlineYamlComment(rawValue).trim()

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1)
  }

  return value
}

function stripInlineYamlComment(line: string): string {
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

    if (char === '#' && !inSingle && !inDouble && (index === 0 || /\s/.test(previous))) {
      return line.slice(0, index)
    }
  }

  return line
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
