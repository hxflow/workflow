import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'

import {
  buildPlanMarkdown,
  buildTasks,
  markTargetPlatform,
  renderDependencyBlock,
  renderTaskBlock,
  updateAgentsActiveFeature
} from '../../scripts/lib/plan-utils.js'

const tempDirs = []

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop(), { recursive: true, force: true })
  }
})

describe('plan-utils', () => {
  it('builds tasks using selected layers and always keeps test task', () => {
    const profile = {
      taskPrefix: 'TASK-FE',
      platformLabel: null,
      taskSplit: {
        order: ['services', 'hooks', 'test'],
        template: [
          { id: '{PREFIX}-01', name: 'Services', output: 'src/services/{feature}.ts', description: 'service' },
          { id: '{PREFIX}-02', name: 'Hooks', output: 'src/hooks/use{Feature}.ts', description: 'hook' },
          { id: '{PREFIX}-03', name: 'Tests', output: 'src/services/{feature}.test.ts', description: 'test' }
        ]
      }
    }
    const requirement = {
      acs: [{ id: 'AC-001', text: 'demo' }],
      checkedLayers: ['Hooks']
    }

    const tasks = buildTasks('user-login', profile, requirement)

    expect(tasks.map((task) => task.id)).toEqual(['TASK-FE-02', 'TASK-FE-03'])
    expect(tasks[0].output).toBe('src/hooks/useUserLogin.ts')
    expect(tasks[1].acRefs).toEqual(['AC-001'])
  })

  it('renders task and dependency blocks', () => {
    const tasks = [
      { id: 'TASK-FE-01', name: 'Hooks', output: 'src/hooks/useFoo.ts', description: 'hook', acRefs: ['AC-001'] },
      { id: 'TASK-FE-02', name: 'Tests', output: 'src/hooks/useFoo.test.ts', description: 'test', acRefs: [] }
    ]

    expect(renderTaskBlock(tasks)).toContain('TASK-FE-01: Hooks')
    expect(renderTaskBlock(tasks)).toContain('关联 AC: AC-001')
    expect(renderDependencyBlock(tasks)).toBe('TASK-FE-01 → TASK-FE-02')
  })

  it('marks target mobile platform in markdown', () => {
    const markdown = '- [ ] iOS\n- [ ] Android\n- [ ] HarmonyOS'
    const profile = { team: 'mobile', platform: 'android', platformLabel: 'Android' }

    expect(markTargetPlatform(markdown, profile)).toBe('- [ ] iOS\n- [x] Android\n- [ ] HarmonyOS')
  })

  it('updates AGENTS active feature section once', () => {
    const tempRoot = makeTempDir('plan-agents-')
    writeFileSync(
      resolve(tempRoot, 'AGENTS.md'),
      '# AGENTS\n\n## 当前活跃特性\n\n（无）\n\n## 其他\n',
      'utf8'
    )

    const updated = updateAgentsActiveFeature(tempRoot, 'order-list', { label: '前端', platformLabel: null })
    const duplicated = updateAgentsActiveFeature(tempRoot, 'order-list', { label: '前端', platformLabel: null })
    const content = readFileSync(resolve(tempRoot, 'AGENTS.md'), 'utf8')

    expect(updated).toBe(true)
    expect(duplicated).toBe(false)
    expect(content).toContain('docs/plans/order-list.md（前端，状态：pending）')
  })

  it('builds markdown from plan template and AC data', () => {
    const tempRoot = makeTempDir('plan-markdown-')
    mkdirSync(resolve(tempRoot, 'docs/plans'), { recursive: true })
    const templatePath = resolve(tempRoot, 'docs/plans/template.md')
    writeFileSync(
      templatePath,
      '# 计划 {feature-name}\n\n## 任务列表\n\n待替换\n\n## 依赖关系\n\n待替换\n\n## 平台\n\n- [ ] iOS\n- [ ] Android\n- [ ] HarmonyOS\n',
      'utf8'
    )

    const markdown = buildPlanMarkdown(
      tempRoot,
      'mobile-login',
      {
        team: 'mobile',
        platform: 'ios',
        platformLabel: 'iOS',
        files: { planTemplatePath: templatePath }
      },
      [
        { id: 'TASK-IOS-01', name: 'UI', output: 'app/UI.swift', description: 'build ui', acRefs: ['AC-001'] }
      ],
      {
        acs: [{ id: 'AC-001', text: 'show login page' }]
      },
      '2026-03-23'
    )

    expect(markdown).toContain('TASK-IOS-01: UI')
    expect(markdown).toContain('进度文件')
    expect(markdown).toContain('- [x] iOS')
    expect(markdown).toContain('关联 AC: AC-001')
  })
})

function makeTempDir(prefix) {
  const dir = mkdtempSync(resolve(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}
