import { describe, it, expect, beforeEach, spyOn, afterEach } from 'bun:test';
import { CloudflareProvider } from './cloudflare-provider';

describe('CloudflareProvider', () => {
  let provider: CloudflareProvider;
  const spies: { mockRestore: () => void }[] = [];
  let fetchSpy: any; // Use a dedicated variable for the fetch spy

  beforeEach(() => {
    provider = new CloudflareProvider();
    fetchSpy = spyOn(globalThis, 'fetch');
    spies.push(fetchSpy); // Add to array for cleanup
  });

  afterEach(() => {
    spies.forEach(s => s.mockRestore());
    spies.length = 0;
  });

  describe('generate', () => {
    it('should throw if no endpoint is provided', async () => {
      await expect(provider.generate('prompt', 'model')).rejects.toThrow('Cloudflare provider requires an endpoint URL');
    });

    it('should send a valid request and handle a simple JSON response', async () => {
      const responseData = { result: { response: 'test response' } };
      fetchSpy.mockResolvedValue(new Response(JSON.stringify(responseData)));

      const response = await provider.generate('prompt', 'model', { endpoint: 'test-endpoint' });

      expect(fetchSpy).toHaveBeenCalledWith('test-endpoint', expect.any(Object));
      expect(response).toBe('test response');
    });

    it('should handle streaming text/event-stream response', async () => {
        const streamResponse = `data: {"response": "hello "}\n\ndata: {"response": "world"}\n\n`;
        const mockResponse = new Response(streamResponse, {
            headers: { 'Content-Type': 'text/event-stream' }
        });
        fetchSpy.mockResolvedValue(mockResponse);

        const result = await provider.generate('prompt', 'model', { endpoint: 'test-endpoint' });
        expect(result).toBe('hello world');
    });

    it('should throw on non-ok response', async () => {
      fetchSpy.mockResolvedValue(new Response('Error', { status: 500 }));
      await expect(provider.generate('prompt', 'model', { endpoint: 'test-endpoint' })).rejects.toThrow(/Cloudflare request failed/);
    });
  });

  describe('validateConnection', () => {
    it('should warn if env vars are not set', () => {
      const consoleWarnSpy = spyOn(console, 'warn');
      spies.push(consoleWarnSpy); // Track the spy
      provider.validateConnection();
      expect(consoleWarnSpy).toHaveBeenCalled();
    });
  });

  describe('getAvailableModels', () => {
    it('should return a list of models', async () => {
      const models = await provider.getAvailableModels();
      expect(models.length).toBeGreaterThan(0);
      expect(models).toContain('@cf/meta/llama-2-7b-chat-int8');
    });
  });
});
