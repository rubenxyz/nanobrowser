import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentNameEnum } from '../types';

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

const { agentModelStore } = await import('../agentModels');

describe('agentModelStore retired model name migration', () => {
  beforeEach(() => {
    store['agent-models'] = {
      agents: {
        planner: { provider: 'deepseek', modelName: 'deepseek-reasoner' },
        navigator: { provider: 'openai', modelName: 'gpt-5.5' },
      },
    };
  });

  it('replaces a retired DeepSeek model name with deepseek-flash', async () => {
    expect(await agentModelStore.getAgentModel(AgentNameEnum.Planner)).toEqual({
      provider: 'deepseek',
      modelName: 'deepseek-flash',
    });
  });

  it('keeps the saved reasoning effort and leaves other agents untouched', async () => {
    store['agent-models'] = {
      agents: {
        planner: { provider: 'deepseek', modelName: 'deepseek-chat', reasoningEffort: 'high' },
        navigator: { provider: 'openai', modelName: 'gpt-5.5', reasoningEffort: 'low' },
      },
    };
    const agents = await agentModelStore.getAllAgentModels();

    expect(agents.planner).toEqual({ provider: 'deepseek', modelName: 'deepseek-flash', reasoningEffort: 'high' });
    expect(agents.navigator).toEqual({ provider: 'openai', modelName: 'gpt-5.5', reasoningEffort: 'low' });
  });

  it('does not rewrite a DeepSeek-looking name on another provider', async () => {
    store['agent-models'] = { agents: { planner: { provider: 'my_gateway', modelName: 'deepseek-chat' } } };

    expect(await agentModelStore.getAgentModel(AgentNameEnum.Planner)).toEqual({
      provider: 'my_gateway',
      modelName: 'deepseek-chat',
    });
  });
});
