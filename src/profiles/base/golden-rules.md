# 通用黄金原则（Base Golden Rules）

> 所有团队共享的基础规则，团队专属规则在各自的 `golden-rules.md` 中补充。
> 本文件是框架唯一的通用规则源，Lint、Review 和执行约束都应以这里为准。

---

## 日志

**GP-BASE-001** · 禁止 `console.log/warn/error/debug` 等调试日志进入源码目录，统一使用结构化日志

```js
// ✗ 禁止
console.log('用户登录', userId)

// ✓ 正确
logger.info({ userId, action: 'login' })
```

**GP-BASE-002** · 关键操作日志必须包含可追溯字段（用户标识、操作类型、耗时）

```js
logger.info({
  userId,
  action: 'login',
  durationMs: Date.now() - start,
  ip,
})
```

## 错误处理

**GP-BASE-003** · 使用统一错误类型，禁止裸抛原生异常

```js
// ✗ 禁止
throw new Error('用户不存在')

// ✓ 正确
throw new AppError('USER_NOT_FOUND', '用户不存在', 404)
```

**GP-BASE-004** · 入口层统一捕获，业务层只抛不捕，避免过度防御性包装

```js
// ✗ 禁止
async function login(payload) {
  try {
    const user = await userRepo.findByEmail(payload.email)
    return buildSession(user)
  } catch (error) {
    throw new AppError('LOGIN_FAILED', error.message)
  }
}

// ✓ 正确
async function login(payload) {
  const user = await userRepo.findByEmail(payload.email)
  return buildSession(user)
}
```

## 类型安全

**GP-BASE-005** · 禁止不安全的类型断言（`any` / 无检查的强制转换）

```ts
// ✗ 禁止
const payload = response as any

// ✓ 正确
const payload = parseLoginResponse(response)
```

**GP-BASE-006** · 跨层边界数据必须显式校验，不允许假设外部输入类型正确

```ts
const payload = loginSchema.parse(request.body)
```

## 配置

**GP-BASE-007** · 禁止魔法数字和硬编码字符串，配置值集中管理

```ts
// ✗ 禁止
setTimeout(refreshToken, 15_000)

// ✓ 正确
setTimeout(refreshToken, config.auth.refreshIntervalMs)
```

## 命名

**GP-BASE-008** · 布尔值以 `is` / `has` / `can` / `should` 开头，语义必须可直接判断

```ts
const isEnabled = featureFlags.checkout
const hasPermission = permissions.includes('order:write')
```

## 测试

**GP-BASE-009** · 核心业务层的公共方法必须有对应单元测试，并覆盖主要错误路径

---

_团队专属规则（GP-BE-*、GP-FE-*、GP-MB-*）在各团队 Profile 的 `golden-rules.md` 中定义，继承并补充以上规则。_
