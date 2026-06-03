---
name: hxflow-workflow-iteration
description: |
  基于真实使用案例迭代和加固 hxflow workflow 行为。
  当具体 hxflow 案例暴露 workflow 缺口、命令契约歧义、脚本/runtime 不一致、路由问题、写保护问题，或用户要求改进 hxflow workflow 本身而不是实现业务功能时使用。
---

# HXFlow Workflow 迭代

使用这个 skill，把一次真实的 hxflow 失败、误判或别扭交互，沉淀成稳定的 workflow 改进。

## 核心原则

从具体 case 出发，但不要把 case 本身写成规则。先抽象出通用契约，再用最小改动同步命令提示词、runtime 脚本、模板、manifest 和测试，让契约可执行、可验证。

## 工作流程

1. 事实复现 case。
   - 执行涉及的 `hx-*` 脚本或 `hx` 路由。
   - 记录关键输入、输出、生成路径和错误行为。
   - 判断问题属于命令契约、runtime 脚本、模板/config、hook/guard、package manifest 还是测试缺口。

2. 抽象通用契约。
   - 用一句话描述期望行为，不夹带一次性产品名、目录名或示例名。
   - 区分 source fact 和 AI inference；脚本无法确定的信息，应交给命令/AI 层推理或询问。
   - 明确定义失败行为：遇到歧义要 fail fast，不要静默选择。

3. 映射代码归属。
   - 确定性行为放在 `hxflow/scripts/**`、schema、template 或测试里。
   - AI 仍可能做错的语义边界放在 `hxflow/commands/hx-*.md` 或 `hxflow/SKILL.md`。
   - 不要在命令提示词里重复脚本已经固化的事实。

4. 最小面修改。
   - 保留用户已有 dirty changes，不顺手回滚。
   - 新增或修改命令时，同步检查 `SKILL.md`、command-contract tests、package manifest tests、templates 和 routing tests。
   - 命令/runtime 边界修复优先加 focused tests，再考虑更大的重构。

5. 同时验证真实 case 和通用契约。
   - 跑 touched files 对应的 targeted unit tests。
   - 重新跑最初失败的真实命令。
   - 如果改动影响命令语义、路由、guard 或共享 runtime library，再跑更广的 workflow tests。

## 常见契约模式

- **source-first docs**：找到 source file 时，`feature` 必须来自 source file basename；找不到唯一 source 时失败，除非显式使用当前上下文模式并已推理出 featureName。
- **干净上下文阶段**：E2E/test 阶段若主线程上下文过载，使用子 agent 或干净上下文 handoff。
- **提示词/脚本边界**：脚本返回事实并执行确定性规则；命令提示词只保留语义约束和下一步动作。
- **写保护上下文门控**：write guard 只在 hxflow 上下文显式或可安全推断时生效；普通非 hx 编辑不能被误拦。
- **真实验证**：前端行为需要浏览器证明；服务端行为在可行时需要真实 API 调用证明。

## 反模式

- 不要把产品专用目录、模块家族或 case 名硬编码成 workflow 规则。
- 不要在 source 缺失或存在歧义时，让脚本静默回退到猜测 feature。
- 不要只修生成产物，而忽略 workflow 契约本身的问题。
- 不要在真实重复形态尚未证明前添加大而泛的抽象。
- 不要用破坏性 git 清理来让测试通过。

## 验证清单

- 原始 case 已按预期运行。
- 通用行为至少有一个 focused test 覆盖。
- 现有 command-contract tests 仍通过。
- 最终说明讲清楚契约变化，而不是只描述一次性 case。
