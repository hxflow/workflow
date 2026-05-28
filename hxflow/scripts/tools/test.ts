#!/usr/bin/env bun
/**
 * hx-test.ts — 真实端到端集成测试上下文入口
 *
 * 确定性工作：收集 feature、计划、进度、变更文件、执行目标。
 * AI 工作：按命令契约执行 E2E 校验。
 */

import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

import { exitWithJsonError as err, printJson as out } from '../lib/json-cli.ts'
import { getWorkspaceProjects } from '../lib/file-paths.ts'
import { runGit, splitLines } from '../lib/git-utils.ts'
import { resolveExecutionConfig, resolveWorkspaceExecutionConfigs } from '../lib/execution-config.ts'
import type { ExecutionConfig } from '../lib/execution-config.ts'
import { extractTaskSection, readTaskField } from '../lib/plan-utils.ts'
import { loadFeatureProgress } from '../lib/progress-context.ts'
import { createSimpleContext } from '../lib/tool-cli.ts'

const { positional, projectRoot } = createSimpleContext()
const [feature] = positional

if (!feature) err('用法：hx-test <feature>')

const progress = loadFeatureProgress(projectRoot, feature)
const planDoc = resolve(projectRoot, progress.data.planDoc)
const planContent = existsSync(planDoc) ? readFileSync(planDoc, 'utf8') : ''
const executionConfigs = resolveTestExecutionConfigs(projectRoot, planContent)
const diffStat = runGit(projectRoot, 'diff', '--stat', 'HEAD') ?? ''
const changedFiles = splitLines(runGit(projectRoot, 'diff', '--name-only', 'HEAD') ?? '')

out({
  ok: false,
  feature,
  test: {
    enabled: true,
    ok: true,
    needsSubagent: true,
    summary: '需要用干净上下文执行真实端到端集成测试',
    context: {
      kind: 'e2e-integration-test',
      feature,
      projectRoot,
      requirementDoc: progress.data.requirementDoc,
      planDoc: progress.data.planDoc,
      completedAt: progress.data.completedAt,
      changedFiles,
      diffStat,
      tasks: progress.data.tasks.map((task) => ({
        id: task.id,
        name: task.name,
        status: task.status,
        output: task.output,
        executionDir: readTaskCwd(planContent, task.id),
      })),
      targets: executionConfigs.map((execution) => ({
        projectRoot: execution.root,
        cwd: execution.cwd,
        src: execution.src,
        source: execution.source,
        configuredGates: Object.entries(execution.gates)
          .filter(([, command]) => Boolean(command))
          .map(([name, command]) => ({ name, command })),
      })),
    },
  },
})

process.exit(1)

function resolveTestExecutionConfigs(root: string, planContent: string): ExecutionConfig[] {
  const workspaceProjects = getWorkspaceProjects(root)
  if (workspaceProjects.length === 0) {
    return [resolveExecutionConfig(root, '')]
  }

  const taskCwds = progress.data.tasks
    .map((task) => readTaskCwd(planContent, task.id))
    .filter(Boolean)

  if (taskCwds.length === 0) {
    return [resolveExecutionConfig(root, '')]
  }

  return resolveWorkspaceExecutionConfigs(root, taskCwds)
}

function readTaskCwd(content: string, taskId: string): string {
  if (!content) return ''
  return readTaskField(extractTaskSection(content, taskId), '执行目录')
}
