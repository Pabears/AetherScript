#!/bin/bash

#
# 逐个运行 Bun 测试用例的脚本
#
# 这个脚本会遍历 `tests` 目录下的所有测试文件，并独立运行它们，
# 以避免因测试间状态泄漏导致的问题。
# 如果有任何测试失败，脚本将立即退出。
#

# 设置包含测试文件的目录
TEST_DIR="tests"

# 检查测试目录是否存在
if [ ! -d "$TEST_DIR" ]; then
  echo "错误：测试目录 '$TEST_DIR' 不存在。"
  exit 1
fi

echo "开始逐个运行测试用例..."
echo ""

# 查找所有测试文件（例如 *.test.js, *.test.ts, *.spec.js, *.spec.ts）并遍历它们。
# 使用 -print0 和 read -d '' 的方式可以正确处理包含空格或特殊字符的文件名。
find "$TEST_DIR" -type f \( -name "*.test.js" -o -name "*.test.ts" -o -name "*.spec.js" -o -name "*.spec.ts" \) -print0 | while IFS= read -r -d '' test_file; do
  echo "=================================================="
  echo "正在运行: $test_file"
  echo "=================================================="
  
  # 对单个文件执行 bun test
  bun test "$test_file"
  
  # 检查上一个命令的退出码
  # 如果不为 0，表示测试失败
  if [ $? -ne 0 ]; then
    echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
    echo "测试失败: $test_file"
    echo "脚本已停止。"
    echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
    exit 1 # 以失败状态退出脚本
  fi
  
  echo ""
done

echo "✅ 所有测试用例均已成功通过！"
exit 0
