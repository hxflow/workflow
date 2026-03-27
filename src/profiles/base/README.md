# Base Profile — 根基类

所有团队 Profile 的公共基类，定义跨团队共享的通用规则和模板。当前框架的默认主路径是 `hx-doc -> hx-plan -> hx-run -> hx-qa -> hx-mr`，base profile 为这条链路提供最小规则集。

## 继承关系

```
base                          ← 你在这里
└── (用户自定义 Profile)       ← extends base 或 extends 其他共享 Profile
```

## 包含文件

| 文件 | 用途 |
|------|------|
| `profile.yaml` | 通用配置：执行规则、commit 格式、通用审查项、通用 QA 要求 |
| `golden-rules.md` | 通用黄金原则 GP-BASE-001~009（所有团队生效，也是共享规则源） |
| `review-checklist.md` | 通用代码审查清单（Phase 05 基础检查项） |
| `requirement-template.md` | 通用需求文档模板 |
| `plan-template.md` | 通用执行计划模板 |

## 覆盖规则

子 Profile 中的同名字段会覆盖 base 中的定义：
- **对象字段**：deepMerge（递归合并，子级补充父级）
- **数组字段**：整体替换（子级完全覆盖父级）
- **标量字段**：直接覆盖

例如，自定义 profile 的 `gate_commands` 会完全替换 base 的空 `gate_commands`，
但 `review_focus.must` 数组会替换 base 的通用检查项列表。

## 何时直接使用 base

`base` 是框架唯一内置 profile，可以直接使用。
如果项目需要自己的规则集，创建自定义 Profile 并 `extends: base`。
