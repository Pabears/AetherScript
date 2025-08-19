import type { ModelProvider, ProviderOptions } from './base-provider'

export class CloudflareProvider implements ModelProvider {
  readonly name = 'cloudflare'
  private defaultEndpoint = ''

  async generate(
    prompt: string,
    model: string,
    options?: ProviderOptions,
  ): Promise<string> {
    const endpoint =
      options?.endpoint || process.env.CLOUDFLARE_API_URL
    const accountId = options?.auth?.accountId || process.env.CLOUDFLARE_ACCOUNT_ID
    const apiToken = options?.auth?.apiToken || process.env.CLOUDFLARE_API_TOKEN

    if (!endpoint || !accountId || !apiToken) {
      throw new Error(
        'Cloudflare provider requires endpoint, accountId, and apiToken.',
      )
    }

    const fullUrl = `${endpoint}/${accountId}/ai/run/${model}`

    const headers = {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    }

    if (options?.verbose) {
      console.log(
        `  -> Sending prompt to Cloudflare Workers AI for model ${model}...`,
      )
    }

    const response = await fetch(fullUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ prompt }),
      signal: AbortSignal.timeout(options?.timeout || 30000),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `Cloudflare API request failed with status ${response.status}: ${errorText}`,
      )
    }

    // Handle different response types (simple JSON vs. streaming)
    const contentType = response.headers.get('content-type')
    if (contentType?.includes('application/json')) {
      const jsonResponse = (await response.json()) as any
      return jsonResponse.result.response
    } else if (contentType?.includes('text/event-stream')) {
      let fullResponse = ''
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('Failed to read streaming response from Cloudflare')
      }
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6)
            try {
              const parsed = JSON.parse(data)
              if (parsed.response) {
                fullResponse += parsed.response
              }
            } catch (e) {
              // Ignore non-JSON data lines
            }
          }
        }
      }
      return fullResponse
    } else {
      return await response.text()
    }
  }

  async validateConnection(options?: ProviderOptions): Promise<void> {
    const accountId = options?.auth?.accountId || process.env.CLOUDFLARE_ACCOUNT_ID
    const apiToken = options?.auth?.apiToken || process.env.CLOUDFLARE_API_TOKEN

    if (!accountId || !apiToken) {
      console.warn(
        'Cloudflare provider: No environment variables found. Make sure to provide endpoint and auth in options.',
      )
    }
  }

  async getAvailableModels(options?: ProviderOptions): Promise<string[]> {
    // This is a simplified list. A real implementation might fetch this from an API.
    return [
      '@cf/meta/llama-2-7b-chat-fp16',
      '@cf/meta/llama-2-7b-chat-int8',
      '@cf/mistral/mistral-7b-instruct-v0.1',
      '@hf/thebloke/codellama-7b-instruct-awq',
    ]
  }
}
