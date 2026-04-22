/**
 * hx-check.ts — 核心检查 orchestrator
 *
 * 确定性工作：加载 gates、执行 qa、收集 diff 与规则文件、汇总结果。
 * AI 工作：review / clean 的语义判断。
 */

import { spawnSync } from 'child_process'

import { createSimpleContext } from '../lib/tool-cli.ts'
import { readGatesConfig, GATE_ORDER } from '../lib/runtime-config.ts'
import type { GateName, GatesConfig } from '../lib/runtime-config.ts'
import { runGit, splitLines, checkBranchName } from '../lib/git-utils.ts'
import type { BranchCheckResult } from '../lib/git-utils.ts'

const VALID_SCOPES = ['review', 'qa', 'clean', 'all', 'facts'] as const
type CheckScope = (typeof VALID_SCOPES)[number]

interface GateResult {
  name: GateName
  command: string
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

const gates = readGatesConfig(projectRoot)
const diffStat = runGit(projectRoot, 'diff', '--stat', 'HEAD') ?? ''
const changedFiles = splitLines(runGit(projectRoot, 'diff', '--name-only', 'HEAD') ?? '')

const selectedScope = scope as CheckScope

// ── facts 子命令：只返回确定性事实，不触发 AI ─────────────────────────────────
if (selectedScope === ('facts' as CheckScope)) {
  const activeGates = GATE_ORDER.filter((gate) => gates[gate])

  console.log(JSON.stringify({
    ok: true,
    feature: feature ?? null,
    scope: 'facts',
    gates: Object.fromEntries(activeGates.map((g) => [g, gates[g]])),
    branchCheck: checkBranchName(projectRoot),
    diffStat,
    changedFiles,
  }, null, 2))
  process.exit(0)
}

const doReview = selectedScope === 'review' || selectedScope === 'all'
const doQa = selectedScope === 'qa' || selectedScope === 'all'
const doClean = selectedScope === 'clean' || selectedScope === 'all'

const qa = doQa ? runQa(projectRoot, gates) : { enabled: false, ok: true, summary: '未执行 qa', gates: [], branchCheck: null }
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

function runQa(projectRootPath: string, gatesMap: GatesConfig) {
  const activeGates = GATE_ORDER.filter((gate) => gatesMap[gate])
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

  for (const gate of activeGates) {
    const command = gatesMap[gate] as string
    const result = spawnSync('bash', ['-lc', command], {
      cwd: projectRootPath,
      encoding: 'utf8',
      timeout: 120000,
      maxBuffer: 10 * 1024 * 1024,
    })

    const timedOut = result.signal === 'SIGTERM' && result.status === null
    const gateResult: GateResult = {
      name: gate,
      command,
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
    summary: `${activeGates.join(', ')} 全部通过`,
    gates: results,
    branchCheck,
  }
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
