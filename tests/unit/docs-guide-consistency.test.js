import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

const COMMAND_INDEX_PATH = resolve(ROOT, 'docs/guide/hx-command-index.html')
const ONBOARDING_PATH = resolve(ROOT, 'docs/guide/hx-onboarding.html')
const DEEP_DIVE_PATH = resolve(ROOT, 'docs/guide/hx-deep-dive.html')
const ENGINEERING_SPEC_PATH = resolve(ROOT, 'docs/guide/harness-engineering-spec.html')

describe('guide docs consistency', () => {
  it('hx-command-index keeps canonical syntax for main workflow commands', () => {
    const content = readFileSync(COMMAND_INDEX_PATH, 'utf8')

    expect(content).toContain('/hx-doc [&lt;feature-key-or-title&gt;] [--task &lt;id&gt;] [--profile &lt;name&gt;]')
    expect(content).toContain('/hx-plan [&lt;feature-key&gt;] [--profile &lt;name&gt;]')
    expect(content).toContain('/hx-run [&lt;feature-key&gt;] [--task &lt;TASK-ID&gt;] [--profile &lt;name&gt;]')
    expect(content).toContain('/hx-mr [&lt;feature-key&gt;] [--project &lt;group/repo&gt;] [--target &lt;branch&gt;]')
  })

  it('hx-onboarding preserves the canonical main path and task-first examples', () => {
    const content = readFileSync(ONBOARDING_PATH, 'utf8')

    expect(content).toContain('/hx-doc → /hx-plan → /hx-run → /hx-qa → /hx-mr')
    expect(content).toContain('/hx-doc --task 12345 --profile base')
    expect(content).toContain('/hx-plan --profile base')
    expect(content).toContain('/hx-run --profile base')
    expect(content).toContain('/hx-go --task 12345 --profile base')
  })

  it('hx-deep-dive keeps the default pipeline explanation aligned with the current main path', () => {
    const content = readFileSync(DEEP_DIVE_PATH, 'utf8')

    expect(content).toContain('默认项目内置主路径是 <code>doc -> plan -> run -> qa -> mr</code>')
    expect(content).toContain('phase: Phase 01')
    expect(content).toContain('command: hx-doc')
    expect(content).toContain('command: hx-run')
    expect(content).toContain('/hx-go user-login --from run --profile base')
  })

  it('harness-engineering-spec keeps the updated phase grouping and hx-go narrative', () => {
    const content = readFileSync(ENGINEERING_SPEC_PATH, 'utf8')

    expect(content).toContain('Phase 01 — 03')
    expect(content).toContain('Phase 04 + 06')
    expect(content).toContain('Phase 08 + Auxiliary')
    expect(content).toContain('Phase 01→02→04→06 完成后自动进入 Phase 08')
    expect(content).toContain('/hx-mr user-login --project lehu/bffservice')
  })
})
