#!/usr/bin/env bun

import { resolveCommandHooks } from './hook-resolver.ts'
import { exitWithJsonError as err, printJson as out } from './json-cli.ts'
import { createToolContext } from './tool-cli.ts'

const { sub, positional, projectRoot } = createToolContext()

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

  default:
    err(`未知子命令 "${sub ?? ''}"，可用：resolve`)
}
