## 待完成需求

1. ~~commands添加hook，pre & post~~ ✓ 已在各 /hx-* 命令中定义 hook 路径约定
2. ~~自定义编排全自动流程~~ ✓ /hx-go 实现全流水线，4 个检查点
3. ~~下一步命令提醒以及当前任务状态~~ ✓ /hx-done 输出下一步提示
4. 需要集成测试功能
5. 知识探索阶段

## AI-first 架构重构（已完成）

- CLI 精简为 5 个命令：setup / upgrade / uninstall / gate / doctor
- 删除所有"prompt 组装"JS 脚本（hx-agent-run、hx-agent-fix、hx-scan 等）
- 所有 /hx-* Claude 命令重写为直接 AI 指令（不依赖 CLI 中间层）
- /hx-init 改为 Claude 直接用工具分析项目并生成 profile

## 设计思想

### 三层架构
1. 系统层, 即框架安装的位置, 在用户目录中，相当于直接将项目clone到用户目录
2. 用户层, 用户需要自定义的配置，用来覆盖系统的配置，位置为~/.hx
3. 项目层, 项目中的自定义配置，用来覆盖用户的配置project/.hx

## 项目升级
项目升级就是直接更新本地的系统层

## 问题
如何将这种覆盖关系集成到claudecode中
