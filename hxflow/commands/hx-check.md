# 核心检查入口

## 执行步骤

1. 执行 `bun scripts/tools/check.ts [<feature>] [--scope <scope>]`，读取检查范围、质量门结果和审查输入事实。
2. 根据脚本返回的 `scope` 和 `needsAiReview` 决定检查类型：`review` / `clean` 只报告问题；`qa` 只看 gate 结果。
3. gate 失败时停止并输出问题；通过后进入后续交付阶段。

## 约束

- 检查范围和质量门配置由 `scripts/lib/runtime-config.ts` 和 `.hx/config.yaml` 定义
- qa 只看 gate 命令的 exit code，不解释输出文本
- clean 只做扫描和报告，不修改任何文件
- review / clean 不直接执行修复，gate 失败时先修复再重试
