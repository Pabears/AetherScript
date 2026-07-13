#!/bin/bash
# scripts/setup-hooks.sh
# 安装 aesc git hooks，将 lock 和 git 流程联防
#
# 用法：
#   bash scripts/setup-hooks.sh
#
# 原理：
#   设置 core.hooksPath = .githooks，让 git 从项目内读取 hooks
#   这样 hooks 随代码一起提交、一起版本化

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
HOOKS_DIR="$REPO_ROOT/.githooks"

echo "🔧 安装 aesc git hooks..."

# 检查 .githooks 目录存在
if [ ! -d "$HOOKS_DIR" ]; then
    echo "❌ .githooks 目录不存在，请先确认仓库完整性"
    exit 1
fi

# 设置 git 使用项目内的 hooks 目录
git config core.hooksPath .githooks
echo "✅ git config core.hooksPath = .githooks"

# 确保 hooks 可执行
chmod +x "$HOOKS_DIR/pre-commit"
chmod +x "$HOOKS_DIR/post-merge"
chmod +x "$HOOKS_DIR/post-checkout"
echo "✅ hooks 权限设置完成"

# 检查 aesc.lock 是否被 git 追踪（应该追踪）
if git ls-files --error-unmatch "aesc.lock" &>/dev/null 2>&1; then
    echo "✅ aesc.lock 已纳入 git 追踪"
elif [ -f "$REPO_ROOT/aesc.lock" ]; then
    echo "⚠️  aesc.lock 存在但未被 git 追踪，建议运行："
    echo "   git add aesc.lock && git commit -m 'chore: 纳入 aesc.lock'"
else
    echo "ℹ️  aesc.lock 不存在（首次使用 lock 时会自动创建）"
fi

echo ""
echo "✅ aesc git hooks 安装完成！"
echo ""
echo "联防规则："
echo "  pre-commit   → 手改 impl 未 lock 时阻断提交"
echo "  post-merge   → git pull 后提醒检查 lock 状态"
echo "  post-checkout → 切分支后如有 impl 变化则提醒"
echo ""
echo "如需跳过 hook（例如提交 aesc-gen 新生成的 impl）："
echo "  git commit --no-verify"
