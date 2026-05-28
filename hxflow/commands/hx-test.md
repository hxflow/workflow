# 端到端集成测试入口

## 执行步骤

1. 执行 `hx-test <feature>`，读取 `test.context`。
2. 若 `test.needsSubagent` 为真，启动干净上下文的子 agent，并把 `test.context` 作为唯一任务上下文交给它。
3. 子 agent 必须根据目标类型做真实端到端验证：前端启动浏览器操作页面，服务端启动服务后真实调用接口并检查请求与返回。
4. 若发现错误，主 agent 按子 agent 给出的复现与日志修复，再重新执行 `hx test <feature>`。
5. 测试通过后继续 `hx mr <feature>`。

## 下一步

- `hx mr <feature>`

## 约束

- test 位于 review 之后，专注真实端到端集成测试，不用 lint、build、unit test 代替
- 子 agent 必须使用干净上下文，不复用主对话里的实现判断
- 前端功能必须真实打开浏览器验证，服务端功能必须真实发 HTTP 请求验证
- 失败必须先修复并复测，不允许带失败进入 MR
