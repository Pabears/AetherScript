# AetherScript Provider System

AetherScript现在支持多个AI模型提供商，通过抽象层统一接口，让你可以轻松切换不同的AI服务。

## 支持的提供商

### 1. Ollama (本地/远程)
- **类型**: `ollama`
- **默认端点**: `http://localhost:11434/api/generate`
- **支持模型**: codellama, qwen2.5-coder:32b, 等

### 2. Cloudflare Workers AI
- **类型**: `cloudflare`
- **支持模型**: @cf/qwen/qwen2.5-coder-32b-instruct, @cf/meta/llama-2-7b-chat-fp16, 等

## 使用方法

### 基本用法 (默认Ollama)
```bash
# 使用默认的本地Ollama
bunx aesc gen -vf

# 指定模型
bunx aesc gen -vf -m qwen2.5-coder:32b
```

### 使用Cloudflare Workers AI
```bash
# 方法1: 通过环境变量配置
export CLOUDFLARE_ACCOUNT_ID="your-account-id"
export CLOUDFLARE_API_TOKEN="your-api-token"
export CLOUDFLARE_AIG_TOKEN="your-aig-token"  # 可选

bunx aesc gen -vf -p cloudflare -m "@cf/qwen/qwen2.5-coder-32b-instruct"

# 方法2: 通过代码配置 (见下方编程式配置)
```

### 使用远程Ollama
```bash
# 通过环境变量
export OLLAMA_ENDPOINT="http://your-remote-server:11434/api/generate"
bunx aesc gen -vf

# 或者通过编程式配置 (见下方)
```

## 环境变量配置

### Ollama
```bash
# 自定义Ollama端点
export OLLAMA_ENDPOINT="http://remote-server:11434/api/generate"
```

### Cloudflare Workers AI
```bash
# 必需
export CLOUDFLARE_ACCOUNT_ID="5ab0034e7d9b577e74426e7442dcdd64"
export CLOUDFLARE_API_TOKEN="B8cY533ASFAYsaD-B8f7O0JKVhDhSl2HzxhcaSgB"

# 可选 (用于AI Gateway)
export CLOUDFLARE_AIG_TOKEN="UcCmUskuRBlS3aypNQaOhLqdbC1iLe8NpeuUt8FT"
```

## 编程式配置

你也可以在代码中动态配置提供商：

```typescript
import { configureProvider, setDefaultProvider } from 'aesc';

// 配置Cloudflare提供商
configureProvider('my-cloudflare', 'cloudflare', {
    endpoint: 'https://gateway.ai.cloudflare.com/v1/5ab0034e7d9b577e74426e7442dcdd64/hello/workers-ai/@cf/qwen/qwen2.5-coder-32b-instruct',
    auth: {
        'cf-aig-authorization': 'Bearer UcCmUskuRBlS3aypNQaOhLqdbC1iLe8NpeuUt8FT',
        'Authorization': 'Bearer B8cY533ASFAYsaD-B8f7O0JKVhDhSl2HzxhcaSgB'
    }
}, '@cf/qwen/qwen2.5-coder-32b-instruct');

// 配置远程Ollama
configureProvider('remote-ollama', 'ollama', {
    endpoint: 'http://remote-server:11434/api/generate'
}, 'qwen2.5-coder:32b');

// 设置默认提供商
setDefaultProvider('my-cloudflare');
```

## 命令行参数

- `-p, --provider <name>`: 指定要使用的提供商
- `-m, --model <model>`: 指定要使用的模型
- `-v, --verbose`: 启用详细日志输出
- `-f, --force`: 强制覆盖现有文件

## 示例

### 使用Cloudflare Workers AI生成代码
```bash
# 设置环境变量
export CLOUDFLARE_ACCOUNT_ID="your-account-id"
export CLOUDFLARE_API_TOKEN="your-api-token"

# 生成代码
bunx aesc gen -vf -p cloudflare -m "@cf/qwen/qwen2.5-coder-32b-instruct"
```

### 使用远程Ollama
```bash
# 设置远程端点
export OLLAMA_ENDPOINT="http://192.168.1.100:11434/api/generate"

# 生成代码
bunx aesc gen -vf -m qwen2.5-coder:32b
```

## 故障排除

### 连接问题
- 确保网络连接正常
- 检查端点URL是否正确
- 验证认证信息是否有效

### 模型不可用
- 检查模型名称是否正确
- 确认提供商支持该模型
- 对于Ollama，确保模型已下载 (`ollama pull model-name`)

### 认证错误
- 检查API密钥是否正确
- 确认账户权限
- 验证环境变量是否正确设置
