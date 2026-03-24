# 黄金原则（Golden Principles）

> 每条原则对应一个 Lint 规则或结构测试。
> 发现新的重复问题时，在此处新增条目并同步更新 Lint 配置。
> 最后更新：（填入日期）

---

## 日志规范

**GP-001** · 禁止 `console.log/warn/error/debug` 进入 `src/`
```
// ✗ 禁止
console.log('用户登录', userId)

// ✓ 正确
logger.info({ userId, action: 'login' })
```

**GP-002** · Service 层操作日志必须包含固定字段
```
// 必须字段：userId, action, durationMs
// 示例：
logger.info({ userId, action: 'login', durationMs: Date.now() - start, ip })
```

---

## 错误处理

**GP-003** · 业务错误使用 `AppError`，禁止裸 `throw new Error`
```
// ✗ 禁止
throw new Error('用户不存在')

// ✓ 正确
throw new AppError('USER_NOT_FOUND', '用户不存在', 404)
```

**GP-004** · Controller 层统一 try-catch，Service 层禁止包裹正常业务流程
```
// ✗ 禁止（在 Service 层过度防御）
async function login(payload) {
  try {
    const user = await userRepo.findByEmail(payload.email)
    // ...
  } catch (e) {
    throw new AppError('LOGIN_FAILED', e.message)  // 不必要的包装
  }
}

// ✓ 正确：Service 层直接抛出 AppError，Controller 统一捕获
```

---

## 前端规范

**GP-005** · 禁止在组件文件中直接调用 `fetch/axios`，必须通过 Hook
```
// ✗ 禁止（在组件中直接调用 API）
function LoginForm() {
  const handleSubmit = async () => {
    const res = await fetch('/api/auth/login', { ... })
  }
}

// ✓ 正确（通过 Hook 封装）
function LoginForm() {
  const { login, loading } = useLogin()
  const handleSubmit = () => login(formData)
}
```

**GP-006** · 单个组件文件不超过 200 行，超出须拆分为子组件
```
// 拆分原则：
// - 可独立复用的 UI 片段 → 独立组件文件
// - 纯展示部分 → Presentational 组件
// - 状态和副作用 → 提取到 Hook
```

---

## 命名规范

**GP-007** · Schema/Type 文件 PascalCase，Hook 文件 use 前缀 camelCase
```
// Types 层文件名
src/types/AuthPayload.ts    ✓
src/types/authPayload.ts    ✗

// Hook 文件名
src/hooks/useLogin.ts       ✓
src/hooks/login.ts          ✗
```

**GP-008** · 布尔值变量以 is/has/can/should 开头
```
// ✗ 禁止
const loading = true
const admin = false

// ✓ 正确
const isLoading = true
const isAdmin = false
```

---

## 类型安全

**GP-009** · 禁止 `: any` 类型，使用 `unknown` 或具体类型
```
// ✗ 禁止
function process(data: any) { ... }

// ✓ 正确
function process(data: unknown) {
  if (typeof data === 'string') { ... }
}
```

**GP-010** · 跨层边界的数据必须显式类型验证，不允许假设类型
```
// ✗ 禁止（假设外部数据类型）
const body = req.body as LoginPayload

// ✓ 正确（显式校验后再使用）
const result = LoginPayloadSchema.safeParse(req.body)
if (!result.success) throw new AppError('VALIDATION_ERROR', ...)
const body = result.data
```

---

## 配置规范

**GP-011** · 禁止魔法数字，所有配置值提取到 `src/config/`
```
// ✗ 禁止
if (failCount >= 5) lock(15 * 60 * 1000)

// ✓ 正确
import { AUTH_CONFIG } from '@/config/auth'
if (failCount >= AUTH_CONFIG.MAX_LOGIN_ATTEMPTS) {
  lock(AUTH_CONFIG.LOCKOUT_DURATION_MS)
}
```

---

## 测试规范

**GP-012** · Service 层每个公共函数必须有对应单元测试
```
// 测试文件命名：[功能].test.ts
// 位置：与源文件同目录，或 src/__tests__/ 下
// 每个函数至少覆盖：正向路径 + 主要错误路径
```

---

_新增原则时，同步在 PR 描述中说明对应的 Lint 规则编号或新增方案。_
