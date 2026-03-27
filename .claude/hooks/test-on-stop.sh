#!/usr/bin/env bash
# .claude/hooks/test-on-stop.sh
# Stop hook: 会话结束后，若有文件改动则在 tmux pane 中跑测试；失败时启动子 Agent 修复。

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HASH="$(echo "$PROJECT_ROOT" | md5sum | cut -c1-8)"
PANE_ID_FILE="/tmp/hx-test-pane-$HASH"
RESULT_FILE="/tmp/hx-test-result-$HASH"
OUTPUT_FILE="/tmp/hx-test-output-$HASH"
COOLDOWN_FILE="/tmp/hx-test-cooldown-$HASH"

# ── 0. 冷却期检查（30s 内不重复触发）────────────────────────────
if [ -f "$COOLDOWN_FILE" ]; then
  LAST_RUN="$(cat "$COOLDOWN_FILE")"
  NOW="$(date +%s)"
  if [ $((NOW - LAST_RUN)) -lt 30 ]; then
    exit 0
  fi
fi
date +%s > "$COOLDOWN_FILE"

# ── 1. 检查 src/ 下是否有文件改动 ────────────────────────────────
cd "$PROJECT_ROOT"
SRC_CHANGED=$(git diff --name-only HEAD -- src/ 2>/dev/null)
SRC_STAGED=$(git diff --cached --name-only -- src/ 2>/dev/null)
if [ -z "$SRC_CHANGED" ] && [ -z "$SRC_STAGED" ]; then
  exit 0
fi

# ── 2. 确认当前在 tmux 中 ────────────────────────────────────────
if [ -z "${TMUX:-}" ]; then
  echo "[hx-hook] 未检测到 tmux 环境，跳过自动测试" >&2
  exit 0
fi

# ── 3. 复用或新建 tmux pane（确保不使用 Claude Code 所在的 pane）──
# $TMUX_PANE 是 tmux 注入的当前 pane ID，即 Claude Code 运行的 pane
CLAUDE_PANE="${TMUX_PANE:-}"
PANE_ID=""

if [ -f "$PANE_ID_FILE" ]; then
  STORED_PANE="$(cat "$PANE_ID_FILE")"
  # 验证 pane 存在且不是 Claude Code 的 pane
  if [ "$STORED_PANE" != "$CLAUDE_PANE" ] && \
     tmux list-panes -F "#{pane_id}" -a 2>/dev/null | grep -qx "$STORED_PANE"; then
    PANE_ID="$STORED_PANE"
  else
    # 存储的 pane 无效或与 Claude pane 重合，清除记录
    rm -f "$PANE_ID_FILE"
  fi
fi

if [ -z "$PANE_ID" ]; then
  # 新建 pane，并验证它不是 Claude Code 的 pane
  PANE_ID="$(tmux split-window -v -P -F "#{pane_id}" -c "$PROJECT_ROOT")"
  if [ "$PANE_ID" = "$CLAUDE_PANE" ]; then
    echo "[hx-hook] 无法创建独立测试 pane，跳过自动测试" >&2
    exit 0
  fi
  echo "$PANE_ID" > "$PANE_ID_FILE"
fi

# ── 4. 清理旧的 result 文件 ──────────────────────────────────────
rm -f "$RESULT_FILE" "$OUTPUT_FILE"

# ── 5. 在 pane 中执行测试，完成后写入 result 文件 ────────────────
TEST_CMD="cd '$PROJECT_ROOT' && echo '[hx-hook] 检测到 src/ 变更，运行单元测试 + 集成测试…' && { npm run hx:test:unit --silent && npm run hx:test:integration --silent; } 2>&1 | tee '$OUTPUT_FILE'; echo \$? > '$RESULT_FILE'"
tmux send-keys -t "$PANE_ID" "$TEST_CMD" Enter

# ── 6. 等待测试完成（最多 3 分钟）───────────────────────────────
WAIT=0
while [ ! -f "$RESULT_FILE" ] && [ $WAIT -lt 180 ]; do
  sleep 2
  WAIT=$((WAIT + 2))
done

if [ ! -f "$RESULT_FILE" ]; then
  echo "[hx-hook] 测试超时（180s），跳过子 Agent" >&2
  exit 0
fi

EXIT_CODE="$(cat "$RESULT_FILE")"

if [ "$EXIT_CODE" = "0" ]; then
  tmux send-keys -t "$PANE_ID" "echo '[hx-hook] ✓ 所有测试通过'" Enter
  exit 0
fi

# ── 7. 测试失败：启动 Claude 子 Agent 自动修复 ───────────────────
FAILURE_OUTPUT="$(cat "$OUTPUT_FILE" 2>/dev/null | tail -200)"

FIX_PROMPT="测试运行失败，请分析错误原因并直接修复 src/ 下的代码，不要修改测试文件本身。修复后重新运行测试确认通过。

失败输出：
\`\`\`
$FAILURE_OUTPUT
\`\`\`"

FIX_CMD="cd '$PROJECT_ROOT' && claude --dangerously-skip-permissions -p $(printf '%q' "$FIX_PROMPT")"
tmux send-keys -t "$PANE_ID" "$FIX_CMD" Enter
