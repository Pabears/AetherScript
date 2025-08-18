import { describe, it, expect, beforeEach, spyOn, afterEach } from 'bun:test'
import { OllamaProvider } from './ollama-provider'

describe('OllamaProvider', () => {
  let provider: OllamaProvider
  let fetchSpy: any

  beforeEach(() => {
    provider = new OllamaProvider()
    fetchSpy = spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  describe('generate', () => {
    it('should send a valid request and return a response', async () => {
      fetchSpy.mockResolvedValue(new Response(JSON.stringify({ response: 'test response' })))

      const response = await provider.generate('prompt', 'model')

      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost:11434/api/generate',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ model: 'model', prompt: 'prompt', stream: false }),
        }),
      )
      expect(response).toBe('test response')
    })

    it('should throw on non-ok response', async () => {
      fetchSpy.mockResolvedValue(new Response('Error', { status: 500 }))
      await expect(provider.generate('prompt', 'model')).rejects.toThrow(/Ollama request failed/)
    })

    it('should handle timeout', async () => {
        fetchSpy.mockImplementation(() => {
            return new Promise((resolve, reject) => {
                setTimeout(() => reject(new DOMException('The user aborted a request.', 'AbortError')), 100);
            });
        });
        await expect(provider.generate('prompt', 'model', { timeout: 50 })).rejects.toThrow(/Ollama request timed out/);
    });
  })

  describe('validateConnection', () => {
    it('should resolve on successful connection', async () => {
      fetchSpy.mockResolvedValue(new Response())
      await expect(provider.validateConnection()).resolves.toBeUndefined()
    })

    it('should throw on failed connection', async () => {
      fetchSpy.mockResolvedValue(new Response('Error', { status: 500 }))
      await expect(provider.validateConnection()).rejects.toThrow(/Ollama connection failed/)
    })
  })

  describe('getAvailableModels', () => {
    it('should return a list of models', async () => {
      const mockModels = { models: [{ name: 'model1' }, { name: 'model2' }] }
      fetchSpy.mockResolvedValue(new Response(JSON.stringify(mockModels)))

      const models = await provider.getAvailableModels()
      expect(models).toEqual(['model1', 'model2'])
    })

    it('should return an empty array on fetch failure', async () => {
      fetchSpy.mockResolvedValue(new Response('Error', { status: 500 }))
      const models = await provider.getAvailableModels()
      expect(models).toEqual([])
    })
  })
})
