#!/usr/bin/env node
// scripts/hx-gate.js
// 用法: npm run hx:gate -- [--profile backend|frontend|mobile:ios] [--scheme App]
// 从 profile 读取 gate_commands 并按顺序执行

import { execSync } from 'child_process'

import { getDefaultProfile, loadProfile, parseArgs, profileUsage } from './lib/profile-utils.js'
import { resolveContext, FRAMEWORK_ROOT } from './lib/resolve-context.js'

const ctx = resolveContext()
const { options } = parseArgs(process.argv.slice(2))
const profileName = typeof options.profile === 'string' ? options.profile : ctx.defaultProfile || getDefaultProfile(ctx.projectRoot)

let profile
try {
  profile = loadProfile(FRAMEWORK_ROOT, profileName)
} catch (error) {
  console.error(`✗ ${error.message}`)
  console.error(`  可用 profile: ${profileUsage()}`)
  process.exit(1)
}

const orderedSteps = ['lint', 'build', 'type', 'test', 'arch']
const activeSteps = orderedSteps.filter((step) => profile.gateCommands[step])
if (activeSteps.length === 0) {
  console.error(`✗ ${profile.profile} 未定义 gate_commands`)
  process.exit(1)
}

const divider = '─'.repeat(50)
console.log(`\n${divider}`)
console.log(`质量门控 · ${profile.label}${profile.platformLabel ? ` · ${profile.platformLabel}` : ''}`)
console.log(divider)

for (const [index, step] of activeSteps.entries()) {
  const rawCommand = profile.gateCommands[step]
  const command = interpolateCommand(rawCommand, options, profile)

  if (/\{[\w-]+\}/.test(command)) {
    console.error(`✗ ${step} 命令仍包含未替换占位符: ${command}`)
    console.error('  请通过命令参数传入，例如 --scheme MyApp')
    process.exit(1)
  }

  process.stdout.write(`→ Step ${index + 1}/${activeSteps.length}  ${step.padEnd(6)} `)
  try {
    execSync(command, { cwd: ctx.projectRoot, stdio: 'inherit', shell: '/bin/zsh' })
    console.log(`✓ ${step} 通过`)
  } catch (error) {
    console.log(`✗ ${step} 失败`)
    process.exit(error.status || 1)
  }
}

console.log(`\n✓ ${profile.profile} 门控全部通过`)

function interpolateCommand(command, cliOptions, currentProfile) {
  const replacements = {
    ...currentProfile.paths,
    team: currentProfile.team,
    platform: currentProfile.platform || '',
    profile: currentProfile.profile,
    ...cliOptions
  }

  return String(command).replace(/\{([\w-]+)\}/g, (_, key) => {
    return replacements[key] ? String(replacements[key]) : `{${key}}`
  })
}
