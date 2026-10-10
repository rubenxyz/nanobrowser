import { beforeEach, describe, expect, it, vi } from 'vitest';

// base.ts reads globalThis.chrome when it is imported, so the mock must exist before the import
const store = vi.hoisted(() => {
  const data: Record<string, unknown> = {};
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: async (keys: string[]) => Object.fromEntries(keys.filter(k => k in data).map(k => [k, data[k]])),
        set: async (items: Record<string, unknown>) => Object.assign(data, items),
        onChanged: { addListener: () => undefined },
      },
    },
  });
  return data;
});

const { llmProviderStore } = await import('../llmProviders');

describe('llmProviderStore.getAllProviders', () => {
  beforeEach(() => {
    store['llm-api-keys'] = {
      providers: {
        openai: { apiKey: 'sk-openai', name: 'OpenAI', type: 'openai', modelNames: ['gpt-5.5'] },
        cerebras: { apiKey: 'csk-secret', name: 'Cerebras', type: 'cerebras', modelNames: ['llama-3.3-70b'] },
        llama: { apiKey: 'llm-secret', name: 'Llama', type: 'llama', modelNames: ['Llama-4-Maverick'] },
        groq: { apiKey: 'gsk-secret', name: 'Groq', type: 'groq', modelNames: ['llama-3.3-70b-versatile'] },
      },
    };
  });

  it('deletes the saved configs of removed providers', async () => {
    const providers = await llmProviderStore.getAllProviders();

    expect(Object.keys(providers)).toEqual(['openai']);
    const saved = store['llm-api-keys'] as { providers: Record<string, unknown> };
    expect(Object.keys(saved.providers)).toEqual(['openai']);
    expect(JSON.stringify(saved)).not.toContain('secret');
  });

  it('leaves storage untouched when no removed provider is saved', async () => {
    const saved = { providers: { openai: { apiKey: 'sk-openai', name: 'OpenAI', type: 'openai', modelNames: [] } } };
    store['llm-api-keys'] = saved;
    const providers = await llmProviderStore.getAllProviders();

    expect(Object.keys(providers)).toEqual(['openai']);
    expect(store['llm-api-keys']).toBe(saved);
  });
});

describe('llmProviderStore.getAllProviders retired DeepSeek model migration', () => {
  beforeEach(() => {
    store['llm-api-keys'] = {
      providers: {
        deepseek: {
          apiKey: 'sk-deepseek',
          name: 'DeepSeek',
          type: 'deepseek',
          modelNames: ['deepseek-chat', 'deepseek-reasoner', 'deepseek-v4-pro'],
        },
      },
    };
  });

  it('replaces retired DeepSeek model names with deepseek-flash and keeps current ones', async () => {
    const providers = await llmProviderStore.getAllProviders();

    expect(providers.deepseek.modelNames).toEqual(['deepseek-flash', 'deepseek-v4-pro']);
  });

  it('replaces the retired legacy v4 flash names and removes the duplicate', async () => {
    store['llm-api-keys'] = {
      providers: {
        deepseek: {
          apiKey: 'sk-deepseek',
          name: 'DeepSeek',
          type: 'deepseek',
          modelNames: ['deepseek-v4-flash', 'deepseek-v4-flash-vision-exp', 'deepseek-flash'],
        },
      },
    };
    const providers = await llmProviderStore.getAllProviders();

    expect(providers.deepseek.modelNames).toEqual(['deepseek-flash']);
  });

  it('does not rewrite model names of other providers', async () => {
    store['llm-api-keys'] = {
      providers: {
        my_gateway: { apiKey: 'sk-gateway', name: 'Gateway', type: 'custom_openai', modelNames: ['deepseek-chat'] },
      },
    };
    const providers = await llmProviderStore.getAllProviders();

    expect(providers.my_gateway.modelNames).toEqual(['deepseek-chat']);
  });
});
