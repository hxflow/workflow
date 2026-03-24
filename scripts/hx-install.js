#!/usr/bin/env node
// scripts/hx-install.js
// 用法:
//   npm run hx:install -- /path/to/project
//   npm run hx:install -- . --profile backend --yes --skip-install

import React, { useEffect, useMemo, useState } from 'react'
import { render, Box, Text, useApp, useInput } from 'ink'
import { execSync } from 'child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync
} from 'fs'
import { basename, dirname, join, relative, resolve } from 'path'
import { fileURLToPath } from 'url'
import { cwd, stdin as input, stdout as output } from 'process'

import {
  assertCopyTargetSafe,
  assertInstallTargetSafe,
  collectTokenStatuses,
  createInstallEnv,
  detectPackageManager,
  ensureClaudeEntrypointLink
} from './lib/install-utils.js'
import { parseArgs, parseProfileSpecifier, profileUsage, readHarnessConfig } from './lib/profile-utils.js'

const SOURCE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PROFILE_CHOICES = ['backend', 'frontend', 'mobile:ios', 'mobile:android', 'mobile:harmony']

const { positional, options } = parseArgs(process.argv.slice(2))
const targetRoot = resolve(cwd(), positional[0] || '.')
const interactive = Boolean(output.isTTY && input.isTTY && !options.yes)

try {
  assertInstallTargetSafe(targetRoot, SOURCE_ROOT)
} catch (error) {
  console.error(`✗ ${error instanceof Error ? error.message : String(error)}`)
  console.error('  示例: npx qiyuan-harness-scaffold /path/to/project')
  process.exit(1)
}

const existingConfig = readHarnessConfig(targetRoot)
const initialProfile = validateProfile(
  typeof options.profile === 'string' ? options.profile : existingConfig.defaultProfile || 'frontend'
)

if (!interactive) {
  const packageManager = detectPackageManager(targetRoot)
  const result = performInstall({
    targetRoot,
    defaultProfile: initialProfile,
    shouldInstallDeps: Boolean(options.install && !options['skip-install']),
    packageManager
  })
  printPlainSummary(result)
  process.exit(result.ok ? 0 : 1)
}

render(
  React.createElement(InstallerApp, {
    targetRoot,
    initialProfile,
    skipInstall: Boolean(options['skip-install']),
    forceInstall: Boolean(options.install)
  })
)

function InstallerApp({ targetRoot: appTargetRoot, initialProfile: appInitialProfile, skipInstall, forceInstall }) {
  const { exit } = useApp()
  const directoryExists = existsSync(appTargetRoot)
  const [step, setStep] = useState(directoryExists ? 'profile' : 'directory')
  const [profileIndex, setProfileIndex] = useState(PROFILE_CHOICES.indexOf(appInitialProfile))
  const [shouldCreateDirectory, setShouldCreateDirectory] = useState(true)
  const [installDeps, setInstallDeps] = useState(forceInstall ? true : skipInstall ? false : true)
  const [result, setResult] = useState(null)
  const [errorMessage, setErrorMessage] = useState(null)

  const packageManager = useMemo(() => detectPackageManager(appTargetRoot), [appTargetRoot])

  useEffect(() => {
    if (step !== 'run') {
      return
    }

    try {
      const installResult = performInstall({
        targetRoot: appTargetRoot,
        defaultProfile: PROFILE_CHOICES[profileIndex] || appInitialProfile,
        shouldInstallDeps: installDeps,
        packageManager
      })
      setResult(installResult)
      setStep('done')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error))
      setStep('error')
    }
  }, [appInitialProfile, appTargetRoot, installDeps, packageManager, profileIndex, step])

  useInput((inputKey, key) => {
    if (step === 'directory') {
      handleBooleanToggle(key, setShouldCreateDirectory)
      if (key.return) {
        if (shouldCreateDirectory) {
          setStep('profile')
        } else {
          exit()
        }
      }
      return
    }

    if (step === 'profile') {
      if (key.upArrow) {
        setProfileIndex((current) => (current <= 0 ? PROFILE_CHOICES.length - 1 : current - 1))
        return
      }
      if (key.downArrow) {
        setProfileIndex((current) => (current >= PROFILE_CHOICES.length - 1 ? 0 : current + 1))
        return
      }
      if (key.return) {
        if (skipInstall) {
          setInstallDeps(false)
          setStep('run')
        } else if (forceInstall) {
          setInstallDeps(true)
          setStep('run')
        } else {
          setStep('deps')
        }
      }
      return
    }

    if (step === 'deps') {
      handleBooleanToggle(key, setInstallDeps)
      if (key.return) {
        setStep('run')
      }
      return
    }

    if ((step === 'done' || step === 'error') && (inputKey === 'q' || key.escape || key.return)) {
      process.exitCode = result?.ok === false || step === 'error' ? 1 : 0
      exit()
    }
  })

  function handleBooleanToggle(key, setter) {
    if (key.leftArrow || key.rightArrow || key.upArrow || key.downArrow || key.tab) {
      setter((current) => !current)
    }
  }

  if (step === 'directory') {
    return React.createElement(
      Screen,
      { title: 'Harness 安装向导' },
      React.createElement(Text, null, `目标目录不存在：${appTargetRoot}`),
      React.createElement(Text, { color: 'yellow' }, '是否创建该目录后继续安装？'),
      React.createElement(BooleanChoice, { value: shouldCreateDirectory, trueLabel: '创建并继续', falseLabel: '取消安装' }),
      React.createElement(Hint, { text: '方向键切换，Enter 确认' })
    )
  }

  if (step === 'profile') {
    return React.createElement(
      Screen,
      { title: 'Harness 安装向导' },
      React.createElement(Text, null, `目标项目：${appTargetRoot}`),
      React.createElement(Text, null, '请选择默认 profile。安装完成后，大多数命令可省略 --profile。'),
      React.createElement(OptionList, {
        options: PROFILE_CHOICES,
        selectedIndex: profileIndex,
        descriptions: {
          backend: '服务端流程与门控',
          frontend: '前端流程与门控',
          'mobile:ios': '移动端 iOS',
          'mobile:android': '移动端 Android',
          'mobile:harmony': '移动端 HarmonyOS'
        }
      }),
      React.createElement(Hint, { text: '上下方向键选择，Enter 继续' })
    )
  }

  if (step === 'deps') {
    return React.createElement(
      Screen,
      { title: 'Harness 安装向导' },
      React.createElement(Text, null, `检测到包管理器：${packageManager.name}`),
      React.createElement(Text, null, `是否立即执行 ${packageManager.installCommand} 安装依赖？`),
      React.createElement(BooleanChoice, { value: installDeps, trueLabel: '立即安装', falseLabel: '稍后手动安装' }),
      React.createElement(Hint, { text: '方向键切换，Enter 开始安装' })
    )
  }

  if (step === 'run') {
    return React.createElement(
      Screen,
      { title: 'Harness 安装向导' },
      React.createElement(Text, { color: 'cyan' }, '正在安装 workflow framework ...'),
      React.createElement(Text, null, `目标目录: ${appTargetRoot}`),
      React.createElement(Text, null, `默认 profile: ${PROFILE_CHOICES[profileIndex]}`),
      React.createElement(Text, null, `安装依赖: ${installDeps ? packageManager.installCommand : '跳过'}`)
    )
  }

  if (step === 'error') {
    return React.createElement(
      Screen,
      { title: 'Harness 安装失败' },
      React.createElement(Text, { color: 'red' }, errorMessage || '未知错误'),
      React.createElement(Hint, { text: '按 Enter / q 退出' })
    )
  }

  return React.createElement(ResultView, { result })
}

function ResultView({ result }) {
  return React.createElement(
    Screen,
    { title: result.ok ? 'Harness 安装完成' : 'Harness 安装失败' },
    React.createElement(Text, null, `目标目录: ${result.targetRoot}`),
    React.createElement(Text, null, `默认 profile: ${result.defaultProfile}`),
    React.createElement(Text, null, `包管理器: ${result.packageManager.name}`),
    React.createElement(ListSection, { title: '已创建', items: result.summary.created }),
    React.createElement(ListSection, { title: '已更新', items: result.summary.updated }),
    React.createElement(ListSection, { title: '已跳过（目标已存在）', items: result.summary.skipped }),
    React.createElement(TokenSection, { statuses: result.tokenStatuses }),
    result.summary.warnings.length > 0
      ? React.createElement(ListSection, { title: '警告', items: result.summary.warnings, color: 'yellow' })
      : null,
    React.createElement(Box, { flexDirection: 'column', marginTop: 1 },
      React.createElement(Text, { color: 'green' }, '下一步:'),
      React.createElement(Text, null, `- cd ${result.targetRoot}`),
      React.createElement(Text, null, `- npm run hx:doc -- <feature-name> --profile ${result.defaultProfile}`),
      React.createElement(Text, null, `- 后续若省略 --profile，将默认使用 ${result.defaultProfile}`)
    ),
    React.createElement(Hint, { text: '按 Enter / q 退出' })
  )
}

function Screen({ title, children }) {
  return React.createElement(
    Box,
    { flexDirection: 'column', padding: 1 },
    React.createElement(Text, { color: 'cyanBright', bold: true }, title),
    React.createElement(Box, { marginTop: 1, flexDirection: 'column' }, children)
  )
}

function OptionList({ options, selectedIndex, descriptions = {} }) {
  return React.createElement(
    Box,
    { flexDirection: 'column', marginTop: 1 },
    options.map((option, index) => React.createElement(
      Box,
      { key: option },
      React.createElement(Text, { color: index === selectedIndex ? 'green' : undefined }, index === selectedIndex ? '› ' : '  '),
      React.createElement(Text, { color: index === selectedIndex ? 'green' : undefined }, option),
      descriptions[option]
        ? React.createElement(Text, { color: 'gray' }, `  ${descriptions[option]}`)
        : null
    ))
  )
}

function BooleanChoice({ value, trueLabel, falseLabel }) {
  return React.createElement(
    Box,
    { marginTop: 1 },
    React.createElement(Text, { color: value ? 'green' : undefined }, value ? `› ${trueLabel}` : `  ${trueLabel}`),
    React.createElement(Text, null, '    '),
    React.createElement(Text, { color: !value ? 'green' : undefined }, !value ? `› ${falseLabel}` : `  ${falseLabel}`)
  )
}

function ListSection({ title, items, color }) {
  if (!items || items.length === 0) {
    return null
  }

  return React.createElement(
    Box,
    { flexDirection: 'column', marginTop: 1 },
    React.createElement(Text, { color: color || 'green' }, title),
    ...items.map((item) => React.createElement(Text, { key: `${title}-${item}` }, `- ${item}`))
  )
}

function TokenSection({ statuses }) {
  return React.createElement(
    Box,
    { flexDirection: 'column', marginTop: 1 },
    React.createElement(Text, { color: 'green' }, '凭据检查'),
    ...statuses.flatMap((status) => {
      if (status.matched) {
        return [
          React.createElement(
            Text,
            { key: `${status.label}-ok` },
            `- ✓ ${status.label}: 已检测到 ${status.matched.key}（来源: ${status.matched.source}）`
          )
        ]
      }

      return [
        React.createElement(
          Text,
          { key: `${status.label}-warn`, color: 'yellow' },
          `- ⚠ ${status.label}: 未检测到，请设置 ${status.recommendedKey}`
        ),
        React.createElement(
          Text,
          { key: `${status.label}-example`, color: 'gray' },
          `  示例: export ${status.recommendedKey}="your_token_here"`
        )
      ]
    })
  )
}

function Hint({ text }) {
  return React.createElement(
    Box,
    { marginTop: 1 },
    React.createElement(Text, { color: 'gray' }, text)
  )
}

function performInstall({ targetRoot, defaultProfile, shouldInstallDeps, packageManager }) {
  assertInstallTargetSafe(targetRoot, SOURCE_ROOT)

  const summary = {
    created: [],
    updated: [],
    skipped: [],
    warnings: []
  }

  if (!existsSync(targetRoot)) {
    mkdirSync(targetRoot, { recursive: true })
  }

  copyFrameworkFiles(targetRoot, defaultProfile, summary)
  ensureClaudeEntrypointLink(targetRoot, summary)
  mergePackageJson(targetRoot, summary)
  writeHarnessConfigFile(targetRoot, defaultProfile, summary)
  const tokenStatuses = collectTokenStatuses(targetRoot)

  if (shouldInstallDeps) {
    runDependencyInstall(targetRoot, packageManager, summary)
  }

  return {
    ok: true,
    targetRoot,
    defaultProfile,
    packageManager,
    tokenStatuses,
    summary
  }
}

function copyFrameworkFiles(targetRoot, defaultProfile, summary) {
  const parsed = parseProfileSpecifier(defaultProfile)
  const team = parsed?.team || 'frontend'

  const managedEntries = [
    { source: resolve(SOURCE_ROOT, 'AGENTS.md'), target: resolve(targetRoot, 'AGENTS.md') },
    { source: resolve(SOURCE_ROOT, 'docs'), target: resolve(targetRoot, 'docs') },
    { source: resolve(SOURCE_ROOT, 'profiles', team), target: resolve(targetRoot, 'profiles', team) },
    { source: resolve(SOURCE_ROOT, 'scripts'), target: resolve(targetRoot, 'scripts') },
    { source: resolve(SOURCE_ROOT, '.husky'), target: resolve(targetRoot, '.husky') },
    { source: resolve(SOURCE_ROOT, '.claude', 'commands'), target: resolve(targetRoot, '.claude', 'commands') },
    { source: resolve(SOURCE_ROOT, '.claude', 'skills'), target: resolve(targetRoot, '.claude', 'skills') },
    { source: resolve(SOURCE_ROOT, 'eslint.config.js'), target: resolve(targetRoot, 'eslint.config.js') },
    { source: resolve(SOURCE_ROOT, 'tsconfig.json'), target: resolve(targetRoot, 'tsconfig.json') },
    { source: resolve(SOURCE_ROOT, 'vitest.config.ts'), target: resolve(targetRoot, 'vitest.config.ts') }
  ]

  for (const entry of managedEntries) {
    if (!existsSync(entry.source)) {
      summary.warnings.push(`安装源不存在，已跳过: ${relative(SOURCE_ROOT, entry.source)}`)
      continue
    }
    copyEntry(entry.source, entry.target, targetRoot, summary)
  }
}

function copyEntry(sourcePath, targetPath, targetRoot, summary) {
  const stats = statSync(sourcePath)
  if (stats.isDirectory()) {
    assertCopyTargetSafe(sourcePath, targetPath)
    mkdirSync(targetPath, { recursive: true })
    for (const child of readdirSync(sourcePath)) {
      if (shouldSkipCopy(child)) {
        continue
      }
      copyEntry(join(sourcePath, child), join(targetPath, child), targetRoot, summary)
    }
    return
  }

  const relativeTarget = relative(targetRoot, targetPath) || basename(targetPath)
  if (existsSync(targetPath)) {
    summary.skipped.push(relativeTarget)
    return
  }

  mkdirSync(dirname(targetPath), { recursive: true })
  cpSync(sourcePath, targetPath)
  summary.created.push(relativeTarget)
}

function shouldSkipCopy(name) {
  return name === '.DS_Store' || name === 'README.md'
}

function mergePackageJson(targetRoot, summary) {
  const sourcePkg = JSON.parse(readFileSync(resolve(SOURCE_ROOT, 'package.json'), 'utf8'))
  const targetPkgPath = resolve(targetRoot, 'package.json')
  const targetPkg = existsSync(targetPkgPath)
    ? JSON.parse(readFileSync(targetPkgPath, 'utf8'))
    : createPackageJsonSkeleton(targetRoot)

  const frameworkScripts = Object.fromEntries(
    Object.entries(sourcePkg.scripts || {}).filter(([key]) => key.startsWith('hx:') || key.startsWith('//'))
  )
  targetPkg.scripts = { ...(targetPkg.scripts || {}), ...frameworkScripts }

  if (!targetPkg.scripts.ci && sourcePkg.scripts?.ci) {
    targetPkg.scripts.ci = sourcePkg.scripts.ci
  } else if (sourcePkg.scripts?.ci) {
    targetPkg.scripts['hx:ci'] = sourcePkg.scripts.ci
  }

  if (!targetPkg.type) {
    targetPkg.type = sourcePkg.type
  }

  targetPkg.devDependencies = targetPkg.devDependencies || {}
  for (const [name, version] of Object.entries(sourcePkg.devDependencies || {})) {
    if (!targetPkg.devDependencies[name]) {
      targetPkg.devDependencies[name] = version
    }
  }

  if (!targetPkg.engines?.node && sourcePkg.engines?.node) {
    targetPkg.engines = { ...(targetPkg.engines || {}), node: sourcePkg.engines.node }
  }

  if (!targetPkg['lint-staged'] && sourcePkg['lint-staged']) {
    targetPkg['lint-staged'] = sourcePkg['lint-staged']
  }

  writeJson(targetPkgPath, targetPkg)
  summary.updated.push('package.json')
}

function createPackageJsonSkeleton(directory) {
  return {
    name: basename(directory).toLowerCase().replace(/[^a-z0-9-_]+/g, '-'),
    version: '1.0.0',
    private: true,
    type: 'module',
    scripts: {},
    devDependencies: {}
  }
}

function writeHarnessConfigFile(targetRoot, defaultProfile, summary) {
  const configPath = resolve(targetRoot, 'harness.config.json')
  const nextConfig = {
    ...readHarnessConfig(targetRoot),
    defaultProfile
  }
  writeJson(configPath, nextConfig)
  summary.updated.push('harness.config.json')
}

function runDependencyInstall(targetRoot, packageManager, summary) {
  try {
    execSync(packageManager.installCommand, {
      cwd: targetRoot,
      env: createInstallEnv(packageManager),
      stdio: 'pipe',
      shell: '/bin/zsh'
    })
    summary.updated.push(`${packageManager.name}:install`)
  } catch (error) {
    const stderr = error?.stderr?.toString()?.trim()
    summary.warnings.push(stderr ? `${packageManager.installCommand} 失败: ${stderr}` : `${packageManager.installCommand} 执行失败，请手动重试`)
  }
}

function validateProfile(profileName) {
  try {
    return parseProfileSpecifier(profileName)?.profile || 'frontend'
  } catch (error) {
    console.error(`✗ ${error.message}`)
    console.error(`  可用 profile: ${profileUsage()}`)
    process.exit(1)
  }
}

function printPlainSummary(result) {
  const divider = '═'.repeat(60)
  console.log(`\n${divider}`)
  console.log('Harness Workflow Framework 安装完成')
  console.log(divider)
  console.log(`目标目录: ${result.targetRoot}`)
  console.log(`默认 profile: ${result.defaultProfile}`)
  console.log(`包管理器: ${result.packageManager.name}`)

  if (result.summary.created.length > 0) {
    console.log('\n已创建:')
    result.summary.created.forEach((item) => console.log(`- ${item}`))
  }
  if (result.summary.updated.length > 0) {
    console.log('\n已更新:')
    result.summary.updated.forEach((item) => console.log(`- ${item}`))
  }
  if (result.summary.skipped.length > 0) {
    console.log('\n已跳过（目标已存在）:')
    result.summary.skipped.forEach((item) => console.log(`- ${item}`))
  }

  console.log('\n凭据检查:')
  result.tokenStatuses.forEach((status) => {
    if (status.matched) {
      console.log(`- ✓ ${status.label}: 已检测到 ${status.matched.key}（来源: ${status.matched.source}）`)
      return
    }
    console.log(`- ⚠ ${status.label}: 未检测到，请设置 ${status.recommendedKey}`)
    console.log(`  示例: export ${status.recommendedKey}="your_token_here"`)
  })

  if (result.summary.warnings.length > 0) {
    console.log('\n警告:')
    result.summary.warnings.forEach((warning) => console.log(`- ${warning}`))
  }

  console.log('\n下一步:')
  console.log(`- cd ${result.targetRoot}`)
  console.log(`- npm run hx:doc -- <feature-name> --profile ${result.defaultProfile}`)
  console.log(`- 后续若省略 --profile，将默认使用 ${result.defaultProfile}`)
  console.log()
}

function writeJson(filePath, data) {
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}
