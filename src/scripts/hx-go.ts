#!/usr/bin/env node

/**
 * hx-go.ts — 全自动流水线 orchestrator
 *
 * 确定性工作：检测当前流水线阶段、串联 plan/run/check/mr 编排脚本并汇总结果。
 * AI 工作：由各子命令分别负责。
 */

import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'

import { parseArgs } from './lib/config-utils.ts'
import { findProjectRoot, getSafeCwd } from './lib/resolve-context.ts'
import {
  DEFAULT_PIPELINE_STEPS,
  getPipelineState,
  isDocDone,
  isPlanDone,
  isRunDone,
  type PipelineStepId,
  resolvePipelineStartStep,
} from './lib/pipeline-state.ts'

const PIPELINE_STEPS = ['doc', 'plan', 'run', 'check', 'mr']
const SCRIPT_BY_STEP: Partial<Record<PipelineStepId, string>> = {
  doc: fileURLToPath(new URL('./hx-doc.ts', import.meta.url)),
  plan: fileURLToPath(new URL('./hx-plan.ts', import.meta.url)),
  run: fileURLToPath(new URL('./hx-run.ts', import.meta.url)),
  check: fileURLToPath(new URL('./hx-check.ts', import.meta.url)),
  mr: fileURLToPath(new URL('./hx-mr.ts', import.meta.url)),
}

interface StepExecutionResult {
  id: PipelineStepId
  ok: boolean
  result: unknown
}

const argv = process.argv.slice(2)
const { positional, options } = parseArgs(argv)
const [feature] = positional
const fromStep = options.from ?? null
const pipelineName = options.pipeline ?? 'default'

if (!feature) {
  console.error('用法: hx go <feature> [--from <step>] [--pipeline <name>]')
  console.error(`       steps: ${PIPELINE_STEPS.join(' → ')}`)
  process.exit(1)
}

if (pipelineName !== 'default') {
  console.error(`⚠️  自定义 pipeline 尚未支持，当前只支持 default pipeline。`)
  process.exit(1)
}

const projectRoot = findProjectRoot(getSafeCwd())

// ── 确定起点 ────────────────────────────────────────────────

let startStep
try {
  startStep = resolvePipelineStartStep(projectRoot, feature, fromStep)
} catch (error) {
  console.error(`❌ ${error instanceof Error ? error.message : String(error)}`)
  console.error(`   有效 step: ${PIPELINE_STEPS.join(', ')}`)
  process.exit(1)
}

const startIndex = PIPELINE_STEPS.indexOf(startStep)
const pipelineState = getPipelineState(projectRoot, feature)
const remainingSteps = PIPELINE_STEPS.slice(startIndex) as PipelineStepId[]

const executedSteps: StepExecutionResult[] = []

for (const stepId of remainingSteps) {
  const stepResult = executeStep(stepId, feature)
  executedSteps.push(stepResult)

  const parsed = isPlainObject(stepResult.result) ? stepResult.result : null
  const actionRequired = parsed && parsed.actionRequired === true

  if (actionRequired) {
    // Step collected context and needs AI to act — pause pipeline
    printSummary({
      ok: false,
      actionRequired: true,
      feature,
      pipeline: pipelineName,
      startStep,
      state: summarizePipelineState(projectRoot, feature),
      executedSteps,
      blockedStep: stepId,
      nextAction:
        parsed && typeof parsed.nextAction === 'string' && parsed.nextAction.trim() !== ''
          ? `hx go ${feature} --from ${stepId}`
          : `hx go ${feature} --from ${stepId}`,
      stepOutput: parsed,
    })
    process.exit(0)
  }

  if (!stepResult.ok) {
    printSummary({
      ok: false,
      actionRequired: false,
      feature,
      pipeline: pipelineName,
      startStep,
      state: summarizePipelineState(projectRoot, feature),
      executedSteps,
      blockedStep: stepId,
      nextAction:
        parsed && typeof parsed.nextAction === 'string' && parsed.nextAction.trim() !== ''
          ? parsed.nextAction
          : `${DEFAULT_PIPELINE_STEPS.find((step) => step.id === stepId)?.command ?? `hx ${stepId}`} ${feature}`,
      reason:
        parsed && typeof parsed.reason === 'string' && parsed.reason.trim() !== ''
          ? parsed.reason
          : `${stepId} 执行失败`,
    })
    process.exit(1)
  }
}

printSummary({
  ok: true,
  actionRequired: false,
  feature,
  pipeline: pipelineName,
  startStep,
  state: summarizePipelineState(projectRoot, feature),
  executedSteps,
  blockedStep: null,
  nextAction: null,
  reason: null,
})

function executeStep(stepId: PipelineStepId, featureValue: string): StepExecutionResult {
  const scriptPath = SCRIPT_BY_STEP[stepId]
  if (!scriptPath) {
    return {
      id: stepId,
      ok: false,
      result: {
        ok: false,
        reason: `${stepId} 当前没有本地可执行脚本`,
        nextAction: `${DEFAULT_PIPELINE_STEPS.find((step) => step.id === stepId)?.command ?? `hx ${stepId}`} ${featureValue}`,
      },
    }
  }

  const result = spawnSync(process.execPath, [scriptPath, featureValue], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: process.env,
    timeout: 600000,
  })

  const parsed = parseStructuredOutput(result.stdout)
  if (parsed !== null) {
    return {
      id: stepId,
      ok: result.status === 0,
      result: parsed,
    }
  }

  return {
    id: stepId,
    ok: result.status === 0,
    result: {
      ok: result.status === 0,
      stdout: (result.stdout ?? '').trim(),
      stderr: (result.stderr ?? '').trim(),
      reason: (result.stderr || result.stdout || `${stepId} exit code ${result.status ?? 1}`).trim(),
    },
  }
}

function parseStructuredOutput(stdout: string): unknown | null {
  const text = stdout.trim()
  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    const match = text.match(/(\{[\s\S]*\})\s*$/)
    if (!match) {
      return null
    }

    try {
      return JSON.parse(match[1])
    } catch {
      return null
    }
  }
}

function summarizePipelineState(projectRootPath: string, featureValue: string) {
  return {
    doc: isDocDone(projectRootPath, featureValue) ? 'done' : 'pending',
    plan: isPlanDone(projectRootPath, featureValue) ? 'done' : 'pending',
    run: isRunDone(projectRootPath, featureValue) ? 'done' : 'pending',
    check: 'rerun',
    mr: 'rerun',
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function printSummary(summary: {
  ok: boolean
  actionRequired?: boolean
  feature: string
  pipeline: string
  startStep: PipelineStepId
  state: Record<string, string>
  executedSteps: StepExecutionResult[]
  blockedStep: PipelineStepId | null
  nextAction: string | null
  reason?: string | null
  stepOutput?: Record<string, unknown>
}) {
  const out: Record<string, unknown> = {
    ok: summary.ok,
    actionRequired: summary.actionRequired ?? false,
    feature: summary.feature,
    pipeline: summary.pipeline,
    startStep: summary.startStep,
    state: summary.state,
    executedSteps: summary.executedSteps,
    blockedStep: summary.blockedStep,
    nextAction: summary.nextAction,
    reason: summary.reason ?? null,
  }
  if (summary.stepOutput) out.stepOutput = summary.stepOutput
  console.log(JSON.stringify(out, null, 2))
}
