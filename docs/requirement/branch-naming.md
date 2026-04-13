# 分支命名规范校验

> Feature: BRANCH-NAMING
> Display Name: 分支命名规范校验
> Source ID: HX-001
> Source Fingerprint: branch-naming-v1

## 背景

当前 `hx check` 只校验 qa gates、review、clean，不检查 git 分支名是否符合团队规范。开发者在发起 MR 前才发现分支名错误，需要重命名，增加额外成本。

## 目标

在 `hx check` 的 `qa` 阶段新增分支名校验，不阻断流水线，以 warning 形式输出。

## 需求

### 校验规则

分支名必须匹配模式：`<type>/<scope>`

- 合法 type：`feat`、`fix`、`bugfix`、`refactor`、`chore`、`docs`、`test`、`hotfix`
- `scope` 不能为空，只允许字母、数字、连字符 `-`、下划线 `_`
- 默认保护分支（`main`、`master`、`develop`）不校验，直接通过

### 输出行为

- 合规：`qa.branchCheck` 字段 `ok: true`
- 不合规：`ok: false`，附建议修正名（把原分支名 kebab-case 化并加上 `feat/` 前缀作为示例）
- 校验失败不影响 `qa.ok` 的整体结果（warning，非 error）

### 接口变更

`qa` 输出新增字段：

```json
"branchCheck": {
  "ok": true,
  "branch": "feat/my-feature",
  "reason": null
}
```

## 验收标准

1. `hx check` 在合规分支上 `branchCheck.ok === true`
2. `hx check` 在不合规分支上 `branchCheck.ok === false`，`reason` 非空
3. `branchCheck.ok === false` 时 `qa.ok` 仍为 `true`（不阻断）
4. `main` / `master` / `develop` 上 `branchCheck.ok === true`
5. 已有单测全部通过
