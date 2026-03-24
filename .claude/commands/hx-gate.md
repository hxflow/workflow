# 质量门控

参数: $ARGUMENTS（可选: `--profile <team[:platform]>`）

## 执行步骤

### 0. 加载门控配置
- 如果指定了 --profile，读取对应 profile 的 `gate_commands` 配置：
  - 后端：`.harness/.harness/profiles/backend/profile.yaml` → `gate_commands`
  - 前端：`.harness/.harness/profiles/frontend/profile.yaml` → `gate_commands`
  - 移动端：`.harness/.harness/profiles/mobile/platforms/${PLATFORM}.yaml` → `gate_commands`
- 如果未指定 --profile，尝试从 progress.json 读取，仍无则询问用户
- **门控命令完全由 profile 定义，不硬编码**

### 门控命令映射（由各团队 profile 定义）

**后端（Go）**：
```bash
golangci-lint run ./...       # lint
go build ./...                # build
go test ./... -v -count=1     # test
go vet ./...                  # arch
```

**前端（TypeScript/React）**：
```bash
npm run hx:lint               # eslint --max-warnings 0
npm run hx:type               # tsc --noEmit
npm run hx:test               # vitest run
npm run hx:arch               # 架构合规检查
```

**移动端 iOS（Swift）**：
```bash
swiftlint lint --strict
xcodebuild build -scheme {scheme} -destination 'platform=iOS Simulator'
xcodebuild test -scheme {scheme} -destination 'platform=iOS Simulator'
```

**移动端 Android（Kotlin）**：
```bash
cd android && ./gradlew lintDebug
cd android && ./gradlew assembleDebug
cd android && ./gradlew testDebugUnitTest
```

**移动端 HarmonyOS（ArkTS）**：
```bash
cd harmony && hvigorw lintHarDebug
cd harmony && hvigorw assembleHap --mode module -p module=entry
cd harmony && hvigorw test
```

### 执行流程

从 profile 的 `gate_commands` 中按 key 顺序执行（lint → build/type → test → arch），任一失败即停止并报告：

1. **Step 1: Lint** — 代码规范检查（零容忍模式）
2. **Step 2: Build / Type** — 编译/类型检查通过
3. **Step 3: Test** — 单元测试（verbose 输出）
4. **Step 4: Arch** — 架构合规（如 profile 中有定义）

## 输出格式

```
── 质量门控 ──────────────────────────
团队: ${TEAM_LABEL}
工具链: ${TOOLCHAIN}

✓ Step 1/4  Lint          通过
✓ Step 2/4  Build         通过
✓ Step 3/4  Test          通过（XX 个测试）
✓ Step 4/4  Arch          通过

全部通过，可以提交。
```

## 注意
- 门控命令完全从 profile 的 `gate_commands` 字段读取，不同团队使用不同工具链
- 如果门控命令不存在（依赖未安装），提示安装后重试
- 移动端门控命令在对应平台项目目录下执行
- 如果 profile 中某个 gate 步骤未定义（如无 arch），跳过该步骤并标记为 ⚠ 跳过
