import { describe, expect, it } from 'bun:test'

import {
  parseArgs,
  readTopLevelYamlScalar,
  upsertTopLevelYamlScalar,
} from '../../src/lib/config-utils.ts'

describe('config-utils', () => {
  it('parses positional args and option variants', () => {
    expect(parseArgs([
      'setup',
      'extra',
      '--agent',
      'claude,codex',
      '--dry-run',
      '--mode=fast',
      '-h',
    ])).toEqual({
      positional: ['setup', 'extra'],
      options: {
        agent: 'claude,codex',
        'dry-run': true,
        mode: 'fast',
        help: true,
      },
    })
  })

  it('reads top-level yaml scalars with quotes and comments', () => {
    const yaml = [
      'frameworkRoot: "/tmp/hx" # comment',
      "name: 'Harness Workflow'",
      'plain: enabled',
      '',
    ].join('\n')

    expect(readTopLevelYamlScalar(yaml, 'frameworkRoot')).toBe('/tmp/hx')
    expect(readTopLevelYamlScalar(yaml, 'name')).toBe('Harness Workflow')
    expect(readTopLevelYamlScalar(yaml, 'plain')).toBe('enabled')
    expect(readTopLevelYamlScalar(yaml, 'missing')).toBeUndefined()
  })

  it('upserts top-level yaml scalars', () => {
    expect(
      upsertTopLevelYamlScalar('frameworkRoot: /old/path\n', 'frameworkRoot', '/new/path')
    ).toBe('frameworkRoot: /new/path\n')

    expect(
      upsertTopLevelYamlScalar('name: hx\n', 'frameworkRoot', '/new/path')
    ).toBe('name: hx\nframeworkRoot: /new/path\n')
  })
})
