import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const PIPELINE_PATH = resolve(ROOT, 'src/pipelines/default.yaml')

describe('default pipeline definition', () => {
  it('keeps canonical phase numbering for main path steps', () => {
    const content = readFileSync(PIPELINE_PATH, 'utf8')

    expect(content).toContain('id: doc')
    expect(content).toContain('phase: Phase 01')
    expect(content).toContain('id: plan')
    expect(content).toContain('phase: Phase 02')
    expect(content).toContain('id: run')
    expect(content).toContain('phase: Phase 04')
    expect(content).toContain('id: qa')
    expect(content).toContain('phase: Phase 06')
    expect(content).toContain('id: mr')
    expect(content).toContain('phase: Phase 08')
  })
})
