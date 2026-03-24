#!/usr/bin/env node
// scripts/hx-task-done.js
// 用法: npm run hx:done -- <TASK-ID>

import { readdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

import { inferProfileFromProgress, isTaskId } from './lib/profile-utils.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const taskId = process.argv.slice(2).find((arg) => !arg.startsWith('--'))

if (!taskId) {
  console.error('用法: npm run hx:done -- <TASK-ID>')
  console.error('示例: npm run hx:done -- TASK-BE-03')
  process.exit(1)
}

if (!isTaskId(taskId)) {
  console.error(`✗ TASK ID 格式不正确: ${taskId}`)
  console.error('  正确格式示例: TASK-BE-01 / TASK-FE-01 / TASK-IOS-01')
  process.exit(1)
}

const plansDir = resolve(ROOT, 'docs/plans')
let progressFiles = []

try {
  progressFiles = readdirSync(plansDir)
    .filter((fileName) => fileName.endsWith('-progress.json'))
    .map((fileName) => resolve(plansDir, fileName))
} catch {
  console.error('✗ docs/plans/ 目录不存在')
  process.exit(1)
}

if (progressFiles.length === 0) {
  console.error('✗ docs/plans/ 中没有进度文件，请先运行 npm run hx:plan')
  process.exit(1)
}

let found = false

for (const filePath of progressFiles) {
  try {
    const data = JSON.parse(readFileSync(filePath, 'utf8'))
    const task = data.tasks?.find((item) => item.id === taskId)
    if (!task) {
      continue
    }

    found = true
    if (task.status === 'done') {
      console.log(`ℹ  ${taskId} 已经是完成状态（${task.completedAt || '时间未知'}）`)
      break
    }

    task.status = 'done'
    task.completedAt = new Date().toISOString()
    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')

    const doneCount = data.tasks.filter((item) => item.status === 'done').length
    console.log(`✓ ${taskId} 已标记为完成`)
    console.log(`  特性: ${data.feature}  进度: ${doneCount}/${data.tasks.length}`)

    if (doneCount === data.tasks.length) {
      console.log(`\n🎉 特性 [${data.feature}] 所有任务已完成`)
      console.log('  记得运行 npm run hx:entropy 检查是否有可沉淀的规则')
      break
    }

    const nextTask = data.tasks.find((item) => item.status === 'pending')
    if (nextTask) {
      const profile = inferProfileFromProgress(data)
      console.log(`\n下一个任务: ${nextTask.id} — ${nextTask.name}`)
      console.log(
        `  npm run hx:run -- ${data.feature} ${nextTask.id}${profile ? ` --profile ${profile}` : ''}`
      )
    }
    break
  } catch (error) {
    console.warn(`⚠  无法解析 ${filePath}: ${error.message}`)
  }
}

if (!found) {
  console.error(`✗ 未找到任务 ${taskId}`)
  console.error('  请确认 progress.json 已生成，且 TASK ID 与计划一致')
  process.exit(1)
}
