import { afterEach, describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'

import { parseSimpleYaml } from '../../src/scripts/lib/profile-utils.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const BIN_PATH = resolve(ROOT, 'bin/hx.js')
const tempDirs = []

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop(), { recursive: true, force: true })
  }
})

function makeTempDir(prefix) {
  const dir = mkdtempSync(resolve(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

function runHx(args, cwd, homeDir) {
  return spawnSync(process.execPath, [BIN_PATH, ...args], {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      FORCE_COLOR: '0',
      HOME: homeDir,
    },
  })
}

describe('fixture project smoke', () => {
  it('wires setup output, project config, pipeline override and command resolution together', () => {
    const homeDir = makeTempDir('hx-smoke-home-')
    const projectDir = makeTempDir('hx-smoke-project-')

    mkdirSync(resolve(projectDir, '.git'), { recursive: true })
    mkdirSync(resolve(projectDir, '.hx', 'commands'), { recursive: true })
    mkdirSync(resolve(projectDir, '.hx', 'pipelines'), { recursive: true })
    mkdirSync(resolve(projectDir, 'workflow', 'requirements'), { recursive: true })
    mkdirSync(resolve(projectDir, 'workflow', 'plans'), { recursive: true })
    mkdirSync(resolve(projectDir, '.claude', 'commands'), { recursive: true })

    writeFileSync(resolve(projectDir, '.hx', 'config.yaml'), [
      'defaultProfile: base',
      'paths:',
      '  requirementDoc: workflow/requirements/{feature}.md',
      '  planDoc: workflow/plans/{feature}.md',
      '  progressFile: workflow/plans/{feature}-progress.json',
    ].join('\n'), 'utf8')

    writeFileSync(resolve(projectDir, '.hx', 'commands', 'hx-run.md'), [
      '---',
      'name: hx-run',
      'description: Project override',
      'usage: hx-run [<feature-key>] [--task <task-id>] [--profile <name>]',
      'claude: /hx-run',
      'codex: hx-run',
      '---',
      '',
      '# project hx-run override',
    ].join('\n'), 'utf8')

    writeFileSync(resolve(projectDir, '.hx', 'pipelines', 'default.yaml'), [
      'name: 项目级 smoke pipeline',
      'steps:',
      '  - id: doc',
      '    phase: Phase 01',
      '    name: 需求文档',
      '    command: hx-doc',
      '  - id: run',
      '    phase: Phase 04',
      '    name: 执行需求',
      '    command: hx-run',
      '  - id: mr',
      '    phase: Phase 08',
      '    name: MR 描述',
      '    command: hx-mr',
    ].join('\n'), 'utf8')

    const setup = runHx(['setup'], projectDir, homeDir)
    expect(setup.status).toBe(0)

    const userHxDir = resolve(homeDir, '.hx')
    const userClaudeDir = resolve(homeDir, '.claude')
    const userCodexDir = resolve(homeDir, '.codex')

    expect(existsSync(resolve(userHxDir, 'config.yaml'))).toBe(true)
    expect(existsSync(resolve(userClaudeDir, 'commands', 'hx-run.md'))).toBe(true)
    expect(existsSync(resolve(userCodexDir, 'skills', 'hx-run', 'SKILL.md'))).toBe(true)

    const doctor = runHx(['doctor'], projectDir, homeDir)
    expect(doctor.status).toBe(0)
    const doctorOutput = doctor.stdout + doctor.stderr
    expect(doctorOutput).toContain('workflow/requirements/')
    expect(doctorOutput).toContain('workflow/plans/')
    expect(doctorOutput).toContain('profile: base')
    expect(doctorOutput).toContain('~/.claude/commands/')
    expect(doctorOutput).toContain('~/.codex/skills/')

    const forwarder = readFileSync(resolve(userClaudeDir, 'commands', 'hx-run.md'), 'utf8')
    expect(forwarder).toContain('.hx/commands/hx-run.md')
    expect(forwarder).toContain(resolve(userHxDir, 'commands', 'hx-run.md'))

    const skillFile = readFileSync(resolve(userCodexDir, 'skills', 'hx-run', 'SKILL.md'), 'utf8')
    expect(skillFile).toContain(`${userHxDir}/commands/hx-run.md`)
    expect(skillFile).toContain(`${ROOT}/src/agents/commands/hx-run.md`)

    const projectPipeline = parseSimpleYaml(readFileSync(resolve(projectDir, '.hx', 'pipelines', 'default.yaml'), 'utf8'))
    expect(projectPipeline.steps.map((step) => step.command)).toEqual(['hx-doc', 'hx-run', 'hx-mr'])
    expect(readFileSync(resolve(projectDir, '.hx', 'commands', 'hx-run.md'), 'utf8')).toContain('project hx-run override')
  })

  it('falls back to user-level pipeline and commands when project overrides are absent', () => {
    const homeDir = makeTempDir('hx-smoke-home-fallback-')
    const projectDir = makeTempDir('hx-smoke-project-fallback-')

    mkdirSync(resolve(projectDir, '.git'), { recursive: true })
    mkdirSync(resolve(projectDir, 'docs', 'requirement'), { recursive: true })
    mkdirSync(resolve(projectDir, 'docs', 'plans'), { recursive: true })

    const setup = runHx(['setup'], projectDir, homeDir)
    expect(setup.status).toBe(0)

    const userHxDir = resolve(homeDir, '.hx')
    const userClaudeDir = resolve(homeDir, '.claude')
    const userCodexDir = resolve(homeDir, '.codex')

    mkdirSync(resolve(userHxDir, 'commands'), { recursive: true })
    mkdirSync(resolve(userHxDir, 'pipelines'), { recursive: true })

    writeFileSync(resolve(userHxDir, 'commands', 'hx-mr.md'), [
      '---',
      'name: hx-mr',
      'description: User override',
      'usage: hx-mr [<feature-key>] [--project <group/repo>] [--target <branch>]',
      'claude: /hx-mr',
      'codex: hx-mr',
      '---',
      '',
      '# user hx-mr override',
    ].join('\n'), 'utf8')

    writeFileSync(resolve(userHxDir, 'pipelines', 'default.yaml'), [
      'name: 用户级 fallback pipeline',
      'steps:',
      '  - id: doc',
      '    phase: Phase 01',
      '    name: 需求文档',
      '    command: hx-doc',
      '  - id: qa',
      '    phase: Phase 06',
      '    name: 最终质量校验',
      '    command: hx-qa',
    ].join('\n'), 'utf8')

    const doctor = runHx(['doctor'], projectDir, homeDir)
    expect(doctor.status).toBe(0)

    const claudeMrForwarder = readFileSync(resolve(userClaudeDir, 'commands', 'hx-mr.md'), 'utf8')
    expect(claudeMrForwarder).toContain('.hx/commands/hx-mr.md')
    expect(claudeMrForwarder).toContain(resolve(userHxDir, 'commands', 'hx-mr.md'))

    const codexSkillFile = readFileSync(resolve(userCodexDir, 'skills', 'hx-mr', 'SKILL.md'), 'utf8')
    expect(codexSkillFile).toContain('name: hx-mr')

    const userPipeline = parseSimpleYaml(readFileSync(resolve(userHxDir, 'pipelines', 'default.yaml'), 'utf8'))
    expect(userPipeline.steps.map((step) => step.command)).toEqual(['hx-doc', 'hx-qa'])
    expect(readFileSync(resolve(userHxDir, 'commands', 'hx-mr.md'), 'utf8')).toContain('user hx-mr override')
  })
})
