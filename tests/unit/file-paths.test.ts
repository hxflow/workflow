import { describe, expect, it, beforeEach, afterEach } from 'bun:test'
import { writeFileSync, mkdirSync, mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import {
  getActiveProgressFilePath,
  getActivePlanDocPath,
  getRequirementDocPath,
  getArchiveDirPath,
  getFeatureArtifactRoots,
  getWorkspaceProjectRoots,
  resolveFeatureArtifactRoot,
  archiveFeature,
  restoreFeature,
  resolveProgressFile,
} from '../../hxflow/scripts/lib/file-paths.ts'

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'hxflow-file-paths-'))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true })
})

// ── path getters ──────────────────────────────────────────────────────────────

describe('path getters', () => {
  it('getActiveProgressFilePath returns correct path', () => {
    const p = getActiveProgressFilePath('/project', 'AUTH-001')
    expect(p).toBe(resolve('/project', 'docs', 'plans', 'AUTH-001-progress.json'))
  })

  it('getActivePlanDocPath returns correct path', () => {
    const p = getActivePlanDocPath('/project', 'AUTH-001')
    expect(p).toBe(resolve('/project', 'docs', 'plans', 'AUTH-001.md'))
  })

  it('getRequirementDocPath returns correct path', () => {
    const p = getRequirementDocPath('/project', 'AUTH-001')
    expect(p).toBe(resolve('/project', 'docs', 'requirement', 'AUTH-001.md'))
  })

  it('getArchiveDirPath returns correct path', () => {
    const p = getArchiveDirPath('/project', 'AUTH-001')
    expect(p).toBe(resolve('/project', 'docs', 'archive', 'AUTH-001'))
  })
})

describe('workspace feature resolution', () => {
  it('reads workspace project roots from .hx/workspace.yaml', () => {
    mkdirSync(join(tmpDir, '.hx'), { recursive: true })
    writeFileSync(join(tmpDir, '.hx', 'workspace.yaml'), [
      'version: 1',
      'projects:',
      '  - id: admin',
      '    path: ./apps/admin',
      '    type: node',
      '',
    ].join('\n'), 'utf8')

    expect(getWorkspaceProjectRoots(tmpDir)).toEqual([resolve(tmpDir, 'apps', 'admin')])
  })

  it('keeps feature artifacts at the workspace root', () => {
    const appRoot = join(tmpDir, 'apps', 'admin')
    mkdirSync(join(tmpDir, '.hx'), { recursive: true })
    mkdirSync(join(tmpDir, 'docs', 'requirement'), { recursive: true })
    mkdirSync(join(appRoot, 'docs', 'requirement'), { recursive: true })
    writeFileSync(join(tmpDir, '.hx', 'workspace.yaml'), [
      'version: 1',
      'projects:',
      '  - id: admin',
      '    path: ./apps/admin',
      '    type: node',
      '',
    ].join('\n'), 'utf8')
    writeFileSync(join(tmpDir, 'docs', 'requirement', 'AUTH-001.md'), '# Workspace Requirement\n', 'utf8')
    writeFileSync(join(appRoot, 'docs', 'requirement', 'AUTH-001.md'), '# Requirement\n', 'utf8')

    expect(getFeatureArtifactRoots(tmpDir, 'AUTH-001')).toEqual([tmpDir])
    expect(resolveFeatureArtifactRoot(tmpDir, 'AUTH-001')).toBe(tmpDir)
  })
})

// ── archiveFeature ────────────────────────────────────────────────────────────

describe('archiveFeature', () => {
  function setupActiveFiles(feature: string) {
    const plansDir = join(tmpDir, 'docs', 'plans')
    mkdirSync(plansDir, { recursive: true })
    writeFileSync(join(plansDir, `${feature}.md`), '# plan', 'utf8')
    writeFileSync(join(plansDir, `${feature}-progress.json`), '{}', 'utf8')
  }

  it('moves both planDoc and progressFile to archive dir', () => {
    const feature = 'AUTH-001'
    setupActiveFiles(feature)

    const result = archiveFeature(tmpDir, feature)

    expect(result.archived).toHaveLength(2)
    expect(existsSync(join(tmpDir, 'docs', 'plans', `${feature}.md`))).toBe(false)
    expect(existsSync(join(tmpDir, 'docs', 'plans', `${feature}-progress.json`))).toBe(false)
    expect(existsSync(join(tmpDir, 'docs', 'archive', feature, `${feature}.md`))).toBe(true)
    expect(existsSync(join(tmpDir, 'docs', 'archive', feature, `${feature}-progress.json`))).toBe(true)
  })

  it('archives only planDoc if progressFile is absent', () => {
    const feature = 'AUTH-001'
    const plansDir = join(tmpDir, 'docs', 'plans')
    mkdirSync(plansDir, { recursive: true })
    writeFileSync(join(plansDir, `${feature}.md`), '# plan', 'utf8')

    const result = archiveFeature(tmpDir, feature)
    expect(result.archived).toHaveLength(1)
  })

  it('throws when neither file exists', () => {
    expect(() => archiveFeature(tmpDir, 'NONEXISTENT')).toThrow(/归档失败/)
  })

  it('creates archive dir automatically', () => {
    const feature = 'AUTH-001'
    setupActiveFiles(feature)
    archiveFeature(tmpDir, feature)
    expect(existsSync(join(tmpDir, 'docs', 'archive', feature))).toBe(true)
  })
})

// ── restoreFeature ────────────────────────────────────────────────────────────

describe('restoreFeature', () => {
  function setupArchived(feature: string) {
    const archiveDir = join(tmpDir, 'docs', 'archive', feature)
    mkdirSync(archiveDir, { recursive: true })
    writeFileSync(join(archiveDir, `${feature}.md`), '# plan', 'utf8')
    writeFileSync(join(archiveDir, `${feature}-progress.json`), '{}', 'utf8')
  }

  it('moves both files from archive to docs/plans', () => {
    const feature = 'AUTH-001'
    setupArchived(feature)

    const result = restoreFeature(tmpDir, feature)

    expect(result.restored).toHaveLength(2)
    expect(existsSync(join(tmpDir, 'docs', 'plans', `${feature}.md`))).toBe(true)
    expect(existsSync(join(tmpDir, 'docs', 'plans', `${feature}-progress.json`))).toBe(true)
  })

  it('throws when archive dir does not exist', () => {
    expect(() => restoreFeature(tmpDir, 'NONEXISTENT')).toThrow(/还原失败/)
  })

  it('throws when archive dir is empty', () => {
    const feature = 'AUTH-001'
    mkdirSync(join(tmpDir, 'docs', 'archive', feature), { recursive: true })
    expect(() => restoreFeature(tmpDir, feature)).toThrow(/还原失败/)
  })
})

// ── resolveProgressFile ───────────────────────────────────────────────────────

describe('resolveProgressFile', () => {
  it('returns active path when file exists', () => {
    const feature = 'AUTH-001'
    const plansDir = join(tmpDir, 'docs', 'plans')
    mkdirSync(plansDir, { recursive: true })
    const progressPath = join(plansDir, `${feature}-progress.json`)
    writeFileSync(progressPath, '{}', 'utf8')

    const result = resolveProgressFile(tmpDir, feature)
    expect(result.restored).toBe(false)
    expect(result.filePath).toBe(progressPath)
  })

  it('restores from archive when active file is absent', () => {
    const feature = 'AUTH-001'
    // Set up archived progress
    const archiveDir = join(tmpDir, 'docs', 'archive', feature)
    mkdirSync(archiveDir, { recursive: true })
    writeFileSync(join(archiveDir, `${feature}-progress.json`), '{}', 'utf8')

    const result = resolveProgressFile(tmpDir, feature)
    expect(result.restored).toBe(true)
    expect(existsSync(result.filePath)).toBe(true)
  })

  it('throws when neither active nor archived file exists', () => {
    expect(() => resolveProgressFile(tmpDir, 'NONEXISTENT')).toThrow(/不存在/)
  })
})
