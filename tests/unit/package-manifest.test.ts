import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

import { describe, expect, it } from 'bun:test'

const ROOT = process.cwd()
const PACKAGE_JSON_PATH = resolve(ROOT, 'package.json')

describe('package manifest', () => {
  it('publishes hxflow directory as the skill root', () => {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf8'))

    expect(pkg.files).toContain('hxflow/**/*')
    expect(pkg.files).not.toContain('SKILL.md')
  })

  it('exposes internal workflow bins for the agent skill runtime', () => {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf8'))

    expect(pkg.bin).toEqual({
      'hx-hook': 'hxflow/scripts/lib/hook.ts',
      'hx-progress': 'hxflow/scripts/lib/progress.ts',
      'hx-doc': 'hxflow/scripts/tools/doc.ts',
      'hx-plan': 'hxflow/scripts/tools/plan.ts',
      'hx-run': 'hxflow/scripts/tools/run.ts',
      'hx-review': 'hxflow/scripts/tools/review.ts',
      'hx-mr': 'hxflow/scripts/tools/mr.ts',
      'hx-go': 'hxflow/scripts/tools/go.ts',
      'hx-status': 'hxflow/scripts/tools/status.ts',
      'hx-reset': 'hxflow/scripts/tools/reset.ts',
      'hx-init': 'hxflow/scripts/tools/init.ts',
    })
    expect(existsSync(resolve(ROOT, 'bin/hx.js'))).toBe(false)
  })

  it('has hxflow/SKILL.md as skill entry point', () => {
    expect(existsSync(resolve(ROOT, 'hxflow', 'SKILL.md'))).toBe(true)
    const content = readFileSync(resolve(ROOT, 'hxflow', 'SKILL.md'), 'utf8')
    expect(content).toContain('name: hxflow')
    expect(content).toContain('hx-hook resolve <command>')
    expect(content).toContain('hx-*')
    expect(content).toContain('全局规则')
  })

  it('exposes eval scripts for local and CI usage', () => {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf8'))

    expect(pkg.scripts['hx:evals:validate']).toBe('bun hxflow/scripts/lib/evals.ts validate')
    expect(pkg.scripts['hx:evals:report']).toBe('bun hxflow/scripts/lib/evals.ts report')
    expect(pkg.scripts['hx:evals:ci']).toBeUndefined()
  })

  it('keeps GitHub repository metadata aligned', () => {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf8'))

    expect(pkg.name).toBe('@hxflow/workflow')
    expect(pkg.repository).toEqual({
      type: 'git',
      url: 'https://github.com/hxflow/workflow.git',
    })
    expect(pkg.publishConfig).toEqual({
      registry: 'https://npm.pkg.github.com',
    })
  })
})
