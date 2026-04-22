import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { buildTaskContext } from '../../hxflow/scripts/lib/task-context.ts'
import type { ProgressData } from '../../hxflow/scripts/lib/types.ts'

const tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('buildTaskContext', () => {
  it('extracts task fields, requirement summary, and dependency outputs', () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'hx-task-context-'))
    tempDirs.push(projectRoot)

    mkdirSync(join(projectRoot, 'docs', 'plans'), { recursive: true })
    mkdirSync(join(projectRoot, 'docs', 'requirement'), { recursive: true })
    mkdirSync(join(projectRoot, '.hx'), { recursive: true })
    mkdirSync(join(projectRoot, 'apps', 'admin', '.hx'), { recursive: true })
    writeFileSync(
      join(projectRoot, '.hx', 'workspace.yaml'),
      `version: 1
projects:
  - id: admin
    path: ./apps/admin
    type: node
`,
      'utf8',
    )
    writeFileSync(
      join(projectRoot, 'apps', 'admin', '.hx', 'config.yaml'),
      `paths:
  src: app
  requirementDoc: ignored/requirement.md
gates:
  test: npm test
runtime:
  pipelines:
    default: ignored.yaml
`,
      'utf8',
    )

    writeFileSync(
      join(projectRoot, 'docs', 'requirement', 'AUTH-001.md'),
      `# 用户登录

> Feature: AUTH-001
> Display Name: 用户登录
> Source ID: TS-1
> Source Fingerprint: fp-1

## 背景

需要补齐登录接口和页面联动。

## 验收

用户可通过账号密码登录。
`,
      'utf8',
    )

    writeFileSync(
      join(projectRoot, 'docs', 'plans', 'AUTH-001.md'),
      `# Plan

## 任务拆分

### TASK-1

- 目标: 实现登录接口
- 执行服务: admin
- 执行目录: apps/admin
- 修改范围: src/api/auth.ts，src/services/auth.ts
- 实施要点: 新增接口，补单测
- 验收标准: 接口可调用，返回 token
- 验证方式: bun test tests/unit/auth.test.ts
`,
      'utf8',
    )

    const progressData: ProgressData = {
      feature: 'AUTH-001',
      requirementDoc: 'docs/requirement/AUTH-001.md',
      planDoc: 'docs/plans/AUTH-001.md',
      createdAt: '2026-04-13T10:00:00Z',
      updatedAt: '2026-04-13T10:00:00Z',
      completedAt: null,
      lastRun: null,
      tasks: [
        {
          id: 'TASK-0',
          name: '准备字段',
          status: 'done',
          dependsOn: [],
          parallelizable: false,
          output: '字段已就绪',
          startedAt: '2026-04-13T09:50:00Z',
          completedAt: '2026-04-13T09:55:00Z',
          durationSeconds: 300,
        },
        {
          id: 'TASK-1',
          name: '实现登录接口',
          status: 'pending',
          dependsOn: ['TASK-0'],
          parallelizable: false,
          output: '',
          startedAt: null,
          completedAt: null,
          durationSeconds: null,
        },
      ],
    }

    const context = buildTaskContext({
      feature: 'AUTH-001',
      projectRoot,
      progressData,
      taskId: 'TASK-1',
      mode: 'run',
    })

    expect(context.task.goal).toBe('实现登录接口')
    expect(context.task.service).toBe('admin')
    expect(context.task.cwd).toBe('apps/admin')
    expect(context.task.scope).toEqual(['src/api/auth.ts', 'src/services/auth.ts'])
    expect(context.task.implementationNotes).toEqual(['新增接口', '补单测'])
    expect(context.task.acceptance).toEqual(['接口可调用', '返回 token'])
    expect(context.task.verification).toEqual(['bun test tests/unit/auth.test.ts'])
    expect(context.requirement.summary).toContain('需要补齐登录接口和页面联动')
    expect(context.dependencies).toEqual([
      {
        id: 'TASK-0',
        name: '准备字段',
        status: 'done',
        output: '字段已就绪',
      },
    ])
    expect(context.workspace?.projects).toEqual([
      {
        id: 'admin',
        path: './apps/admin',
        type: 'node',
        root: resolve(projectRoot, 'apps/admin'),
      },
    ])
    expect(context.execution).toEqual({
      root: resolve(projectRoot, 'apps/admin'),
      cwd: 'apps/admin',
      src: 'app',
      gates: {
        test: 'npm test',
      },
      gateSources: {
        test: 'project',
      },
      source: 'project',
    })
    expect(readFileSync(resolve(projectRoot, context.planDoc), 'utf8')).toContain('### TASK-1')
  })
})
