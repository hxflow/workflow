# Harness Profiles — 团队自定义配置

每个团队目录下包含以下文件，流水线命令（/hx-go 等）会根据选择的 profile 加载对应配置。

## 文件结构

```
profiles/
├── backend/
│   ├── README.md               # 服务端规则总览
│   ├── profile.yaml          # 团队元信息 + 架构层级 + 任务拆分规则
│   ├── requirement-template.md # 需求文档模板（Phase 01）
│   ├── plan-template.md      # 执行计划模板（Phase 02）
│   ├── review-checklist.md   # 代码审查清单（Phase 05）
│   └── golden-rules.md       # 团队专属黄金原则（补充全局 golden-principles.md）
├── frontend/
│   ├── README.md
│   ├── profile.yaml
│   ├── requirement-template.md
│   ├── plan-template.md
│   ├── review-checklist.md
│   └── golden-rules.md
└── mobile/
    ├── README.md             # 移动端通用规则 + 平台说明
    ├── profile.yaml          # 移动端通用配置
    ├── requirement-template.md
    ├── plan-template.md
    ├── review-checklist.md
    ├── golden-rules.md
    └── platforms/            # 平台特化配置（覆盖通用配置中的差异项）
        ├── ios.yaml
        ├── android.yaml
        └── harmony.yaml
```

## Profile 加载优先级

1. 全局配置（AGENTS.md、golden-principles.md）— 始终加载
2. 团队 Profile（profiles/<team>/profile.yaml）— 按选择加载
3. 平台特化（profiles/mobile/platforms/<platform>.yaml）— 移动端额外加载

## 使用方式

```
/hx-go user-login --profile backend        # 后端团队
/hx-go user-login --profile frontend       # 前端团队
/hx-go user-login --profile mobile:ios     # 移动端 iOS
/hx-go user-login --profile mobile:android # 移动端 Android
/hx-go user-login --profile mobile:harmony # 移动端 HarmonyOS
```
