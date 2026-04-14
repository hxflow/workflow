#!/usr/bin/env node

/**
 * hx-check.ts — 核心检查 orchestrator
 *
 * 确定性工作：加载 gates、执行 qa、收集 diff 与规则文件、汇总结果。
 * AI 工作：review / clean 的语义判断。
 */

import { existsSync, readFileSync } from 'fs'
import { spawnSync } from 'child_process'
import { resolve } from 'path'

import { parseArgs } from '../lib/config-utils.ts'
import { FRAMEWORK_ROOT, findProjectRoot, getSafeCwd } from '../lib/resolve-context.ts'

const VALID_SCOPES = ['review', 'qa', 'clean', 'all', 'facts'] as const
const GATE_ORDER = ['lint', 'build', 'type', 'test'] as const

type CheckScope = (typeof VALID_SCOPES)[number]
type GateName = (typeof GATE_ORDER)[number]

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

interface BranchCheckResult {
  ok: boolean
  branch: string
  reason: string | null
}

const argv = process.argv.slice(2)
const { positional, options } = parseArgs(argv)
const [feature] = positional
const scope = options.scope ?? 'all'

if (!VALID_SCOPES.includes(scope as CheckScope)) {
  console.error(`❌ --scope "${scope}" 无效，有效值: ${VALID_SCOPES.join(', ')}`)
  process.exit(1)
}

const projectRoot = findProjectRoot(getSafeCwd())
const gates = loadGates(projectRoot)
const reviewChecklist = resolveRuleFile(projectRoot, 'review-checklist.md')
const goldenRules = resolveRuleFile(projectRoot, 'golden-rules.md')
const diffStat = runGit(projectRoot, 'diff', '--stat', 'HEAD')
const changedFiles = splitLines(runGit(projectRoot, 'diff', '--name-only', 'HEAD'))

const selectedScope = scope as CheckScope

// ── facts 子命令：只返回确定性事实，不触发 AI ─────────────────────────────────
if (selectedScope === ('facts' as CheckScope)) {
  const factsGates = loadGates(projectRoot)
  const activeGates = GATE_ORDER.filter((gate) => factsGates[gate])

  console.log(JSON.stringify({
    ok: true,
    feature: feature ?? null,
    scope: 'facts',
    gates: Object.fromEntries(activeGates.map((g) => [g, factsGates[g]])),
    branchCheck: checkBranchName(projectRoot),
    diffStat,
    changedFiles,
    reviewChecklist,
    goldenRules,
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
      reviewChecklist,
      goldenRules,
      diffStat,
      changedFiles,
      qaSummary: qa.summary ?? '',
    })
  : { enabled: false, ok: true, summary: '未执行 review' }
const clean = doClean
  ? runSemanticScope('clean', feature, {
      projectRoot,
      reviewChecklist,
      goldenRules,
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

function loadGates(projectRootPath: string): Partial<Record<GateName, string>> {
  const gates: Partial<Record<GateName, string>> = {}

  try {
    const configPath = resolve(projectRootPath, '.hx', 'config.yaml')
    if (!existsSync(configPath)) {
      return gates
    }

    const content = readFileSync(configPath, 'utf8')
    const gatesMatch = content.match(/^gates:\s*\n((?:[ \t]+\S[^\n]*\n?)*)/m)
    if (!gatesMatch) {
      return gates
    }

    for (const line of gatesMatch[1].split('\n')) {
      const match = line.match(/^\s+(\w+):\s*(.*)/)
      if (!match) {
        continue
      }

      // strip surrounding YAML quotes ('' or "") before empty-check
      const rawValue = match[2].trim()
      const value = rawValue.replace(/^(['"])(.*)\1$/, '$2').trim()
      if (!value) {
        continue
      }

      if (GATE_ORDER.includes(match[1] as GateName)) {
        gates[match[1] as GateName] = value
      }
    }
  } catch (error) {
    console.error(
      `⚠️  无法读取 .hx/config.yaml gates 配置：${error instanceof Error ? error.message : String(error)}`,
    )
    return {}
  }

  return gates
}

function resolveRuleFile(projectRootPath: string, name: string): string | null {
  const project = resolve(projectRootPath, '.hx', 'rules', name)
  const framework = resolve(FRAMEWORK_ROOT, 'templates', 'rules', name)
  if (existsSync(project)) {
    return project
  }
  if (existsSync(framework)) {
    return framework
  }
  return null
}

function runQa(projectRootPath: string, gatesMap: Partial<Record<GateName, string>>) {
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
    const result = spawnSync('zsh', ['-lc', command], {
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
    reviewChecklist: string | null
    goldenRules: string | null
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
      reviewChecklist: payload.reviewChecklist,
      goldenRules: payload.goldenRules,
      diffStat: payload.diffStat,
      changedFiles: payload.changedFiles,
      qaSummary: payload.qaSummary,
    },
  }
}

function checkBranchName(projectRootPath: string): BranchCheckResult {
  const PROTECTED = new Set(['main', 'master', 'develop'])
  const VALID_PATTERN = /^(feat|fix|bugfix|refactor|chore|docs|test|hotfix)\/[a-zA-Z0-9_-]+$/

  const branch = runGit(projectRootPath, 'rev-parse', '--abbrev-ref', 'HEAD')
  if (!branch) {
    return { ok: true, branch: '(unknown)', reason: null }
  }
  if (PROTECTED.has(branch)) {
    return { ok: true, branch, reason: null }
  }
  if (VALID_PATTERN.test(branch)) {
    return { ok: true, branch, reason: null }
  }

  const slug = branch
    .toLowerCase()
    .replace(/[^a-z0-9-_/]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  const suggested = `feat/${slug}`
  return {
    ok: false,
    branch,
    reason: `分支名 "${branch}" 不符合规范 <type>/<scope>，建议重命名为 "${suggested}"`,
  }
}

function runGit(projectRootPath: string, ...args: string[]): string {
  const result = spawnSync('git', args, {
    cwd: projectRootPath,
    encoding: 'utf8',
  })
  return result.status === 0 ? result.stdout.trim() : ''
}

function splitLines(value: string): string[] {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
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
