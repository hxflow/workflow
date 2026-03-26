import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const BIN_PATH = resolve(ROOT, 'bin/hx.js')
const PACKAGE_VERSION = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')).version

describe('hx cli entry', () => {
  it('打印帮助信息并以 0 退出', () => {
    const result = runHx(['--help'])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Harness Workflow CLI')
    expect(result.stdout).toContain('用法: hx <command> [options]')
  })

  it('-h 短标志同样打印帮助', () => {
    const result = runHx(['-h'])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Harness Workflow CLI')
  })

  it('无参数时打印帮助并以 0 退出', () => {
    const result = runHx([])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Harness Workflow CLI')
  })

  it('打印当前 package.json 版本号', () => {
    const result = runHx(['version'])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain(`hx v${PACKAGE_VERSION}`)
  })

  it('--version 标志也输出版本号', () => {
    const result = runHx(['--version'])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain(`hx v${PACKAGE_VERSION}`)
  })

  it('拒绝未知命令并以 1 退出', () => {
    const result = runHx(['unknown-command'])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('未知命令: unknown-command')
  })

  it('提示 Claude 命令在 Claude Code 中运行', () => {
    for (const cmd of ['init', 'doc', 'plan', 'run', 'qa', 'review', 'fix', 'clean', 'mr']) {
      const result = runHx([cmd])
      expect(result.status).toBe(1)
      expect(result.stderr).toContain(`/hx-${cmd}`)
    }
  })

  it('setup 命令可以正常分发（--help 测试）', () => {
    const result = runHx(['setup', '--help'])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('hx setup')
  })

  it('upgrade 命令可以正常分发（--help 测试）', () => {
    const result = runHx(['upgrade', '--help'])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('hx upgrade')
  })

  it('uninstall 命令可以正常分发（--help 测试）', () => {
    const result = runHx(['uninstall', '--help'])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('hx uninstall')
  })
})

function runHx(args) {
  return spawnSync(process.execPath, [BIN_PATH, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, FORCE_COLOR: '0' }
  })
}
