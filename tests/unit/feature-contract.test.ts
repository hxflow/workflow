import { readFileSync } from 'fs'
import { resolve } from 'path'

import { describe, expect, it } from 'bun:test'

const COMMANDS_DIR = resolve(process.cwd(), 'src', 'commands')
const CONTRACTS_DIR = resolve(process.cwd(), 'src', 'contracts')
const SCRIPTS_DIR = resolve(process.cwd(), 'src', 'scripts')
const featureContract = readFileSync(resolve(CONTRACTS_DIR, 'feature-contract.md'), 'utf8')
const ownershipContract = readFileSync(resolve(CONTRACTS_DIR, 'ownership-contract.md'), 'utf8')
const hxDoc = readFileSync(resolve(COMMANDS_DIR, 'hx-doc.md'), 'utf8')
const hxPlan = readFileSync(resolve(COMMANDS_DIR, 'hx-plan.md'), 'utf8')
const hxRun = readFileSync(resolve(COMMANDS_DIR, 'hx-run.md'), 'utf8')
const hxMr = readFileSync(resolve(COMMANDS_DIR, 'hx-mr.md'), 'utf8')
const hxGo = readFileSync(resolve(COMMANDS_DIR, 'hx-go.md'), 'utf8')
// 代码驱动命令的编排脚本
const hxPlanScript = readFileSync(resolve(SCRIPTS_DIR, 'hx-plan.ts'), 'utf8')
const hxRunScript = readFileSync(resolve(SCRIPTS_DIR, 'hx-run.ts'), 'utf8')
const hxMrScript = readFileSync(resolve(SCRIPTS_DIR, 'hx-mr.ts'), 'utf8')
const hxGoScript = readFileSync(resolve(SCRIPTS_DIR, 'hx-go.ts'), 'utf8')

describe('feature contract', () => {
  it('locks the single-demand scope and the display boundary', () => {
    expect(featureContract).toContain('本 contract 仅描述单需求主路径')
    expect(featureContract).toContain('displayName` 仅用于展示与辅助查找')
    expect(featureContract).toContain('`displayName` 不用于：')
    expect(featureContract).toContain('路径模板')
    expect(featureContract).toContain('文件命名')
    expect(featureContract).toContain('progress 文件定位')
    expect(featureContract).toContain('自动续接主键')
    expect(featureContract).toContain('不允许把 `displayName` 当作主键写入路径')
  })

  it('locks reuse-before-generate and deterministic fallback rules', () => {
    expect(featureContract).toContain('先复用，后生成')
    expect(featureContract).toContain('首次写入后冻结')
    expect(featureContract).toContain('后续只读取，不重算')
    expect(featureContract).toContain('若来源中存在稳定 `sourceId`')
    expect(featureContract).toContain('则计算 `sourceFingerprint`')
    expect(featureContract).toContain('只有以上都无法命中时，才允许首次生成 `feature`')
    expect(featureContract).toContain('TS-46318 -> req-46318')
    expect(featureContract).toContain('REQ-1024 -> req-1024')
    expect(featureContract).toContain('没有标题')
    expect(featureContract).toContain('feat-<fingerprint8>')
    expect(featureContract).toContain('若首次生成的 `feature` 与当前项目已有需求文档冲突')
  })

  it('keeps feature ownership aligned with the shared contract', () => {
    expect(featureContract).not.toContain('## 命令职责边界')
    expect(ownershipContract).toContain('## Feature 写权')
    expect(ownershipContract).toContain('唯一允许首次生成 `feature` 的命令')
    expect(ownershipContract).toContain('不允许生成、改写或重算 `feature`')
    expect(ownershipContract).toContain('不允许在 MR 阶段生成或重算 `feature`')
    expect(ownershipContract).toContain('不拥有 `feature` 的首次生成写权')

    // hx-doc 是纯 AI 驱动命令，仍在 MD 中声明契约引用
    expect(hxDoc).toContain('src/contracts/feature-contract.md')
    expect(hxDoc).toContain('先复用已有 `feature`')
    expect(hxDoc).toContain('仅在无法复用时首次生成 `feature`')
    expect(hxDoc).toContain('displayName')
    expect(hxDoc).toContain('rules/requirement-template.md')
    expect(hxDoc).toContain('Feature')
    expect(hxDoc).toContain('Source Fingerprint')

    // 代码驱动命令：feature 不变性约束在 MD 约束节和 JS 脚本中体现
    expect(hxPlan).toContain('不允许重算')
    expect(hxPlanScript).toContain('parseFeatureHeaderFile')

    expect(hxMr).toContain('不允许在 MR 阶段生成或重算')
    expect(hxMrScript).toContain('parseFeatureHeaderFile')

    // hx-go 不处理 feature 写权；其 MD 简化后只描述流水线行为
    expect(hxGo).not.toContain('首次生成')
  })

  it('locks the requirement header metadata template', () => {
    expect(featureContract).toContain('## 文档头部固定模板')
    expect(featureContract).toContain('`Feature` 必须有值')
    expect(featureContract).toContain('可以为空')
    expect(featureContract).toContain('不允许删除整行')
    expect(featureContract).toContain('优先以这四行头部元信息作为事实来源')
  })

  it('locks the requirement header parsing rules', () => {
    expect(featureContract).toContain('## 文档头部解析规则')
    expect(featureContract).toContain('只识别以下四个字段标签')
    expect(featureContract).toContain('标签名大小写必须完全一致')
    expect(featureContract).toContain('四个字段必须按固定顺序出现')
    expect(featureContract).toContain('文档标题下方、正文 `##` 小节之前')
    expect(featureContract).toContain('字段值取冒号后的原始文本')
    expect(featureContract).toContain('执行首尾空白裁剪')
    expect(featureContract).toContain('不使用 `null`、`N/A`、`-` 等占位词')
    expect(featureContract).toContain('`Feature` 解析后若为空')
    expect(featureContract).toContain('重复字段、缺失字段、字段换序或未知头部字段')
    expect(featureContract).toContain('正文中的自然语言描述不能覆盖头部字段值')

    // 代码驱动命令：解析规则在 JS 脚本中固化
    expect(hxPlanScript).toContain('parseFeatureHeaderFile')
    expect(hxRunScript).toContain('resolveProgressFile')
    expect(hxMrScript).toContain('parseFeatureHeaderFile')
    // hx-go 不解析 feature 头部（调度各子命令，子命令各自解析）
    expect(hxGoScript).toContain('PIPELINE_STEPS')
  })
})
