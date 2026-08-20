import type { ISwapNetwork } from '@onekeyhq/shared/types/swap/types';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import {
  checkProSupportsNetwork,
  fetchSwapStableTokenKeys,
  getSwapStableTokenKeysForCarry,
  resolveProToSwapCarryToken,
  resolveSwapContextNetworkId,
  resolveSwapProCarryIntentStatus,
  resolveSwapToProCarryToken,
  warmSwapStableTokenKeys,
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

  it('uses settled status by token identity across pair combinations', () => {
    const stableTokenKeys = new Set([stableKey('evm--1', '0xusdt')]);
    const cache = new Map([
      [stableKey('evm--1', '0xusdt'), { isStableCoin: true }],
      [stableKey('evm--1', '0xuni'), { isStableCoin: false }],
    ]);

    expect(
      getSwapStableTokenKeysForCarry({
        tokens: [
          token,
          buildToken({ networkId: 'evm--1', contractAddress: '0xuni' }),
        ],
        cache,
      }),
    ).toEqual(stableTokenKeys);
  });

  it('keeps carry pending until every non-native token is settled', () => {
    expect(
      getSwapStableTokenKeysForCarry({
        tokens: [token],
        cache: new Map([
          [stableKey('evm--1', '0xusdt'), { promise: Promise.resolve(true) }],
        ]),
      }),
    ).toBeUndefined();
    expect(
      getSwapStableTokenKeysForCarry({
        tokens: [token],
        cache: new Map(),
      }),
    ).toBeUndefined();
  });

  it('treats native-only candidates as synchronously settled non-stable', () => {
    expect(
      getSwapStableTokenKeysForCarry({
        tokens: [buildToken({ networkId: 'evm--1', contractAddress: '' })],
        cache: new Map(),
      }),
    ).toEqual(new Set());
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

  it('keeps all-network selection by using the FromToken as carry context', () => {
    expect(
      resolveSwapContextNetworkId({
        accountNetworkId: 'all--0',
        fromTokenNetworkId: 'evm--1',
        isAllNetwork: true,
      }),
    ).toBe('evm--1');
  });
});

describe('resolveSwapProCarryIntentStatus', () => {
  it('waits on the source tab and becomes ready on the intended target', () => {
    expect(
      resolveSwapProCarryIntentStatus({
        currentType: ESwapTabSwitchType.SWAP,
        sourceType: ESwapTabSwitchType.SWAP,
        targetType: ESwapTabSwitchType.LIMIT,
        enteredTarget: false,
        targetUserSelected: false,
      }),
    ).toBe('waiting');
    expect(
      resolveSwapProCarryIntentStatus({
        currentType: ESwapTabSwitchType.LIMIT,
        sourceType: ESwapTabSwitchType.SWAP,
        targetType: ESwapTabSwitchType.LIMIT,
        enteredTarget: false,
        targetUserSelected: false,
      }),
    ).toBe('ready');
  });

  it('cancels after leaving the target or when the target is manually changed', () => {
    expect(
      resolveSwapProCarryIntentStatus({
        currentType: ESwapTabSwitchType.STOCK,
        sourceType: ESwapTabSwitchType.SWAP,
        targetType: ESwapTabSwitchType.LIMIT,
        enteredTarget: true,
        targetUserSelected: false,
      }),
    ).toBe('cancel');
    expect(
      resolveSwapProCarryIntentStatus({
        currentType: ESwapTabSwitchType.LIMIT,
        sourceType: ESwapTabSwitchType.SWAP,
        targetType: ESwapTabSwitchType.LIMIT,
        enteredTarget: true,
        targetUserSelected: true,
      }),
    ).toBe('cancel');
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

  it('warms and reuses classification at single-token granularity', async () => {
    const usdt = buildToken({
      networkId: 'evm--1',
      contractAddress: '0xusdt',
    });
    const uni = buildToken({
      networkId: 'evm--1',
      contractAddress: '0xuni',
    });
    mockCheckStableCoinsList
      .mockResolvedValueOnce([
        {
          networkId: 'evm--1',
          results: [{ contractAddress: '0xusdt', isStableCoin: true }],
        },
      ])
      .mockResolvedValueOnce([
        {
          networkId: 'evm--1',
          results: [{ contractAddress: '0xuni', isStableCoin: false }],
        },
      ]);
    const cache = new Map();

    await expect(warmSwapStableTokenKeys([usdt, uni], cache)).resolves.toEqual(
      new Set([stableKey('evm--1', '0xusdt')]),
    );
    expect(mockCheckStableCoinsList).toHaveBeenCalledTimes(2);
    expect(mockCheckStableCoinsList.mock.calls).toEqual([
      [
        {
          list: [
            {
              networkId: 'evm--1',
              contractAddressList: ['0xusdt'],
            },
          ],
        },
      ],
      [
        {
          list: [
            {
              networkId: 'evm--1',
              contractAddressList: ['0xuni'],
            },
          ],
        },
      ],
    ]);

    await warmSwapStableTokenKeys([uni, usdt], cache);
    expect(mockCheckStableCoinsList).toHaveBeenCalledTimes(2);
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
