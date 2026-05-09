#!/usr/bin/env bun
/**
 * hx-review.ts — 质量评审 orchestrator
 *
 * 确定性工作：加载 gates、执行 qa、收集 diff 与规则文件、汇总结果。
 * AI 工作：review 的语义判断。
 */

import { spawnSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

import { createSimpleContext } from '../lib/tool-cli.ts'
import { GATE_ORDER } from '../lib/runtime-config.ts'
import type { GateName } from '../lib/runtime-config.ts'
import { runGit, splitLines, checkBranchName } from '../lib/git-utils.ts'
import type { BranchCheckResult } from '../lib/git-utils.ts'
import { resolveExecutionConfig, resolveWorkspaceExecutionConfigs } from '../lib/execution-config.ts'
import type { ExecutionConfig } from '../lib/execution-config.ts'
import { getWorkspaceProjects } from '../lib/file-paths.ts'
import { loadFeatureProgress } from '../lib/progress-context.ts'
import { extractTaskSection, readTaskField } from '../lib/plan-utils.ts'

interface GateResult {
  name: GateName
  command: string
  projectRoot: string
  cwd: string
  source: 'project' | 'workspace'
  ok: boolean
  exitCode: number
  stdout: string
  stderr: string
}

interface QaResult {
  enabled: boolean
  ok: boolean
  summary: string
  reason?: string
  needsAiReview?: boolean
  context?: Record<string, unknown>
  gates: GateResult[]
  branchCheck: BranchCheckResult | null
}

interface ReviewResult {
  enabled: boolean
  ok: boolean
  needsAiReview: boolean
  summary?: string
  context?: Record<string, unknown>
}

const { positional, projectRoot } = createSimpleContext()
const [feature] = positional

const executionConfigs = resolveReviewExecutionConfigs(projectRoot, feature)
const diffStat = runGit(projectRoot, 'diff', '--stat', 'HEAD') ?? ''
const changedFiles = splitLines(runGit(projectRoot, 'diff', '--name-only', 'HEAD') ?? '')

const qa = runQa(projectRoot, executionConfigs)
const review: ReviewResult = qa.ok
  ? {
      enabled: true,
      ok: true,
      needsAiReview: true,
      context: {
        kind: 'review',
        feature: feature ?? null,
        projectRoot,
        diffStat,
        changedFiles,
        qaSummary: qa.summary,
      },
    }
  : { enabled: false, ok: true, needsAiReview: false, summary: 'qa 未通过，未执行 review' }

const ok = qa.ok && !review.needsAiReview

printSummary({ ok, feature: feature ?? null, qa, review })

process.exit(ok ? 0 : 1)

function runQa(projectRootPath: string, executions: ExecutionConfig[]): QaResult {
  const activeGates = executions.flatMap((execution) => GATE_ORDER
    .filter((gate) => execution.gates[gate])
    .map((gate) => ({ gate, execution, command: execution.gates[gate] as string })))
  const results: GateResult[] = []
  const branchCheck = checkBranchName(projectRootPath)

  if (activeGates.length === 0) {
    return {
      enabled: true,
      ok: false,
      summary: '未配置任何 qa gate',
      reason: '需要先分析项目并配置 .hx 的 gates，再重新执行 review',
      needsAiReview: true,
      context: buildQaGateConfigContext(projectRootPath, executions),
      gates: results,
      branchCheck,
    }
  }

  for (const { gate, execution, command } of activeGates) {
    const result = spawnSync('bash', ['-lc', command], {
      cwd: execution.root,
      encoding: 'utf8',
      timeout: 120000,
      maxBuffer: 10 * 1024 * 1024,
    })

    const timedOut = result.signal === 'SIGTERM' && result.status === null
    const gateResult: GateResult = {
      name: gate,
      command,
      projectRoot: execution.root,
      cwd: execution.cwd,
      source: execution.gateSources[gate] ?? execution.source,
      ok: result.status === 0,
      exitCode: result.status ?? 1,
      stdout: (result.stdout ?? '').trim(),
      stderr: timedOut ? `${gate} 执行超时（120s）` : (result.stderr ?? '').trim(),
    }
    results.push(gateResult)

    if (!gateResult.ok) {
      return {
        enabled: true,
        ok: false,
        summary: `${gate} 失败`,
        reason: gateResult.stderr || gateResult.stdout || `${gate} exit code ${gateResult.exitCode}`,
        gates: results,
        branchCheck,
      }
    }
  }

  return {
    enabled: true,
    ok: true,
    summary: `${activeGates.map((item) => item.gate).join(', ')} 全部通过`,
    gates: results,
    branchCheck,
  }
}

function buildQaGateConfigContext(projectRootPath: string, executions: ExecutionConfig[]) {
  return {
    kind: 'qa-gates',
    projectRoot: projectRootPath,
    gateOrder: GATE_ORDER,
    configTargets: executions.map((execution) => ({
      projectRoot: execution.root,
      cwd: execution.cwd,
      src: execution.src,
      source: execution.source,
      configPath: execution.cwd ? resolve(execution.root, '.hx', 'config.yaml') : resolve(projectRootPath, '.hx', 'config.yaml'),
      configuredGates: GATE_ORDER.filter((gate) => execution.gates[gate]),
    })),
    instructions: [
      '分析项目脚本、包管理器和现有测试命令',
      '只把可执行且适合当前项目的命令写入 gates',
      '至少配置一个 qa gate 后重新执行 review',
    ],
  }
}

function resolveReviewExecutionConfigs(root: string, featureValue: string | undefined): ExecutionConfig[] {
  const workspaceProjects = getWorkspaceProjects(root)
  if (workspaceProjects.length === 0) {
    return [resolveExecutionConfig(root, '')]
  }

  if (!featureValue) {
    return [resolveExecutionConfig(root, '')]
  }

  const taskCwds = readFeatureTaskCwds(root, featureValue)
  return resolveWorkspaceExecutionConfigs(root, taskCwds)
}

function readFeatureTaskCwds(root: string, featureValue: string): string[] {
  try {
    const progress = loadFeatureProgress(root, featureValue)
    const planDoc = resolve(root, progress.data.planDoc)
    if (!existsSync(planDoc)) return []

    const planContent = readFileSync(planDoc, 'utf8')
    return progress.data.tasks
      .map((task) => readTaskCwd(planContent, task.id))
      .filter(Boolean)
  } catch {
    return []
  }
}

function readTaskCwd(planContent: string, taskId: string): string {
  return readTaskField(extractTaskSection(planContent, taskId), '执行目录')
}

function printSummary(summary: {
  ok: boolean
  feature: string | null
  qa: QaResult
  review: ReviewResult
}) {
  console.log(
    JSON.stringify(
      {
        ok: summary.ok,
        feature: summary.feature,
        qa: {
          enabled: summary.qa.enabled,
          ok: summary.qa.ok,
          summary: summary.qa.summary,
          reason: summary.qa.reason ?? null,
          needsAiReview: summary.qa.needsAiReview ?? false,
          context: summary.qa.context ?? null,
          gates: summary.qa.gates,
          branchCheck: summary.qa.branchCheck,
        },
        review: {
          enabled: summary.review.enabled,
          ok: summary.review.ok,
          needsAiReview: summary.review.needsAiReview,
          context: summary.review.context ?? null,
          summary: summary.review.summary ?? null,
        },
      },
      null,
      2,
    ),
  )
}
