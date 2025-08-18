import type { ModelProvider, ProviderOptions } from './base-provider'

interface CloudflareResponseData {
  result?: { response?: string; generated_text?: string };
  response?: string;
  generated_text?: string;
}

/**
 * Cloudflare Workers AI provider implementation
 * Supports Cloudflare's AI Gateway and Workers AI models
 */
export class CloudflareProvider implements ModelProvider {
  readonly name = 'cloudflare'

  async generate(
    prompt: string,
    model: string,
    options?: ProviderOptions,
  ): Promise<string> {
    if (!options?.endpoint) {
      throw new Error('Cloudflare provider requires an endpoint URL')
    }

    const timeout = options?.timeout || 600000 // 10 minutes default for LLM responses

    if (options?.verbose) {
      console.log('--- CLOUDFLARE PROMPT ---')
      console.log(prompt)
      console.log('-------------------------')
    }

    console.log(
      `  -> Sending prompt to Cloudflare Workers AI for model ${model}...`,
    )

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      // Build headers with authentication
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...options?.headers,
      }

      // Add Cloudflare-specific auth headers if provided
      if (options?.auth) {
        Object.entries(options.auth).forEach(([key, value]) => {
          headers[key] = value
        })
      }

      const response = await fetch(options.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt,
          // Explicitly disable streaming to get complete response
          stream: false,
          // Add any additional Cloudflare-specific parameters
          ...this.getCloudflareSpecificOptions(options),
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(
          `Cloudflare request failed with status ${response.status}: ${errorText}`,
        )
      }

      // Check if response is streaming (Server-Sent Events or chunked)
      const contentType = response.headers.get('content-type') || ''
      const isStreaming =
        contentType.includes('text/event-stream') ||
        contentType.includes('text/plain') ||
        response.headers.get('transfer-encoding') === 'chunked'

      let generatedText: string

      if (isStreaming) {
        // Handle streaming response
        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('Unable to read streaming response')
        }

        const decoder = new TextDecoder()
        let fullResponse = ''
        let done = false

        while (!done) {
          const { value, done: readerDone } = await reader.read()
          done = readerDone

          if (value) {
            const chunk = decoder.decode(value, { stream: true })
            fullResponse += chunk
          }
        }

        // For Server-Sent Events, extract the actual content
        if (contentType.includes('text/event-stream')) {
          // Parse SSE format: data: {"response": "content"}
          const lines = fullResponse.split('\n')
          let combinedResponse = ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6))
                if (data.response) {
                  combinedResponse += data.response
                } else if (data.generated_text) {
                  combinedResponse += data.generated_text
                }
              } catch (e) {
                // Skip invalid JSON lines
                continue
              }
            }
          }
          generatedText = combinedResponse
        } else {
          // For plain text streaming, try to parse as JSON or use as-is
          try {
            const parsed = JSON.parse(fullResponse)
            generatedText =
              parsed.result?.response ||
              parsed.result?.generated_text ||
              parsed.response ||
              parsed.generated_text ||
              fullResponse
          } catch {
            generatedText = fullResponse
          }
        }
      } else {
        // Handle regular JSON response
        const cloudflareResponse = (await response.json()) as CloudflareResponseData

        // Handle different response formats from Cloudflare
        generatedText =
          cloudflareResponse.result?.response ||
          cloudflareResponse.result?.generated_text ||
          cloudflareResponse.response ||
          cloudflareResponse.generated_text ||
          ''
      }

      if (!generatedText) {
        throw new Error('No generated text found in Cloudflare response')
      }

      if (options?.verbose) {
        console.log('--- CLOUDFLARE RESPONSE (RAW) ---')
        console.log(generatedText)
        console.log('--------------------------------')
      }

      return generatedText
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Cloudflare request timed out after ${timeout}ms`)
      }
      throw error
    }
  }

  async validateConnection(): Promise<void> {
    // For Cloudflare, we can't easily validate without making a real request
    // So we'll just check if the required configuration is present
    if (
      !process.env.CLOUDFLARE_ACCOUNT_ID &&
      !process.env.CLOUDFLARE_API_TOKEN
    ) {
      console.warn(
        'Cloudflare provider: No environment variables found. Make sure to provide endpoint and auth in options.',
      )
    }
  }

  private getCloudflareSpecificOptions(
    options?: ProviderOptions,
  ): Record<string, unknown> {
    const cloudflareOptions: Record<string, unknown> = {
      // Ensure we get complete responses
      stream: false,
      // Set reasonable max_tokens for code generation
      // Most Cloudflare models have 32K context limit, allow generous output
      max_tokens: 20480,
    }

    // Add Cloudflare-specific parameters if provided in options
    if (options?.max_tokens) {
      // Allow larger max_tokens for code generation, cap at 8192 to prevent context overflow
      cloudflareOptions.max_tokens = Math.min(options.max_tokens, 20480)
    }

    if (options?.temperature) {
      cloudflareOptions.temperature = options.temperature
    }

    if (options?.top_p) {
      cloudflareOptions.top_p = options.top_p
    }

    // Explicitly disable streaming at the options level too
    cloudflareOptions.stream = false

    return cloudflareOptions
  }

  async getAvailableModels(): Promise<string[]> {
    // Cloudflare Workers AI supported models (as of current knowledge)
    // This could be made dynamic by calling their API if they provide a models endpoint
    return [
      '@cf/meta/llama-2-7b-chat-int8',
      '@cf/meta/llama-2-7b-chat-fp16',
      '@cf/mistral/mistral-7b-instruct-v0.1',
      '@cf/qwen/qwen2.5-coder-32b-instruct',
      '@cf/deepseek-ai/deepseek-math-7b-instruct',
      '@cf/thebloke/codellama-7b-instruct-awq',
    ]
  }
}
