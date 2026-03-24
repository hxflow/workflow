# 服务端专属黄金原则

> 补充全局 golden-principles.md，以下规则仅适用于服务端代码。

**GP-BE-001** · Repo 层禁止包含业务判断逻辑（if/else 业务分支），只做数据存取

**GP-BE-002** · Service 层公共方法必须有对应单元测试，Mock Repo 层，不 Mock Service 本身

**GP-BE-003** · Controller 统一 try-catch + AppError → HTTP 状态码映射，Service 不做防御性 catch

**GP-BE-004** · 所有配置值提取到 src/config/，禁止 Service/Repo 中出现魔法数字

**GP-BE-005** · 数据库 migration 文件命名 `YYYYMMDD_HHMMSS_{description}.ts`，禁止修改已发布的 migration
