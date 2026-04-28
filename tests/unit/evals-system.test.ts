import { describe, expect, it } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import {
  buildOpenAIEvalsPayload,
  buildTrendReport,
  extractFailureCandidates,
  loadSpecDatasets,
  resolveEvalWorkspace,
  scoreEvalResults,
} from '../../hxflow/scripts/lib/evals.ts'

const ROOT = process.cwd()

describe('evals system', () => {
  it('loads the default spec and all referenced datasets', () => {
    const workspace = resolveEvalWorkspace(ROOT)
    const { spec, datasets } = loadSpecDatasets('default', workspace)

    expect(spec.name).toBe('hxflow-agent-regression')
    expect(datasets.map((dataset) => dataset.name)).toEqual(['core', 'edge', 'regressions'])
    expect(datasets.flatMap((dataset) => dataset.cases).length).toBe(4)
  })

  it('scores local result fixtures and surfaces failures', () => {
    const workspace = resolveEvalWorkspace(ROOT)
    const summary = scoreEvalResults(resolve(ROOT, 'tests', 'fixtures', 'evals', 'sample-results.json'), 'default', workspace)

    expect(summary.totals.total).toBe(4)
    expect(summary.totals.passed).toBe(3)
    expect(summary.totals.failed).toBe(1)
    expect(summary.failures).toHaveLength(1)
    expect(summary.failures[0]?.id).toBe('init.only-initialization')
    expect(summary.failures[0]?.checks.forbiddenFragments.found).toEqual(['hooks 骨架'])
  })

  it('extracts failed cases as regression candidates', () => {
    const workspace = resolveEvalWorkspace(ROOT)
    const summary = scoreEvalResults(resolve(ROOT, 'tests', 'fixtures', 'evals', 'sample-results.json'), 'default', workspace)
    const tempDir = mkdtempSync(join(tmpdir(), 'hx-evals-'))
    const runPath = resolve(tempDir, 'run.json')

    try {
      writeFileSync(runPath, JSON.stringify(summary, null, 2), 'utf8')
      const candidates = extractFailureCandidates(runPath)
      expect(candidates).toHaveLength(1)
      expect(candidates[0]?.id).toBe('candidate.init.only-initialization')
      expect(candidates[0]?.notes).toContain('人工校正')
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('reports trend history from the built-in history file', () => {
    const workspace = resolveEvalWorkspace(ROOT)
    const report = buildTrendReport(workspace.historyPath)

    expect(report.ok).toBe(true)
    expect(report.totalRuns).toBe(0)
    expect(report.latest).toBeNull()
  })

  it('builds an OpenAI eval payload draft from local datasets', () => {
    const workspace = resolveEvalWorkspace(ROOT)
    const payload = buildOpenAIEvalsPayload('default', workspace)

    expect(payload.eval.name).toBe('hxflow-agent-regression')
    expect(payload.run.data_source.type).toBe('jsonl')
    expect(payload.run.data_source.source.content).toHaveLength(4)
    expect(payload.notes[0]).toContain('持续评测')
  })

  it('keeps the eval README and history file present', () => {
    expect(readFileSync(resolve(ROOT, 'hxflow', 'evals', 'README.md'), 'utf8')).toContain('OpenAI Evals')
    expect(readFileSync(resolve(ROOT, 'hxflow', 'evals', 'runs', 'history.json'), 'utf8').trim()).toBe('[]')
  })
})
