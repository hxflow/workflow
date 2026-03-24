# Phase 08 · 创建 Merge Request

参数: $ARGUMENTS（格式: `<feature-name> [--project <group/repo>] [--target <branch>]`）

示例:
- `/hx-mr user-login --project lehu/bffservice`
- `/hx-mr user-login --project lehu/bffservice --target develop`

## 执行步骤

### 0. 解析参数
- 从 $ARGUMENTS 提取 feature-name、--project（GitLab 项目路径）、--target（目标分支，默认 main）
- 如果未提供 --project，尝试从 `git remote get-url origin` 自动解析
- 如果仍无法确定，询问用户

### 1. 检查前置条件
- 确认当前分支不是 main/master/production
- 确认工作区干净（无未提交变更），否则提示先 commit
- 确认本地分支已 push 到远程，否则执行 `git push -u origin ${BRANCH}`

### 2. 生成 MR 描述
读取以下信息自动生成 MR 描述文件：
- `.harness/requirement/${FEAT}.md` — 提取来源任务 ID、背景、AC 列表
- `.harness/plans/${FEAT}-progress.json` — 提取任务完成状态
- `git log main..HEAD --oneline` — 提取本次变更的 commit 列表
- `git diff main --stat` — 提取文件变更统计

MR 描述格式：
```markdown
## 关联任务
DevOps: #${TASK_ID} — ${TASK_NAME}

## 变更摘要
- 新增 X 个文件，修改 Y 个文件
- [逐条列出主要变更]

## AC 完成情况
- [x] AC-001: xxx
- [x] AC-002: xxx
- [x] AC-003: xxx

## 门控状态
- lint ✓ | type ✓ | test ✓ | arch ✓

## 影响层级
${LAYER_LIST}
```

### 3. 创建 MR
使用 gitlab skill 创建：

```bash
.claude/skills/gitlab/scripts/gitlab mr create \
  -s ${BRANCH} \
  -t ${TARGET} \
  --title "${COMMIT_TYPE}: #${TASK_ID}@${TASK_NAME}" \
  -d @/tmp/mr-desc-${FEAT}.md \
  -p ${PROJECT}
```

### 4. 监控 CI
MR 创建成功后：
- 启动后台 CI 监控：`gitlab mr watch -p ${PROJECT} -i ${MR_IID} -B`
- 展示 MR 链接和监控状态

### 5. CI 结果处理
- **CI 通过**：通知用户，建议合并
- **CI 失败**：
  1. 查看失败详情：`gitlab mr checks -p ${PROJECT} -i ${MR_IID}`
  2. Agent 分析并自动修复
  3. git commit + push
  4. 继续监控（最多 3 轮）
  5. 3 轮仍失败 → 暂停请用户介入

### 6. 输出

```
── MR 创建完成 ──────────────────────────
特性: ${FEAT}
MR:   ${MR_URL}
分支: ${BRANCH} → ${TARGET}
标题: ${COMMIT_TYPE}: #${TASK_ID}@${TASK_NAME}
CI:   监控中...

查看日志: gitlab mr watch-log -p ${PROJECT} -i ${MR_IID}
停止监控: gitlab mr watch-stop -p ${PROJECT} -i ${MR_IID}
```
