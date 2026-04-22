/**
 * go.ts — 流水线事实工具
 *
 * 用法：
 *   bun scripts/tools/go.ts next <feature> [--from <step>]    返回下一步、裸脚本及 preHooks
 *   bun scripts/tools/go.ts state <feature>                   返回流水线完整状态
 *   未安装 bun 时可改用 npx tsx scripts/tools/go.ts ...
 *
 * AI 读取结果后自行调用对应裸脚本。
 */

import { exitWithJsonError as err, printJson as out } from '../lib/json-cli.ts'
import { resolveFeatureArtifactRoot } from '../lib/file-paths.ts'
import { getPipelineFullState, resolveStartStep } from '../lib/pipeline-runner.ts'
import { createToolContext } from '../lib/tool-cli.ts'

const { sub, positional, options, projectRoot: initialProjectRoot } = createToolContext()
const [feature] = positional

switch (sub) {
  case 'next': {
    if (!feature) err('用法：bun scripts/tools/go.ts next <feature> [--from <step>]（未安装 bun 时用：npx tsx scripts/tools/go.ts next <feature> [--from <step>]）')

    const projectRoot = resolveFeatureArtifactRoot(initialProjectRoot, feature)
    const fromStep = (options.from as string) ?? null

    let result: { stepId: string; toolScript: string; pipeline: string; preHooks: string[] }
    try {
      result = resolveStartStep(projectRoot, feature, fromStep)
    } catch (error) {
      err(error instanceof Error ? error.message : String(error))
    }

    const state = getPipelineFullState(projectRoot, feature)

    out({
      ok: true,
      feature,
      nextStep: result.stepId,
      toolScript: result.toolScript,
      preHooks: result.preHooks,
      pipeline: result.pipeline,
      steps: state?.steps.map((s) => ({
        id: s.id,
        name: s.name,
        status: s.status,
        toolScript: s.toolScript,
        preHooks: s.preHooks,
      })),
    })
    break
  }

  case 'state': {
    if (!feature) err('用法：bun scripts/tools/go.ts state <feature>（未安装 bun 时用：npx tsx scripts/tools/go.ts state <feature>）')

    const projectRoot = resolveFeatureArtifactRoot(initialProjectRoot, feature)
    const state = getPipelineFullState(projectRoot, feature)
    if (!state) err('Pipeline "default" 未找到')

    out({ ok: true, ...state })
    break
  }

  default:
    err(`未知子命令 "${sub ?? ''}"，可用：next / state`)
}
