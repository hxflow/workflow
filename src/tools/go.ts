#!/usr/bin/env node

/**
 * hx-go.ts — 流水线事实工具
 *
 * 用法：
 *   hx go next <feature> [--from <step>]    返回流水线下一步应执行的命令
 *   hx go state <feature>                   返回流水线完整状态
 *
 * 不再 spawn 子进程执行步骤。AI 读取下一步后自行调用对应命令。
 */

import { parseArgs } from '../lib/config-utils.ts'
import { findProjectRoot, getSafeCwd } from '../lib/resolve-context.ts'
import {
  DEFAULT_PIPELINE_STEPS,
  getPipelineState,
  type PipelineStepId,
  resolvePipelineStartStep,
} from '../lib/pipeline-state.ts'

const PIPELINE_STEPS = ['doc', 'plan', 'run', 'check', 'mr']

const argv = process.argv.slice(2)
const [sub, ...rest] = argv
const { positional, options } = parseArgs(rest)
const [feature] = positional

function out(data: unknown) {
  console.log(JSON.stringify(data, null, 2))
}

function err(message: string): never {
  console.error(JSON.stringify({ ok: false, error: message }))
  process.exit(1)
}

const projectRoot = findProjectRoot(getSafeCwd())

switch (sub) {
  case 'next': {
    if (!feature) err('用法：hx go next <feature> [--from <step>]')

    const fromStep = options.from ?? null

    let startStep: string
    try {
      startStep = resolvePipelineStartStep(projectRoot, feature, fromStep as string | null)
    } catch (error) {
      err(error instanceof Error ? error.message : String(error))
    }

    const pipelineState = getPipelineState(projectRoot, feature)
    const stepDef = DEFAULT_PIPELINE_STEPS.find((s) => s.id === startStep)

    out({
      ok: true,
      feature,
      nextStep: startStep,
      command: stepDef?.command ?? `hx ${startStep}`,
      state: pipelineState.map((s) => ({ id: s.id, name: s.name, status: s.status })),
    })
    break
  }

  case 'state': {
    if (!feature) err('用法：hx go state <feature>')

    const pipelineState = getPipelineState(projectRoot, feature)
    let startStep: string
    try {
      startStep = resolvePipelineStartStep(projectRoot, feature)
    } catch {
      startStep = 'doc'
    }

    const allDone = pipelineState.every((s) => s.status === 'done' || s.status === 'skipped')

    out({
      ok: true,
      feature,
      allDone,
      nextStep: allDone ? null : startStep,
      steps: pipelineState.map((s) => ({
        id: s.id,
        name: s.name,
        command: s.command,
        status: s.status,
      })),
    })
    break
  }

  default:
    err(`未知子命令 "${sub ?? ''}"，可用：next / state`)
}
