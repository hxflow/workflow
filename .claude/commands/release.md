# 提交并发布 npm 包

参数: `$ARGUMENTS`（可选: `patch | minor | major`，默认 `patch`；`--dry-run` 仅预演；`--skip-tests` 跳过测试）

## 执行步骤

### 0. 解析参数

- bump 类型：`patch`（默认）/ `minor` / `major`
- `--dry-run`：全程只打印命令，不实际执行
- `--skip-tests`：跳过测试步骤

### 1. 运行 scan-docs.sh

```bash
bash scan-docs.sh
```

### 2. 提交未提交的改动

```bash
git status --short
git diff --stat HEAD
```

若有改动：

根据变更内容自动判断 commit type：

| type | 适用场景 |
|------|---------|
| `feat` | 新增功能 |
| `fix` | 修复 bug |
| `docs` | 仅文档变更 |
| `test` | 新增或修改测试 |
| `refactor` | 重构，不新增功能也不修复 bug |
| `chore` | 构建、配置、依赖、工具变更 |
| `style` | 仅格式调整，不影响逻辑 |

生成提交信息（中文，25 字以内），暂存并提交：

```bash
git add -A
git commit -m "<type>: <描述>"
```

若无改动，跳过此步骤直接进入发布流程。

### 3. 前置检查

```bash
git rev-parse --git-dir
git status --porcelain
git branch --show-current
```

确认工作区干净、package.json 存在，记录当前版本号和 `publishConfig.registry`。

### 4. 运行测试（除非 --skip-tests）

```bash
npx vitest run
```

测试失败立即停止，输出失败详情。

### 5. Bump 版本号

```bash
npm version <bump-type> --no-git-tag-version
```

记新版本号为 `NEW_VERSION`。

### 6. Commit 版本变更

```bash
git add package.json
git commit -m "chore: release v<NEW_VERSION>"
```

### 7. 打 Git Tag

```bash
git tag v<NEW_VERSION>
```

### 8. 发布到 npm 仓库

```bash
npm publish
```

发布失败时：
- 回滚 tag：`git tag -d v<NEW_VERSION>`
- 回滚 commit：`git reset --soft HEAD~1`
- 报告错误原因，停止

### 9. 推送到 GitLab

```bash
git push
git push origin v<NEW_VERSION>
```

推送失败时报告错误，tag 和 commit 已在本地，提示用户手动 push。

### 10. 输出发布报告

```
── 发布完成 ─────────────────────────────
✓ 版本   <OLD_VERSION> → <NEW_VERSION>
✓ 包名   <name>
✓ 仓库   <publishConfig.registry 或 默认>
✓ Tag    v<NEW_VERSION>
✓ 推送   <remote>/<branch>

运行 npm install @<scope>/<name>@<NEW_VERSION> 验证安装
```

## --dry-run 模式

每个步骤前输出 `[dry-run]` 前缀，不执行任何写操作（git commit / npm version / npm publish / git push 均跳过）。

## 说明

- `.npmrc` 中须提前配置私有仓库认证 token，否则 `npm publish` 报 401
- `publishConfig.registry` 决定发布目标，本项目指向 `https://npm.cdfsunrise.com/`
- 本命令不修改 `CHANGELOG`
