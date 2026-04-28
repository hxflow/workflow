const SHORT_FLAGS: Record<string, string> = {
  h: 'help',
}

export function parseArgs(argv: string[]): { positional: string[]; options: Record<string, string | true> } {
  const positional: string[] = []
  const options: Record<string, string | true> = {}

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

