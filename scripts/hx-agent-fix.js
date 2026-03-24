#!/usr/bin/env node
// scripts/hx-agent-fix.js
// 用法: npm run hx:fix -- [--profile backend|frontend|mobile:ios] [--log=...] [--file=...]
// 根据错误日志生成带团队上下文的修复 Prompt

import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
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

let logContent = ''
if (typeof options.file === 'string') {
  const logPath = resolve(ctx.projectRoot, options.file)
  if (!existsSync(logPath)) {
    console.error(`✗ 日志文件不存在: ${options.file}`)
    process.exit(1)
  }
  logContent = readFileSync(logPath, 'utf8').trim()
} else if (typeof options.log === 'string') {
  logContent = options.log
} else {
  try {
    logContent = execSync('npm run hx:test 2>&1 | tail -40', {
      cwd: ctx.projectRoot,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    })
  } catch (error) {
    logContent = error.stdout || error.stderr || ''
  }
}

const divider = '═'.repeat(60)
const goldenRulesPath = profile.files.goldenRulesPath.replace(`${FRAMEWORK_ROOT}/`, '')

console.log(`\n${divider}`)
console.log(`  Bug 修复 Prompt 生成器 (${profile.label}${profile.platformLabel ? ` · ${profile.platformLabel}` : ''})`)
console.log(divider)
console.log()
console.log('将以下内容复制给 Claude/Codex：')
console.log()

const prompt = `修复以下错误。

**在开始前，请先读取：**
- .harness/AGENTS.md
- ${ctx.goldenPrinciplesPath.replace(FRAMEWORK_ROOT + '/', '')}
- ${goldenRulesPath}
- 报错涉及的源文件（见下方）

**错误信息：**
\`\`\`
${logContent || '[请在此粘贴错误日志或测试失败输出]'}
\`\`\`

**修复要求：**
1. 不修改任何已有接口的签名（不改变函数参数和返回类型）
2. 不修改现有测试的期望值（测试是行为契约）
3. 修复后补充一个能复现此 Bug 的回归测试
4. 错误处理遵循全局黄金原则和团队 golden-rules
5. 修复产物必须符合 ${profile.profile} 的架构约束

**完成标准：**
1. 运行对应 profile 的门控命令并全部通过
2. 新增的回归测试能捕获此类错误
3. PR 标题格式：\`fix(<模块>): <一句话描述>\`
`

console.log(prompt)
console.log(divider)
console.log('\n提示：')
console.log('  --log="错误文本"    直接传入日志片段')
console.log('  --file=logs/err.txt 从文件读取日志')
console.log(`  --profile=${profile.profile} 指定团队约束（默认 ${profileName}）`)
