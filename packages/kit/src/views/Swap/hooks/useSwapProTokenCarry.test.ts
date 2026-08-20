import type { ISwapNetwork } from '@onekeyhq/shared/types/swap/types';

import {
  buildSwapStableTokenLookupKey,
  checkProSupportsNetwork,
  fetchSwapStableTokenKeys,
  getSwapStableTokenKeysForCarry,
  resolveProToSwapCarryToken,
  resolveSwapContextNetworkId,
  resolveSwapToProCarryToken,
} from './useSwapProTokenCarry';

type IMockCheckStableCoinsList = (params: unknown) => Promise<
  Array<{
    networkId: string;
    results: Array<{ contractAddress: string; isStableCoin: boolean }>;
  }>
>;
const mockCheckStableCoinsList: jest.MockedFunction<IMockCheckStableCoinsList> =
  jest.fn();
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceSwap: {
      checkStableCoinsList: (params: unknown) =>
        mockCheckStableCoinsList(params),
    },
  },
}));

function buildToken(overrides: {
  networkId: string;
  contractAddress: string;
  isStock?: boolean;
}) {
  return {
    networkId: overrides.networkId,
    contractAddress: overrides.contractAddress,
    isStock: overrides.isStock ?? false,
  };
}

function buildSwapNetworks(): ISwapNetwork[] {
  return [
    {
      networkId: 'evm--1',
      supportLimit: true,
      supportSingleSwap: true,
      supportCrossChainSwap: true,
    },
    {
      networkId: 'sol--101',
      supportLimit: false,
      supportSingleSwap: true,
      supportCrossChainSwap: true,
    },
    {
      networkId: 'btc--0',
      supportLimit: false,
      supportSingleSwap: false,
      supportCrossChainSwap: false,
    },
  ] as ISwapNetwork[];
}

function stableKey(networkId: string, contractAddress: string) {
  return `${networkId}:${contractAddress.toLowerCase()}`;
}

describe('resolveSwapToProCarryToken', () => {
  it('prefers the ToToken when it is not a stable coin', () => {
    const toToken = buildToken({
      networkId: 'evm--1',
      contractAddress: '0xuni',
    });
    const fromToken = buildToken({
      networkId: 'evm--1',
      contractAddress: '0xeth',
    });
    expect(
      resolveSwapToProCarryToken({
        toToken,
        fromToken,
        stableTokenKeys: new Set<string>(),
      }),
    ).toBe(toToken);
  });

  it('falls back to the FromToken when the ToToken is a stable coin', () => {
    const toToken = buildToken({
      networkId: 'evm--1',
      contractAddress: '0xusdt',
    });
    const fromToken = buildToken({
      networkId: 'evm--1',
      contractAddress: '0xeth',
    });
    expect(
      resolveSwapToProCarryToken({
        toToken,
        fromToken,
        stableTokenKeys: new Set([stableKey('evm--1', '0xusdt')]),
      }),
    ).toBe(fromToken);
  });

  it('brings nothing when both sides are stable coins', () => {
    const toToken = buildToken({
      networkId: 'evm--1',
      contractAddress: '0xusdt',
    });
    const fromToken = buildToken({
      networkId: 'evm--1',
      contractAddress: '0xusdc',
    });
    expect(
      resolveSwapToProCarryToken({
        toToken,
        fromToken,
        stableTokenKeys: new Set([
          stableKey('evm--1', '0xusdt'),
          stableKey('evm--1', '0xusdc'),
        ]),
      }),
    ).toBeUndefined();
  });

  it('treats missing stable-coin data as non-stable (empty key set)', () => {
    const toToken = buildToken({
      networkId: 'evm--1',
      contractAddress: '0xusdt',
    });
    expect(
      resolveSwapToProCarryToken({
        toToken,
        fromToken: undefined,
        stableTokenKeys: new Set<string>(),
      }),
    ).toBe(toToken);
  });

  it('skips stock tokens', () => {
    const toToken = buildToken({
      networkId: 'evm--1',
      contractAddress: '',
      isStock: true,
    });
    const fromToken = buildToken({
      networkId: 'evm--1',
      contractAddress: '0xeth',
    });
    expect(
      resolveSwapToProCarryToken({
        toToken,
        fromToken,
        stableTokenKeys: new Set<string>(),
      }),
    ).toBe(fromToken);
  });
});

describe('checkProSupportsNetwork', () => {
  it('requires the network to support limit (Pro)', () => {
    const networks = buildSwapNetworks();
    expect(
      checkProSupportsNetwork({ swapNetworks: networks, networkId: 'evm--1' }),
    ).toBe(true);
    expect(
      checkProSupportsNetwork({
        swapNetworks: networks,
        networkId: 'sol--101',
      }),
    ).toBe(false);
  });
});

describe('resolveProToSwapCarryToken', () => {
  const networks = buildSwapNetworks();

  it('carries a supported non-stable target token', () => {
    const proToken = buildToken({
      networkId: 'evm--1',
      contractAddress: '0xjup',
    });
    expect(
      resolveProToSwapCarryToken({
        proToken,
        swapFromToken: buildToken({
          networkId: 'evm--1',
          contractAddress: '0xeth',
        }),
        swapNetworkId: 'evm--1',
        stableTokenKeys: new Set<string>(),
        swapNetworks: networks,
      }),
    ).toBe(proToken);
  });

  it('does not carry stable coins', () => {
    expect(
      resolveProToSwapCarryToken({
        proToken: buildToken({
          networkId: 'evm--1',
          contractAddress: '0xusdt',
        }),
        swapFromToken: buildToken({
          networkId: 'evm--1',
          contractAddress: '0xeth',
        }),
        swapNetworkId: 'evm--1',
        stableTokenKeys: new Set([stableKey('evm--1', '0xusdt')]),
        swapNetworks: networks,
      }),
    ).toBeUndefined();
  });

  it('does not carry a token equal to the Swap FromToken', () => {
    expect(
      resolveProToSwapCarryToken({
        proToken: buildToken({
          networkId: 'evm--1',
          contractAddress: '0XETH',
        }),
        swapFromToken: buildToken({
          networkId: 'evm--1',
          contractAddress: '0xeth',
        }),
        swapNetworkId: 'evm--1',
        stableTokenKeys: new Set<string>(),
        swapNetworks: networks,
      }),
    ).toBeUndefined();
  });

  it('does not carry tokens on networks unsupported by Swap', () => {
    expect(
      resolveProToSwapCarryToken({
        proToken: buildToken({
          networkId: 'btc--0',
          contractAddress: '',
        }),
        swapFromToken: buildToken({
          networkId: 'evm--1',
          contractAddress: '0xeth',
        }),
        swapNetworkId: 'evm--1',
        stableTokenKeys: new Set<string>(),
        swapNetworks: networks,
      }),
    ).toBeUndefined();
  });

  it('does not carry a cross-network target that equals the native default FromToken', () => {
    expect(
      resolveProToSwapCarryToken({
        proToken: buildToken({
          networkId: 'sol--101',
          contractAddress: '',
        }),
        swapFromToken: buildToken({
          networkId: 'evm--1',
          contractAddress: '0xeth',
        }),
        swapNetworkId: 'evm--1',
        stableTokenKeys: new Set<string>(),
        swapNetworks: networks,
      }),
    ).toBeUndefined();
  });

  it('judges cross-network against the swap context network, not the FromToken', () => {
    // FromToken unset (cold start into Pro) but the swap context network is
    // known: the native-default exclusion must still apply via swapNetworkId.
    expect(
      resolveProToSwapCarryToken({
        proToken: buildToken({
          networkId: 'sol--101',
          contractAddress: '',
        }),
        swapFromToken: undefined,
        swapNetworkId: 'evm--56',
        stableTokenKeys: new Set<string>(),
        swapNetworks: networks,
      }),
    ).toBeUndefined();
  });
});

describe('stable-token lookup snapshot', () => {
  const token = buildToken({
    networkId: 'evm--1',
    contractAddress: '0xusdt',
  });

  it('uses only a settled snapshot for the current token identity', () => {
    const key = buildSwapStableTokenLookupKey([token]);
    const stableTokenKeys = new Set([stableKey('evm--1', '0xusdt')]);

    expect(
      getSwapStableTokenKeysForCarry({
        tokens: [token],
        cache: { key, stableTokenKeys },
      }),
    ).toBe(stableTokenKeys);
  });

  it('falls back immediately while prewarming is pending or stale', () => {
    const key = buildSwapStableTokenLookupKey([token]);

    expect(
      getSwapStableTokenKeysForCarry({
        tokens: [token],
        cache: { key },
      }),
    ).toEqual(new Set<string>());
    expect(
      getSwapStableTokenKeysForCarry({
        tokens: [token],
        cache: {
          key: 'evm--56:0xusdt',
          stableTokenKeys: new Set([stableKey('evm--56', '0xusdt')]),
        },
      }),
    ).toEqual(new Set<string>());
  });
});

describe('resolveSwapContextNetworkId', () => {
  it('prefers the account network over a restored FromToken network', () => {
    expect(
      resolveSwapContextNetworkId({
        accountNetworkId: 'evm--56',
        fromTokenNetworkId: 'evm--1',
      }),
    ).toBe('evm--56');
  });

  it('falls back to the FromToken only when the account network is unknown', () => {
    expect(
      resolveSwapContextNetworkId({
        fromTokenNetworkId: 'evm--1',
      }),
    ).toBe('evm--1');
  });
});

describe('fetchSwapStableTokenKeys', () => {
  beforeEach(() => {
    mockCheckStableCoinsList.mockReset();
  });

  it('maps backend results into stable token keys', async () => {
    mockCheckStableCoinsList.mockResolvedValue([
      {
        networkId: 'evm--1',
        results: [
          { contractAddress: '0xusdt', isStableCoin: true },
          { contractAddress: '0xuni', isStableCoin: false },
        ],
      },
    ]);
    await expect(
      fetchSwapStableTokenKeys([
        buildToken({ networkId: 'evm--1', contractAddress: '0xusdt' }),
        buildToken({ networkId: 'evm--1', contractAddress: '0xuni' }),
      ]),
    ).resolves.toEqual(new Set([stableKey('evm--1', '0xusdt')]));
  });

  it('resolves to an empty set when the request fails (treat as non-stable)', async () => {
    mockCheckStableCoinsList.mockRejectedValue(new Error('network down'));
    await expect(
      fetchSwapStableTokenKeys([
        buildToken({ networkId: 'evm--1', contractAddress: '0xusdt' }),
      ]),
    ).resolves.toEqual(new Set<string>());
  });

  it('skips the request entirely for empty or stock-only inputs', async () => {
    await expect(
      fetchSwapStableTokenKeys([
        undefined,
        buildToken({ networkId: 'evm--1', contractAddress: '', isStock: true }),
      ]),
    ).resolves.toEqual(new Set<string>());
    expect(mockCheckStableCoinsList).not.toHaveBeenCalled();
  });

  it('skips the request when every candidate is a native token', async () => {
    await expect(
      fetchSwapStableTokenKeys([
        buildToken({ networkId: 'evm--1', contractAddress: '' }),
        buildToken({ networkId: 'sol--101', contractAddress: '' }),
      ]),
    ).resolves.toEqual(new Set<string>());
    expect(mockCheckStableCoinsList).not.toHaveBeenCalled();
  });
});
