import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

import { loadCommandSpecs } from '../../src/scripts/lib/install-utils.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const COMMANDS_DIR = resolve(ROOT, 'src/agents/commands')
const DOC_COMMAND_PATH = resolve(COMMANDS_DIR, 'hx-doc.md')
const RUN_COMMAND_PATH = resolve(COMMANDS_DIR, 'hx-run.md')
const MR_COMMAND_PATH = resolve(COMMANDS_DIR, 'hx-mr.md')

describe('workflow command contracts', () => {
  it('hx-doc exposes task-aware metadata and requirement creation flow', () => {
    const specs = loadCommandSpecs(COMMANDS_DIR)
    const docSpec = specs.find((spec) => spec.name === 'hx-doc')
    const content = readFileSync(DOC_COMMAND_PATH, 'utf8')

    expect(docSpec).toMatchObject({
      name: 'hx-doc',
      usage: 'hx-doc [<feature-key-or-title>] [--task <task-id>] [--profile <name>]',
      claude: '/hx-doc',
      codex: 'hx-doc',
    })
    expect(content).toContain('任务拉取模式')
    expect(content).toContain('手工整理模式')
    expect(content).toContain('基于模板创建 `requirementDoc`')
    expect(content).toContain('下一步优先提示 `hx-plan --profile <name>`')
  })

  it('hx-run keeps whole-feature execution and progress update constraints', () => {
    const specs = loadCommandSpecs(COMMANDS_DIR)
    const runSpec = specs.find((spec) => spec.name === 'hx-run')
    const content = readFileSync(RUN_COMMAND_PATH, 'utf8')

    expect(runSpec).toMatchObject({
      name: 'hx-run',
      usage: 'hx-run [<feature-key>] [--task <task-id>] [--profile <name>]',
      claude: '/hx-run',
      codex: 'hx-run',
    })
    expect(content).toContain('执行内置预检')
    expect(content).toContain('所有 `pending` 任务')
    expect(content).toContain('更新 `progressFile`')
    expect(content).toContain('提示继续运行 `hx-qa`')
  })

  it('hx-mr keeps MR context inputs and delivery options aligned', () => {
    const specs = loadCommandSpecs(COMMANDS_DIR)
    const mrSpec = specs.find((spec) => spec.name === 'hx-mr')
    const content = readFileSync(MR_COMMAND_PATH, 'utf8')

    expect(mrSpec).toMatchObject({
      name: 'hx-mr',
      usage: 'hx-mr [<feature-key>] [--project <group/repo>] [--target <branch>]',
      claude: '/hx-mr',
      codex: 'hx-mr',
    })
    expect(content).toContain('git log <target>..HEAD --oneline')
    expect(content).toContain('git diff <target>...HEAD --stat')
    expect(content).toContain('格式 `feat: <feature-key> - <一句话摘要>`')
    expect(content).toContain('供复制到 GitLab/GitHub')
  })
})
