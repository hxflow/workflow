/**
 * hx-check.ts — 核心检查 orchestrator
 *
 * 确定性工作：加载 gates、执行 qa、收集 diff 与规则文件、汇总结果。
 * AI 工作：review / clean 的语义判断。
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

const VALID_SCOPES = ['review', 'qa', 'clean', 'all', 'facts'] as const
type CheckScope = (typeof VALID_SCOPES)[number]

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

interface ScopeResult {
  enabled: boolean
  ok: boolean
  summary?: string
  reason?: string
  needsAiReview?: boolean
  context?: Record<string, unknown>
}

const { positional, options, projectRoot } = createSimpleContext()
const [feature] = positional
const scope = options.scope ?? 'all'

if (!VALID_SCOPES.includes(scope as CheckScope)) {
  console.error(`❌ --scope "${scope}" 无效，有效值: ${VALID_SCOPES.join(', ')}`)
  process.exit(1)
}

const executionConfigs = resolveCheckExecutionConfigs(projectRoot, feature)
const diffStat = runGit(projectRoot, 'diff', '--stat', 'HEAD') ?? ''
const changedFiles = splitLines(runGit(projectRoot, 'diff', '--name-only', 'HEAD') ?? '')

const selectedScope = scope as CheckScope

// ── facts 子命令：只返回确定性事实，不触发 AI ─────────────────────────────────
if (selectedScope === ('facts' as CheckScope)) {
  const activeGates = executionConfigs.flatMap((execution) => GATE_ORDER
    .filter((gate) => execution.gates[gate])
    .map((gate) => ({
      name: gate,
      command: execution.gates[gate],
      projectRoot: execution.root,
      cwd: execution.cwd,
      source: execution.gateSources[gate],
    })))

  console.log(JSON.stringify({
    ok: true,
    feature: feature ?? null,
    scope: 'facts',
    gates: activeGates,
    branchCheck: checkBranchName(projectRoot),
    diffStat,
    changedFiles,
  }, null, 2))
  process.exit(0)
}

const doReview = selectedScope === 'review' || selectedScope === 'all'
const doQa = selectedScope === 'qa' || selectedScope === 'all'
const doClean = selectedScope === 'clean' || selectedScope === 'all'

const qa = doQa ? runQa(projectRoot, executionConfigs) : { enabled: false, ok: true, summary: '未执行 qa', gates: [], branchCheck: null }
const review = doReview
  ? runSemanticScope('review', feature, {
      projectRoot,
      diffStat,
      changedFiles,
      qaSummary: qa.summary ?? '',
    })
  : { enabled: false, ok: true, summary: '未执行 review' }
const clean = doClean
  ? runSemanticScope('clean', feature, {
      projectRoot,
      diffStat,
      changedFiles,
      qaSummary: qa.summary ?? '',
    })
  : { enabled: false, ok: true, summary: '未执行 clean' }

// qa 失败 → pipeline 阻塞
const qaFailed = !qa.ok
// review/clean 提供上下文供 AI 分析
const needsAi = (review.needsAiReview || clean.needsAiReview) && qa.ok

const ok = !qaFailed && !needsAi

printSummary({
  ok,
  feature: feature ?? null,
  scope: selectedScope,
  qa,
  review,
  clean,
})

process.exit(ok ? 0 : 1)

function runQa(projectRootPath: string, executions: ExecutionConfig[]) {
  const activeGates = executions.flatMap((execution) => GATE_ORDER
    .filter((gate) => execution.gates[gate])
    .map((gate) => ({ gate, execution, command: execution.gates[gate] as string })))
  const results: GateResult[] = []
  const branchCheck = checkBranchName(projectRootPath)

  if (activeGates.length === 0) {
    return {
      enabled: true,
      ok: true,
      summary: '未配置任何 qa gate，已跳过',
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

function resolveCheckExecutionConfigs(root: string, featureValue: string | undefined): ExecutionConfig[] {
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

function runSemanticScope(
  kind: 'review' | 'clean',
  featureValue: string | undefined,
  payload: {
    projectRoot: string
    diffStat: string
    changedFiles: string[]
    qaSummary: string
  },
): ScopeResult {
  return {
    enabled: true,
    ok: true,
    needsAiReview: true,
    context: {
      kind,
      feature: featureValue ?? null,
      projectRoot: payload.projectRoot,
      diffStat: payload.diffStat,
      changedFiles: payload.changedFiles,
      qaSummary: payload.qaSummary,
    },
  }
}

function printSummary(summary: {
  ok: boolean
  feature: string | null
  scope: CheckScope
  qa: ScopeResult & { gates?: GateResult[]; branchCheck?: BranchCheckResult | null }
  review: ScopeResult
  clean: ScopeResult
}) {
  console.log(
    JSON.stringify(
      {
        ok: summary.ok,
        feature: summary.feature,
        scope: summary.scope,
        qa: {
          enabled: summary.qa.enabled,
          ok: summary.qa.ok,
          summary: summary.qa.summary ?? null,
          reason: summary.qa.reason ?? null,
          gates: summary.qa.gates ?? [],
          branchCheck: summary.qa.branchCheck ?? null,
        },
        review: {
          enabled: summary.review.enabled,
          ok: summary.review.ok,
          needsAiReview: summary.review.needsAiReview ?? false,
          context: summary.review.context ?? null,
          summary: summary.review.summary ?? null,
          reason: summary.review.reason ?? null,
        },
        clean: {
          enabled: summary.clean.enabled,
          ok: summary.clean.ok,
          needsAiReview: summary.clean.needsAiReview ?? false,
          context: summary.clean.context ?? null,
          summary: summary.clean.summary ?? null,
          reason: summary.clean.reason ?? null,
        },
      },
      null,
      2,
    ),
  )
}
