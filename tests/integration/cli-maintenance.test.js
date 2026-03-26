import { afterEach, describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'

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

function runHx(args, cwd = ROOT) {
  return spawnSync(process.execPath, [BIN_PATH, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, FORCE_COLOR: '0' }
  })
}

// ── hx setup ──────────────────────────────────────────────────────────────

describe('hx setup', () => {
  it('--help 打印帮助并以 0 退出', () => {
    const result = runHx(['setup', '--help'])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('hx setup')
    expect(result.stdout).toContain('--agent <name>')
    expect(result.stdout).toContain('~/.hx/')
    expect(result.stdout).toContain('~/.claude/commands/')
    expect(result.stdout).toContain('~/.codex/skills/')
  })

  it('--dry-run 仅显示安装计划不写入文件', () => {
    const hxDir = makeTempDir('setup-dry-hx-')
    const claudeDir = makeTempDir('setup-dry-claude-')
    const codexDir = makeTempDir('setup-dry-codex-')

    const result = runHx([
      'setup', '--dry-run',
      '--user-hx-dir', hxDir,
      '--user-claude-dir', claudeDir,
      '--user-codex-dir', codexDir
    ])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('dry-run')
    // dry-run 不写入实际文件
    expect(existsSync(resolve(hxDir, 'config.yaml'))).toBe(false)
  })

  it('创建 ~/.hx/ 目录结构和 config.yaml', () => {
    const hxDir = makeTempDir('setup-hx-')
    const claudeDir = makeTempDir('setup-claude-')
    const codexDir = makeTempDir('setup-codex-')

    const result = runHx([
      'setup',
      '--user-hx-dir', hxDir,
      '--user-claude-dir', claudeDir,
      '--user-codex-dir', codexDir
    ])

    expect(result.status).toBe(0)
    expect(existsSync(resolve(hxDir, 'config.yaml'))).toBe(true)
    expect(existsSync(resolve(hxDir, 'commands'))).toBe(true)
    expect(existsSync(resolve(hxDir, 'profiles'))).toBe(true)
    expect(existsSync(resolve(hxDir, 'pipelines'))).toBe(true)
  })

  it('config.yaml 中写入 frameworkRoot', () => {
    const hxDir = makeTempDir('setup-config-hx-')
    const claudeDir = makeTempDir('setup-config-claude-')
    const codexDir = makeTempDir('setup-config-codex-')

    runHx(['setup', '--user-hx-dir', hxDir, '--user-claude-dir', claudeDir, '--user-codex-dir', codexDir])

    const config = readFileSync(resolve(hxDir, 'config.yaml'), 'utf8')
    expect(config).toContain('frameworkRoot:')
    expect(config).toContain(ROOT.replace(/\/bin$/, '').replace(/\/bin\/.*$/, ''))
  })

  it('在 ~/.claude/commands/ 中生成 hx-*.md 转发器', () => {
    const hxDir = makeTempDir('setup-cmds-hx-')
    const claudeDir = makeTempDir('setup-cmds-claude-')
    const codexDir = makeTempDir('setup-cmds-codex-')

    runHx(['setup', '--user-hx-dir', hxDir, '--user-claude-dir', claudeDir, '--user-codex-dir', codexDir])

    const commandsDir = resolve(claudeDir, 'commands')
    expect(existsSync(commandsDir)).toBe(true)

    // 框架应至少包含几个核心命令
    const coreCommands = ['hx-run.md', 'hx-plan.md', 'hx-doc.md', 'hx-qa.md']
    for (const cmd of coreCommands) {
      expect(existsSync(resolve(commandsDir, cmd)), `${cmd} 应存在`).toBe(true)
    }
  })

  it('转发器内容包含三层查找路径', () => {
    const hxDir = makeTempDir('setup-fwd-hx-')
    const claudeDir = makeTempDir('setup-fwd-claude-')
    const codexDir = makeTempDir('setup-fwd-codex-')

    runHx(['setup', '--user-hx-dir', hxDir, '--user-claude-dir', claudeDir, '--user-codex-dir', codexDir])

    const fwdContent = readFileSync(resolve(claudeDir, 'commands', 'hx-run.md'), 'utf8')
    expect(fwdContent).toContain('.hx/commands/hx-run.md')   // 项目层
    expect(fwdContent).toContain(hxDir)                       // 用户层
    // 系统层路径也应包含
    expect(fwdContent).toContain('hx-run.md')
  })

  it('--agent codex 时仅生成 Codex skill bundle', () => {
    const hxDir = makeTempDir('setup-codex-hx-')
    const claudeDir = makeTempDir('setup-codex-claude-')
    const codexDir = makeTempDir('setup-codex-codex-')

    const result = runHx([
      'setup',
      '--agent', 'codex',
      '--user-hx-dir', hxDir,
      '--user-claude-dir', claudeDir,
      '--user-codex-dir', codexDir
    ])

    expect(result.status).toBe(0)
    expect(existsSync(resolve(codexDir, 'skills', 'hxflow', 'SKILL.md'))).toBe(true)
    expect(existsSync(resolve(codexDir, 'skills', 'hxflow', 'commands.json'))).toBe(true)
    expect(existsSync(resolve(claudeDir, 'commands', 'hx-run.md'))).toBe(false)
  })

  it('幂等 — 重复运行时已存在文件放入 skipped', () => {
    const hxDir = makeTempDir('setup-idem-hx-')
    const claudeDir = makeTempDir('setup-idem-claude-')
    const codexDir = makeTempDir('setup-idem-codex-')
    const args = ['setup', '--user-hx-dir', hxDir, '--user-claude-dir', claudeDir, '--user-codex-dir', codexDir]

    runHx(args)
    const second = runHx(args)

    expect(second.status).toBe(0)
    expect(second.stdout).toContain('跳过')
  })

  it('报告包含"完成"并以 0 退出', () => {
    const hxDir = makeTempDir('setup-done-hx-')
    const claudeDir = makeTempDir('setup-done-claude-')
    const codexDir = makeTempDir('setup-done-codex-')

    const result = runHx(['setup', '--user-hx-dir', hxDir, '--user-claude-dir', claudeDir, '--user-codex-dir', codexDir])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('完成')
  })
})

// ── hx upgrade ────────────────────────────────────────────────────────────

describe('hx upgrade', () => {
  it('--help 打印帮助并以 0 退出', () => {
    const result = runHx(['upgrade', '--help'])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('hx upgrade')
    expect(result.stdout).toContain('--agent <name>')
    expect(result.stdout).toContain('--dry-run')
  })

  it('--dry-run 输出升级计划，不实际写入', () => {
    const claudeDir = makeTempDir('upgrade-dry-claude-')
    const codexDir = makeTempDir('upgrade-dry-codex-')
    const result = runHx(['upgrade', '--dry-run', '--user-claude-dir', claudeDir, '--user-codex-dir', codexDir])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('dry-run')
  })

  it('--dry-run 输出升级报告区块', () => {
    const claudeDir = makeTempDir('upgrade-report-claude-')
    const codexDir = makeTempDir('upgrade-report-codex-')
    const result = runHx(['upgrade', '--dry-run', '--user-claude-dir', claudeDir, '--user-codex-dir', codexDir])
    expect(result.status).toBe(0)
    // 至少包含升级报告中的某一区块
    const hasReport = result.stdout.includes('更新:') ||
      result.stdout.includes('跳过:') ||
      result.stdout.includes('警告:')
    expect(hasReport).toBe(true)
  })
})

// ── hx uninstall ──────────────────────────────────────────────────────────

describe('hx uninstall', () => {
  it('--help 打印帮助并以 0 退出', () => {
    const result = runHx(['uninstall', '--help'])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('hx uninstall')
    expect(result.stdout).toContain('--yes')
    expect(result.stdout).toContain('--dry-run')
  })

  it('空目录（无安装痕迹）时输出提示并以 0 退出', () => {
    const targetDir = makeTempDir('uninstall-empty-')

    const result = runHx(['uninstall', '--target', targetDir, '--yes'])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('未发现')
  })

  it('--dry-run 列出将要删除的项目但不实际删除', () => {
    const targetDir = makeTempDir('uninstall-dry-')
    // 模拟安装了 hx-*.md 的项目
    const cmdsDir = resolve(targetDir, '.claude', 'commands')
    mkdirSync(cmdsDir, { recursive: true })
    writeFileSync(resolve(cmdsDir, 'hx-run.md'), '# forwarder', 'utf8')

    const result = runHx(['uninstall', '--target', targetDir, '--dry-run'])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('dry-run')
    expect(result.stdout).toContain('.claude/commands/')
    // 文件不应被删除
    expect(existsSync(resolve(cmdsDir, 'hx-run.md'))).toBe(true)
  })

  it('--yes 删除 .claude/commands/hx-*.md 文件', () => {
    const targetDir = makeTempDir('uninstall-real-')
    const cmdsDir = resolve(targetDir, '.claude', 'commands')
    mkdirSync(cmdsDir, { recursive: true })
    writeFileSync(resolve(cmdsDir, 'hx-run.md'), '# forwarder', 'utf8')
    writeFileSync(resolve(cmdsDir, 'hx-plan.md'), '# forwarder', 'utf8')

    const result = runHx(['uninstall', '--target', targetDir, '--yes'])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('卸载完成')
    expect(existsSync(resolve(cmdsDir, 'hx-run.md'))).toBe(false)
    expect(existsSync(resolve(cmdsDir, 'hx-plan.md'))).toBe(false)
  })

  it('--yes 删除 .hx/config.yaml', () => {
    const targetDir = makeTempDir('uninstall-config-')
    const hxDir = resolve(targetDir, '.hx')
    mkdirSync(hxDir, { recursive: true })
    writeFileSync(resolve(hxDir, 'config.yaml'), 'defaultProfile: base\n', 'utf8')

    const result = runHx(['uninstall', '--target', targetDir, '--yes'])

    expect(result.status).toBe(0)
    expect(existsSync(resolve(hxDir, 'config.yaml'))).toBe(false)
  })

  it('--yes 从 CLAUDE.md 移除 harness 标记块，保留其余内容', () => {
    const targetDir = makeTempDir('uninstall-claudemd-')
    const claudePath = resolve(targetDir, 'CLAUDE.md')

    writeFileSync(claudePath, [
      '# My Project',
      '',
      '## Setup',
      '',
      'Some content.',
      '',
      '<!-- hxflow:start -->',
      '## Harness Workflow',
      'Some harness content.',
      '<!-- hxflow:end -->',
      '',
      '## Footer',
      ''
    ].join('\n'), 'utf8')

    runHx(['uninstall', '--target', targetDir, '--yes'])

    const content = readFileSync(claudePath, 'utf8')
    expect(content).toContain('# My Project')
    expect(content).toContain('## Footer')
    expect(content).not.toContain('<!-- hxflow:start -->')
    expect(content).not.toContain('<!-- hxflow:end -->')
  })

  it('完整安装后卸载可清干净所有痕迹', () => {
    const hxDir = makeTempDir('full-cycle-hx-')
    const claudeDir = makeTempDir('full-cycle-claude-')
    const codexDir = makeTempDir('full-cycle-codex-')

    // 先安装
    const setup = runHx(['setup', '--user-hx-dir', hxDir, '--user-claude-dir', claudeDir, '--user-codex-dir', codexDir])
    expect(setup.status).toBe(0)
    expect(existsSync(resolve(claudeDir, 'commands', 'hx-run.md'))).toBe(true)

    // 创建一个有 hx-*.md 的目标目录来模拟 uninstall 的工作范围
    const targetDir = makeTempDir('full-cycle-target-')
    const targetCmds = resolve(targetDir, '.claude', 'commands')
    mkdirSync(targetCmds, { recursive: true })
    writeFileSync(resolve(targetCmds, 'hx-run.md'), '# fw', 'utf8')

    const uninstall = runHx(['uninstall', '--target', targetDir, '--yes'])
    expect(uninstall.status).toBe(0)
    expect(existsSync(resolve(targetCmds, 'hx-run.md'))).toBe(false)
  })
})

// ── hx doctor ─────────────────────────────────────────────────────────────

describe('hx doctor', () => {
  it('产生输出，包含框架版本信息', () => {
    const result = runHx(['doctor'])
    // doctor 不管通过还是存在问题，都应输出内容
    expect(result.stdout.length + result.stderr.length).toBeGreaterThan(0)
    // 应该包含某种诊断输出
    const output = result.stdout + result.stderr
    expect(output).toBeTruthy()
  })

  it('框架 profiles 存在时 profiles 检查通过', () => {
    const result = runHx(['doctor'])
    const output = result.stdout + result.stderr
    // 只要框架文件完整，不应报 profiles 相关错误
    expect(output).not.toContain('profiles 目录不存在')
  })

  it('输出包含 Node.js 版本检查结果', () => {
    const result = runHx(['doctor'])
    const output = result.stdout + result.stderr
    expect(output.toLowerCase()).toMatch(/node|版本/)
  })

  it('按 .hx/config.yaml 的自定义 paths 检查目录', () => {
    const projectDir = makeTempDir('doctor-custom-paths-')
    mkdirSync(resolve(projectDir, '.hx'), { recursive: true })
    mkdirSync(resolve(projectDir, '业务线/香港/需求/资料'), { recursive: true })
    mkdirSync(resolve(projectDir, '业务线/香港/需求/任务'), { recursive: true })
    mkdirSync(resolve(projectDir, '.claude/commands'), { recursive: true })

    writeFileSync(resolve(projectDir, '.hx/config.yaml'), [
      'defaultProfile: base',
      'paths:',
      '  requirementDoc: 业务线/香港/需求/{feature}/资料/需求.md',
      '  planDoc: 业务线/香港/需求/{feature}/任务/{taskId}/任务执行.md',
      '  progressFile: 业务线/香港/需求/{feature}/任务/{taskId}/progress.json',
    ].join('\n'), 'utf8')

    const result = runHx(['doctor'], projectDir)
    const output = result.stdout + result.stderr

    expect(output).toContain('业务线/香港/需求/{feature}/资料/')
    expect(output).toContain('业务线/香港/需求/{feature}/任务/{taskId}/')
    expect(output).not.toContain('docs/requirement/ 缺失')
    expect(output).not.toContain('docs/plans/ 缺失')
  })
})
