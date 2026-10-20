import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  forgetXmrStaleFirstAccount,
  getXmrChainTip,
  getXmrLastKnownChainTip,
  getXmrLocalRuntime,
  getXmrNodeHealth,
  getXmrRuntime,
  isXmrRuntimeBusy,
  readXmrStaleFirst,
  resetXmrRuntimeSession,
  resetXmrStaleFirstCache,
} from './runtime';

import type Vault from './Vault';

const raw = {
  openWallet: jest.fn(async () => '{}'),
  setNodeUrl: jest.fn(async () => undefined),
  chainTip: jest.fn(async () => JSON.stringify({ height: 1 })),
  balance: jest.fn(async () => '{}'),
  syncStep: jest.fn(async () => '{}'),
};

jest.mock('@onekeyhq/core/src/chains/xmr/sdkXmrRuntime', () => ({
  hasXmrRuntimeApiLoader: () => true,
  getXmrRuntimeApi: async () => raw,
  readXmrRuntimeError: jest.requireActual(
    '@onekeyhq/core/src/chains/xmr/sdkXmrRuntime',
  ).readXmrRuntimeError,
}));
jest.mock('@onekeyhq/core/src/chains/xmr/sdkXmrRuntime/sdk/install', () => ({
  installXmrCarrier: () => undefined,
}));

let mockSavedTip: number | undefined;
const vault = {
  networkId: 'xmr--0',
  backgroundApi: {
    simpleDb: {
      privacyChainCache: { getChainTip: async () => mockSavedTip },
    },
  },
  getXmrNetwork: async () => 'mainnet',
  resolveXmrNodeUrl: async () => 'https://node.example:18081',
} as unknown as Vault;

function runtimeError(code: string) {
  return new OneKeyLocalError(JSON.stringify({ code, params: {} }));
}

beforeEach(() => {
  resetXmrRuntimeSession();
  resetXmrStaleFirstCache();
  jest.clearAllMocks();
  raw.chainTip.mockImplementation(async () => JSON.stringify({ height: 1 }));
  raw.balance.mockImplementation(async () => '{}');
});

/**
 * The runtime's open database and node client live in Worker memory. On the
 * extension that Worker sits in the offscreen document, which can be torn
 * down and recreated under the background's feet -- and the background's
 * cached session then says "open, node set" over a runtime that has neither.
 * Every call failed with NODE_NOT_CONFIGURED until the app was restarted.
 */
describe('xmr runtime session', () => {
  it('opens the wallet and points it at the node once', async () => {
    const api = await getXmrRuntime(vault);
    await api.chainTip();
    await api.chainTip();
    expect(raw.openWallet).toHaveBeenCalledTimes(1);
    expect(raw.setNodeUrl).toHaveBeenCalledWith('https://node.example:18081');
  });

  // Delete, reset and GC only need the database.
  it('opens for local work when the node cannot be reached', async () => {
    raw.setNodeUrl.mockImplementationOnce(async () => {
      throw runtimeError('NETWORK_ERROR');
    });
    const api = await getXmrRuntime(vault);
    await expect(api.balance('3', '1')).resolves.toBe('{}');
    expect(raw.openWallet).toHaveBeenCalledTimes(1);
  });

  it('opens for local work when no node is configured', async () => {
    const noNode = {
      getXmrNetwork: async () => 'mainnet',
      resolveXmrNodeUrl: async () => {
        throw new OneKeyLocalError('no node');
      },
    } as unknown as Vault;
    const api = await getXmrRuntime(noNode);
    await expect(api.balance('3', '1')).resolves.toBe('{}');
    expect(raw.setNodeUrl).not.toHaveBeenCalled();
  });

  // A node switch used to reopen the database under a running step.
  it('switches node on the open session instead of reopening', async () => {
    await getXmrRuntime(vault);
    const other = {
      getXmrNetwork: async () => 'mainnet',
      resolveXmrNodeUrl: async () => 'https://other.example:18081',
    } as unknown as Vault;
    await getXmrRuntime(other);
    expect(raw.openWallet).toHaveBeenCalledTimes(1);
    expect(raw.setNodeUrl).toHaveBeenLastCalledWith(
      'https://other.example:18081',
    );
  });

  // After a switch or a disable the previous node must never be asked again.
  it('disconnects the node when it is disabled', async () => {
    await getXmrRuntime(vault);
    const disabled = {
      getXmrNetwork: async () => 'mainnet',
      resolveXmrNodeUrl: async () => {
        throw new OneKeyLocalError('no node');
      },
    } as unknown as Vault;
    await getXmrRuntime(disabled);
    expect(raw.setNodeUrl).toHaveBeenLastCalledWith('');
  });

  it('retries an unreachable new node instead of settling on the old one', async () => {
    await getXmrRuntime(vault);
    const other = {
      getXmrNetwork: async () => 'mainnet',
      resolveXmrNodeUrl: async () => 'https://other.example:18081',
    } as unknown as Vault;
    raw.setNodeUrl.mockImplementationOnce(async () => {
      throw new OneKeyLocalError('unreachable');
    });
    await getXmrRuntime(other);
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now + 60_000);
    await getXmrRuntime(other);
    expect(raw.setNodeUrl).toHaveBeenLastCalledWith(
      'https://other.example:18081',
    );
    expect(raw.setNodeUrl).toHaveBeenCalledTimes(3);
  });

  it('reopens once and retries when the runtime lost its state', async () => {
    raw.chainTip
      .mockImplementationOnce(async () => {
        throw runtimeError('NODE_NOT_CONFIGURED');
      })
      .mockImplementationOnce(async () => JSON.stringify({ height: 42 }));
    const api = await getXmrRuntime(vault);
    const tip = JSON.parse(await api.chainTip()) as { height: number };
    expect(tip.height).toBe(42);
    expect(raw.openWallet).toHaveBeenCalledTimes(2);
    expect(raw.setNodeUrl).toHaveBeenCalledTimes(2);
  });

  it('gives up after one reopen rather than looping', async () => {
    raw.chainTip.mockImplementation(async () => {
      throw runtimeError('WALLET_NOT_OPEN');
    });
    const api = await getXmrRuntime(vault);
    await expect(api.chainTip()).rejects.toThrow('WALLET_NOT_OPEN');
    expect(raw.openWallet).toHaveBeenCalledTimes(2);
  });

  it('passes every other error through without reopening', async () => {
    raw.balance.mockImplementation(async () => {
      throw runtimeError('WALLET_BUSY');
    });
    const api = await getXmrRuntime(vault);
    await expect(api.balance('3', '1')).rejects.toThrow('WALLET_BUSY');
    await expect(api.balance('3', '1')).rejects.toThrow('WALLET_BUSY');
    expect(raw.openWallet).toHaveBeenCalledTimes(1);
  });
});

/**
 * The runtime checks its database and node out for a whole async step, so a
 * read arriving mid-step fails as "not open" -- and the self-heal above would
 * then reopen a wallet that is merely busy. Calls queue instead: a read waits
 * for the step, never races it.
 */
describe('xmr runtime call serialisation', () => {
  it('runs one call at a time, in order', async () => {
    const order: string[] = [];
    let releaseStep: () => void = () => {};
    raw.syncStep.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          releaseStep = () => {
            order.push('step');
            resolve('{}');
          };
        }),
    );
    raw.balance.mockImplementation(async () => {
      order.push('balance');
      return '{}';
    });
    const api = await getXmrRuntime(vault);
    const step = api.syncStep('3', '10');
    const balance = api.balance('3', '1');
    await Promise.resolve();
    expect(order).toEqual([]);
    releaseStep();
    await Promise.all([step, balance]);
    expect(order).toEqual(['step', 'balance']);
  });
});

/**
 * The rule: a UI read never waits on a scan step. While a step holds the
 * lock, reads answer from what they last saw (or a placeholder) and the next
 * read after the step returns the fresh value.
 */
describe('xmr stale-first reads', () => {
  it('reads live and remembers the result while the runtime is free', async () => {
    const read = jest.fn(async () => 'fresh');
    await expect(
      readXmrStaleFirst({ key: 'k', read, fallback: 'placeholder' }),
    ).resolves.toBe('fresh');
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('answers from the last value instead of queueing behind a step', async () => {
    let releaseStep: () => void = () => {};
    raw.syncStep.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          releaseStep = () => resolve('{}');
        }),
    );
    const api = await getXmrRuntime(vault);
    await readXmrStaleFirst({
      key: 'k',
      read: async () => 'v1',
      fallback: '?',
    });

    const step = api.syncStep('3', '10');
    await Promise.resolve();
    expect(isXmrRuntimeBusy()).toBe(true);

    const read = jest.fn(async () => 'v2');
    // Answered immediately, without touching the runtime.
    await expect(
      readXmrStaleFirst({ key: 'k', read, fallback: '?' }),
    ).resolves.toBe('v1');
    expect(read).not.toHaveBeenCalled();
    // Never read before: the placeholder, not a wait.
    await expect(
      readXmrStaleFirst({ key: 'other', read, fallback: '?' }),
    ).resolves.toBe('?');

    releaseStep();
    await step;
    expect(isXmrRuntimeBusy()).toBe(false);
    await expect(
      readXmrStaleFirst({ key: 'k', read, fallback: '?' }),
    ).resolves.toBe('v2');
  });

  it('forgets one account after its data is removed or rewound', async () => {
    let releaseStep: () => void = () => {};
    raw.syncStep.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          releaseStep = () => resolve('{}');
        }),
    );
    const api = await getXmrRuntime(vault);
    for (const key of ['history:a', 'progress:a', 'history:b']) {
      // eslint-disable-next-line no-await-in-loop
      await readXmrStaleFirst({ key, read: async () => 'old', fallback: '?' });
    }

    forgetXmrStaleFirstAccount('a');

    const step = api.syncStep('3', '10');
    await Promise.resolve();
    const read = jest.fn(async () => 'new');
    for (const key of ['history:a', 'progress:a']) {
      // eslint-disable-next-line no-await-in-loop
      await expect(
        readXmrStaleFirst({ key, read, fallback: '?' }),
      ).resolves.toBe('?');
    }
    await expect(
      readXmrStaleFirst({ key: 'history:b', read, fallback: '?' }),
    ).resolves.toBe('old');
    releaseStep();
    await step;
  });
});

/**
 * Cold start: a scan step usually holds the lock when the first poll arrives,
 * and with nothing remembered the read would answer the placeholder until a
 * poll happened to land between two steps.
 */
describe('xmr stale-first cold start', () => {
  async function holdStep() {
    let releaseStep: () => void = () => {};
    raw.syncStep.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          releaseStep = () => resolve('{}');
        }),
    );
    const api = await getXmrRuntime(vault);
    const step = api.syncStep('3', '10');
    await Promise.resolve();
    expect(isXmrRuntimeBusy()).toBe(true);
    return async () => {
      releaseStep();
      await step;
      // Let the queued read run after the step.
      await new Promise((resolve) => setTimeout(resolve, 0));
    };
  }

  it('queues one read behind the step and remembers its answer', async () => {
    const release = await holdStep();
    const read = jest.fn(async () => 'rows');
    for (let i = 0; i < 3; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await expect(
        readXmrStaleFirst({
          key: 'history:a',
          read,
          fallback: '?',
          queueWhenUncached: true,
        }),
      ).resolves.toBe('?');
    }
    expect(read).not.toHaveBeenCalled();

    await release();
    expect(read).toHaveBeenCalledTimes(1);

    // Still busy for the next poll: answered from what the queued read saw.
    const releaseAgain = await holdStep();
    const next = jest.fn(async () => 'newer');
    await expect(
      readXmrStaleFirst({
        key: 'history:a',
        read: next,
        fallback: '?',
        queueWhenUncached: true,
      }),
    ).resolves.toBe('rows');
    await releaseAgain();
    expect(next).not.toHaveBeenCalled();
  });

  it('does not queue unless the caller asks', async () => {
    const release = await holdStep();
    const read = jest.fn(async () => 'value');
    await expect(
      readXmrStaleFirst({ key: 'storage', read, fallback: '?' }),
    ).resolves.toBe('?');
    await release();
    expect(read).not.toHaveBeenCalled();
  });

  it('drops a queued answer when the account data was forgotten meanwhile', async () => {
    const release = await holdStep();
    const read = jest.fn(async () => 'old rows');
    await readXmrStaleFirst({
      key: 'history:a',
      read,
      fallback: '?',
      queueWhenUncached: true,
    });
    forgetXmrStaleFirstAccount('a');
    await release();
    expect(read).toHaveBeenCalledTimes(1);

    const releaseAgain = await holdStep();
    await expect(
      readXmrStaleFirst({ key: 'history:a', read, fallback: '?' }),
    ).resolves.toBe('?');
    await releaseAgain();
  });

  it('swallows a failed queued read and retries on a later poll', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const release = await holdStep();
    const read = jest
      .fn<Promise<string>, []>()
      .mockRejectedValueOnce(new OneKeyLocalError('not registered'))
      .mockResolvedValueOnce('rows');
    const params = {
      key: 'history:a',
      read,
      fallback: '?',
      queueWhenUncached: true,
    };
    await expect(readXmrStaleFirst(params)).resolves.toBe('?');
    await release();
    expect(read).toHaveBeenCalledTimes(1);

    const releaseAgain = await holdStep();
    await expect(readXmrStaleFirst(params)).resolves.toBe('?');
    await releaseAgain();
    expect(read).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});

/**
 * Progress is published after every scan step. A fresh tip each time put a
 * node round trip between every pair of steps; display reads reuse the last
 * tip anyone fetched instead.
 */
describe('xmr display chain tip', () => {
  afterEach(() => {
    mockSavedTip = undefined;
  });

  it('reuses the last fetched tip instead of asking the node again', async () => {
    raw.chainTip.mockImplementation(async () => JSON.stringify({ height: 42 }));
    const api = await getXmrRuntime(vault);
    await expect(getXmrChainTip(api)).resolves.toBe(42);
    raw.chainTip.mockClear();
    await expect(getXmrLastKnownChainTip(vault)).resolves.toBe(42);
    expect(raw.chainTip).not.toHaveBeenCalled();
  });

  // A cold start must not wait on the node just to draw progress.
  it('falls back to the saved tip, never the node', async () => {
    mockSavedTip = 7;
    await expect(getXmrLastKnownChainTip(vault)).resolves.toBe(7);
    mockSavedTip = undefined;
    await expect(getXmrLastKnownChainTip(vault)).resolves.toBeUndefined();
    expect(raw.chainTip).not.toHaveBeenCalled();
  });
});

describe('xmr local reads', () => {
  it('reopens a lost local database without reconnecting the node', async () => {
    await getXmrRuntime(vault);
    raw.setNodeUrl.mockClear();
    raw.balance.mockRejectedValueOnce(runtimeError('WALLET_NOT_OPEN'));

    const local = await getXmrLocalRuntime(vault);
    await expect(local.balance('3', '1')).resolves.toBe('{}');

    expect(raw.openWallet).toHaveBeenCalledTimes(2);
    expect(raw.setNodeUrl).not.toHaveBeenCalled();
    await getXmrRuntime(vault);
    expect(raw.setNodeUrl).toHaveBeenCalledTimes(1);
  });

  it('open the database without waiting on the node', async () => {
    await getXmrLocalRuntime(vault);
    expect(raw.openWallet).toHaveBeenCalledTimes(1);
    expect(raw.setNodeUrl).not.toHaveBeenCalled();

    // Scanning connects on the same session instead of reopening it.
    await getXmrRuntime(vault);
    expect(raw.openWallet).toHaveBeenCalledTimes(1);
    expect(raw.setNodeUrl).toHaveBeenCalledWith('https://node.example:18081');
  });
});

// Settings shows the node's health from the tip fetches scanning already makes.
describe('xmr node health', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('records the tip round trip against the connected node', async () => {
    const api = await getXmrRuntime(vault);
    const now = jest.spyOn(Date, 'now');
    now.mockReturnValueOnce(1000).mockReturnValue(1250);
    await getXmrChainTip(api);
    expect(getXmrNodeHealth()).toEqual({
      url: 'https://node.example:18081',
      ok: true,
      latencyMs: 250,
      atMs: 1250,
    });
  });

  it('records a failed tip fetch as unhealthy', async () => {
    const api = await getXmrRuntime(vault);
    raw.chainTip.mockImplementationOnce(async () => {
      throw runtimeError('NETWORK_ERROR');
    });
    await expect(getXmrChainTip(api)).rejects.toThrow();
    expect(getXmrNodeHealth()).toMatchObject({
      url: 'https://node.example:18081',
      ok: false,
    });
  });

  it('keys the sample by the node it came from', async () => {
    await getXmrChainTip(await getXmrRuntime(vault));
    const other = {
      getXmrNetwork: async () => 'mainnet',
      resolveXmrNodeUrl: async () => 'https://other.example:18081',
    } as unknown as Vault;
    await getXmrChainTip(await getXmrRuntime(other));
    expect(getXmrNodeHealth()?.url).toBe('https://other.example:18081');
  });
});
