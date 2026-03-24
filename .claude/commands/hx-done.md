# 标记任务完成

参数: $ARGUMENTS（task-id，如 `TASK-BE-03` 或 `TASK-IOS-01`）

## 执行步骤

1. 校验参数格式：必须匹配 `TASK-(FE|BE|MB|IOS|AND|HM)-\d{2}`，否则提示用法
2. 在 `.harness/plans/*-progress.json` 中搜索该 task-id
3. 如果未找到，报错并列出所有可用的 TASK-ID
4. 如果已是 `done` 状态，提示已完成并跳过
5. 将该 TASK 的 status 改为 `done`，写入 `completedAt` 为当前时间
6. 保存 JSON 文件
7. 检查同一 feature 下是否所有 TASK 都已完成
   - 如果全部完成：提示用户该特性已就绪，建议从 AGENTS.md 活跃特性中移除
   - 如果未全部完成：输出剩余 TASK 列表和进度

## 输出格式

```
── 标记任务完成 ──────────────────────
✓ TASK-BE-03 已标记为 done（2024-03-15T10:30:00Z）
  特性: user-login
  团队: 服务端
  进度: 3/5 完成

剩余任务:
  ☐ TASK-BE-04 — Controller 层（pending）
  ☐ TASK-BE-05 — 单元测试（pending）

下一步: /hx-run user-login TASK-BE-04 --profile backend
```

或全部完成时：

```
✓ TASK-BE-05 已标记为 done
  特性: user-login
  进度: 5/5 完成 🎉

所有任务已完成！建议:
  1. 从 AGENTS.md「当前活跃特性」中移除该特性
  2. 运行 /hx-entropy --profile backend 检查代码质量
```
