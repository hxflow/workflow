# Base Profile — 根基类

所有团队 Profile 的公共基类，定义跨团队共享的通用规则和模板。

## 继承关系

```
base                          ← 你在这里
├── backend                   ← extends base
├── frontend                  ← extends base
├── mobile                    ← extends base
│   ├── mobile:ios            ← extends mobile
│   ├── mobile:android        ← extends mobile
│   └── mobile:harmony        ← extends mobile
└── (用户自定义 Profile)       ← extends base 或任意子 Profile
```

## 包含文件

| 文件 | 用途 |
|------|------|
| `profile.yaml` | 通用配置：执行规则、commit 格式、通用审查项、通用 QA 要求 |
| `golden-rules.md` | 通用黄金原则 GP-BASE-001~009（所有团队生效） |
| `review-checklist.md` | 通用代码审查清单（Phase 05 基础检查项） |
| `requirement-template.md` | 通用需求文档模板 |
| `plan-template.md` | 通用执行计划模板 |

## 覆盖规则

子 Profile 中的同名字段会覆盖 base 中的定义：
- **对象字段**：deepMerge（递归合并，子级补充父级）
- **数组字段**：整体替换（子级完全覆盖父级）
- **标量字段**：直接覆盖

例如，backend 的 `gate_commands` 会完全替换 base 的空 `gate_commands`，
但 `review_focus.must` 数组会替换 base 的通用检查项列表。

## 何时直接使用 base

一般不直接使用 `--profile base`。base 的设计目的是被继承，而非直接使用。
如果你的项目不属于任何现有团队分类，可以创建自定义 Profile 并 `extends: base`。
