#!/usr/bin/env node
// scripts/hx-review-checklist.js
// 用法: npm run hx:review -- [--profile backend|frontend|mobile:ios]
// 直接输出 profile 对应的审查清单

import { existsSync, readFileSync } from 'fs'

import { getDefaultProfile, loadProfile, parseArgs, profileUsage } from './lib/profile-utils.js'
import { resolveContext, FRAMEWORK_ROOT } from './lib/resolve-context.js'

const ctx = resolveContext()
const { options } = parseArgs(process.argv.slice(2))
const requestedProfile = pickRequestedProfile(options)

const divider = '─'.repeat(60)
console.log(`\n${divider}`)
console.log('  PR Review 清单  |  Harness Engineering')
console.log(divider)

try {
  printChecklist(requestedProfile)
} catch (error) {
  console.error(`\n✗ ${error.message}`)
  console.error(`  可用 profile: ${profileUsage()}`)
  process.exit(1)
}

console.log(divider + '\n')

function printChecklist(profileName) {
  const profile = loadProfile(FRAMEWORK_ROOT, profileName, { harnessDir: ctx.harnessDir })
  if (!existsSync(profile.files.reviewChecklistPath)) {
    throw new Error(`审查清单不存在: ${profile.files.reviewChecklistPath}`)
  }

  const content = readFileSync(profile.files.reviewChecklistPath, 'utf8').trim()

  console.log(`\n👥 ${profile.label}${profile.platformLabel ? ` · ${profile.platformLabel}` : ''}\n`)
  console.log(content)

  if (profile.reviewExtra.length > 0) {
    console.log('\n## 平台追加检查\n')
    profile.reviewExtra.forEach((item) => console.log(`- ${item}`))
  }

  console.log()
}

function pickRequestedProfile(options) {
  if (typeof options.profile === 'string') {
    return options.profile
  }

  return ctx.defaultProfile || getDefaultProfile(ctx.projectRoot)
}
