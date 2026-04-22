# 提交并发布 npm 包

参数: `$ARGUMENTS`（可选: `patch | minor | major`，默认 `patch`；`--dry-run` 仅预演；`--skip-tests` 跳过测试）

## 执行步骤

### 0. 解析参数

- bump 类型：`patch`（默认）/ `minor` / `major`
- `--dry-run`：全程只打印命令，不实际执行
- `--skip-tests`：跳过测试步骤

### 1. 提交未提交的改动

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

### 2. 前置检查

```bash
git rev-parse --git-dir
git status --porcelain
git branch --show-current
```

确认工作区干净、package.json 存在，记录当前版本号（`OLD_VERSION`）、当前分支、`origin` 远端地址和 `publishConfig.registry`。

### 3. 运行测试（除非 --skip-tests）

```bash
npm run hx:test
```

测试失败立即停止，输出失败详情。

### 4. Bump 版本号

```bash
npm version <bump-type> --no-git-tag-version
```

记新版本号为 `NEW_VERSION`。

### 5. 更新 CHANGELOG.md

收集自上一个 tag 以来的所有 commit：

```bash
git log v<OLD_VERSION>..HEAD --pretty=format:"%s" --no-merges
```

若不存在上一个 tag，则收集全部 commit：

```bash
git log --pretty=format:"%s" --no-merges
```

按 commit type 分组，在 `CHANGELOG.md` 头部插入以下格式的条目：

```markdown
## v<NEW_VERSION> — <YYYY-MM-DD>

### 新功能
- <feat commit 描述>

### 修复
- <fix commit 描述>

### 重构
- <refactor commit 描述>

### 其他
- <chore/docs/test/style commit 描述>
```

只保留有内容的分组，忽略 `chore: release v*` 类的版本提交。

```bash
git add CHANGELOG.md
```

### 6. Commit 版本变更与 Changelog

```bash
git add package.json CHANGELOG.md
git commit -m "chore: release v<NEW_VERSION>"
```

### 7. 打 Git Tag

```bash
git tag v<NEW_VERSION>
```

### 8. 推送到 GitHub

```bash
git push origin <branch>
git push origin v<NEW_VERSION>
```

推送失败时：
- 不再回滚本地 commit 和 tag
- 明确说明“本地已完成发布，但远端未同步”

### 9. 等待 GitHub Actions 发布

- 推送 `v<NEW_VERSION>` tag 后，GitHub Actions 会自动发布到 GitHub Packages
- 若 workflow 失败，保留本地 commit 和 tag，按 Actions 日志排查

### 10. 输出发布报告

```
── 发布完成 ─────────────────────────────
✓ 版本   <OLD_VERSION> → <NEW_VERSION>
✓ 包名   <name>
✓ 仓库   <publishConfig.registry>
✓ Tag    v<NEW_VERSION>
✓ 推送   origin/<branch>

在 GitHub Actions 中确认 `Publish package` workflow 成功
```

## --dry-run 模式

每个步骤前输出 `[dry-run]` 前缀，不执行任何写操作（git commit / npm version / git push / CHANGELOG 写入均跳过，但会打印将要写入的 changelog 内容）。

## 说明

- 不需要运行 `scan-docs.sh`
- `publishConfig.registry` 应指向 `https://npm.pkg.github.com`
- 发布由 GitHub Actions 执行，默认依赖 `GITHUB_TOKEN`
- `origin` 应指向 GitHub 仓库；当前项目使用 `https://github.com/hxflow/cli`
- CHANGELOG.md 不存在时自动创建
