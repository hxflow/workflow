#!/usr/bin/env bun

import { resolveCommandHooks } from './hook-resolver.ts'
import { exitWithJsonError as err, printJson as out } from './json-cli.ts'
import { createToolContext } from './tool-cli.ts'
import { guardWrite } from './write-guard.ts'

const { sub, positional, options, projectRoot } = createToolContext()

switch (sub) {
  case 'resolve': {
    const [command] = positional
    if (!command) {
      err('用法：bun scripts/lib/hook.ts resolve <command>（未安装 bun 时用：npx tsx scripts/lib/hook.ts resolve <command>）')
    }

    try {
      const resolved = resolveCommandHooks(projectRoot, command)
      out({ ok: true, ...resolved })
    } catch (error) {
      err(error instanceof Error ? error.message : String(error))
    }
    break
  }

  case 'guard-write': {
    const feature = typeof options.feature === 'string' ? options.feature : undefined
    const taskId = typeof options.task === 'string' ? options.task : undefined
    const result = guardWrite({
      projectRoot,
      paths: positional,
      feature,
      taskId,
      env: process.env,
    })

    if (!result.ok) {
      console.error(JSON.stringify(result, null, 2))
      process.exit(1)
    }

    out(result)
    break
  }

  default:
    err(`未知子命令 "${sub ?? ''}"，可用：resolve / guard-write`)
}
