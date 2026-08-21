/** @jest-environment jsdom */

import { createElement } from 'react';
import type { ReactNode } from 'react';

import { act, renderHook } from '@testing-library/react';
import { createStore } from 'jotai';

import {
  ProviderJotaiContextSwap,
  swapFromTokenAmountAtom,
  swapNetworks,
  swapProSelectTokenAtom,
  swapProUserSelectedTokenAtom,
  swapSelectFromTokenAtom,
  swapSelectToTokenAtom,
  swapToTokenAmountAtom,
  swapUserSelectedTokensAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  ISwapNetwork,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import {
  buildSwapStableTokenRequestKey,
  checkProSupportsNetwork,
  fetchSwapStableTokenKeys,
  resolveProToSwapCarryToken,
  resolveSwapContextNetworkId,
  resolveSwapToProCarryToken,
  useSwapProTokenCarry,
} from './useSwapProTokenCarry';

type IMockCheckStableCoinsList = (params: unknown) => Promise<
  Array<{
    networkId: string;
    results: Array<{ contractAddress: string; isStableCoin: boolean }>;
  }>
>;
const mockCheckStableCoinsList: jest.MockedFunction<IMockCheckStableCoinsList> =
  jest.fn();
const mockSetSwapProSelectToken = jest.fn<Promise<void>, [unknown]>();
const mockSetSwapNetworksSort = jest.fn<Promise<void>, [unknown]>();
const mockUsePromiseResult = jest.fn((..._args: unknown[]) => ({
  result: undefined,
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (...args: unknown[]) => mockUsePromiseResult(...args),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceSwap: {
      checkStableCoinsList: (params: unknown) =>
        mockCheckStableCoinsList(params),
    },
    simpleDb: {
      swapProSelectToken: {
        setSwapProSelectToken: (params: unknown) =>
          mockSetSwapProSelectToken(params),
      },
      swapNetworksSort: {
        setRawData: (params: unknown) => mockSetSwapNetworksSort(params),
      },
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

function buildFullToken({
  networkId,
  contractAddress,
  symbol,
  isNative = false,
}: {
  networkId: string;
  contractAddress: string;
  symbol: string;
  isNative?: boolean;
}): ISwapToken {
  return {
    networkId,
    contractAddress,
    symbol,
    decimals: 18,
    isNative,
  };
}

function createCarryHookWrapper(
  setup: (store: ReturnType<typeof createStore>) => void,
) {
  const store = createStore();
  setup(store);
  const Wrapper = ({ children }: { children?: ReactNode }) =>
    createElement(ProviderJotaiContextSwap, { store }, children);
  return { store, Wrapper };
}

describe('useSwapProTokenCarry orchestration', () => {
  const originalIsNative = platformEnv.isNative;

  beforeEach(() => {
    platformEnv.isNative = true;
    mockUsePromiseResult.mockClear();
    mockSetSwapProSelectToken.mockResolvedValue(undefined);
    mockSetSwapNetworksSort.mockResolvedValue(undefined);
  });

  afterAll(() => {
    platformEnv.isNative = originalIsNative;
  });

  it('applies Pro -> Swap from the captured manual token without waiting for a rerender', () => {
    const fromToken = buildFullToken({
      networkId: 'evm--1',
      contractAddress: '',
      symbol: 'ETH',
      isNative: true,
    });
    const proToken = buildFullToken({
      networkId: 'evm--1',
      contractAddress: '0xuni',
      symbol: 'UNI',
    });
    const { store, Wrapper } = createCarryHookWrapper((storeInstance) => {
      storeInstance.set(swapSelectFromTokenAtom(), fromToken);
      storeInstance.set(swapProSelectTokenAtom(), proToken);
      storeInstance.set(swapProUserSelectedTokenAtom(), proToken);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '1',
        isInput: true,
      });
      storeInstance.set(swapToTokenAmountAtom(), {
        value: '2500',
        isInput: false,
      });
      storeInstance.set(swapNetworks(), buildSwapNetworks());
    });
    const { result } = renderHook(
      () => useSwapProTokenCarry({ accountNetworkId: 'evm--1' }),
      { wrapper: Wrapper },
    );
    expect(mockUsePromiseResult).toHaveBeenLastCalledWith(
      expect.any(Function),
      expect.any(Array),
      expect.objectContaining({
        checkIsFocused: true,
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
      }),
    );

    let plan: ReturnType<typeof result.current.prepareProTokenCarryToSwap>;
    act(() => {
      plan = result.current.prepareProTokenCarryToSwap();
    });
    expect(store.get(swapProUserSelectedTokenAtom())).toBe(proToken);
    act(() => {
      expect(plan?.claim()).toBe(true);
      plan?.apply();
    });

    expect(store.get(swapProUserSelectedTokenAtom())).toBeUndefined();
    expect(store.get(swapSelectToTokenAtom())).toBe(proToken);
    expect(store.get(swapFromTokenAmountAtom()).value).toBe('');
    expect(store.get(swapToTokenAmountAtom()).value).toBe('');
  });

  it('discards a manual Swap snapshot after current atoms are replaced', () => {
    const manualFromToken = buildFullToken({
      networkId: 'evm--1',
      contractAddress: '',
      symbol: 'ETH',
      isNative: true,
    });
    const manualToToken = buildFullToken({
      networkId: 'evm--1',
      contractAddress: '0xuni',
      symbol: 'UNI',
    });
    const programmaticToken = buildFullToken({
      networkId: 'evm--1',
      contractAddress: '0xlink',
      symbol: 'LINK',
    });
    const { store, Wrapper } = createCarryHookWrapper((storeInstance) => {
      storeInstance.set(swapSelectFromTokenAtom(), manualFromToken);
      storeInstance.set(swapSelectToTokenAtom(), programmaticToken);
      storeInstance.set(swapUserSelectedTokensAtom(), {
        fromToken: manualFromToken,
        toToken: manualToToken,
      });
      storeInstance.set(swapNetworks(), buildSwapNetworks());
    });
    const { result } = renderHook(
      () => useSwapProTokenCarry({ accountNetworkId: 'evm--1' }),
      { wrapper: Wrapper },
    );

    act(() => {
      result.current.carrySwapTokenToPro();
    });

    expect(store.get(swapUserSelectedTokensAtom())).toBeUndefined();
    expect(store.get(swapProSelectTokenAtom())).toBeUndefined();
  });

  it('moves a cross-network Pro target into Swap with the target native FromToken', () => {
    const fromToken = buildFullToken({
      networkId: 'evm--1',
      contractAddress: '',
      symbol: 'ETH',
      isNative: true,
    });
    const proToken = buildFullToken({
      networkId: 'sol--101',
      contractAddress: 'jup-address',
      symbol: 'JUP',
    });
    const { store, Wrapper } = createCarryHookWrapper((storeInstance) => {
      storeInstance.set(swapSelectFromTokenAtom(), fromToken);
      storeInstance.set(swapProSelectTokenAtom(), proToken);
      storeInstance.set(swapProUserSelectedTokenAtom(), proToken);
      storeInstance.set(swapNetworks(), buildSwapNetworks());
    });
    const { result } = renderHook(
      () => useSwapProTokenCarry({ accountNetworkId: 'evm--1' }),
      { wrapper: Wrapper },
    );

    let plan: ReturnType<typeof result.current.prepareProTokenCarryToSwap>;
    act(() => {
      plan = result.current.prepareProTokenCarryToSwap();
      expect(plan?.claim()).toBe(true);
      plan?.apply();
    });

    expect(plan?.targetNetworkId).toBe('sol--101');
    expect(store.get(swapSelectFromTokenAtom())).toEqual(
      expect.objectContaining({
        networkId: 'sol--101',
        isNative: true,
      }),
    );
    expect(store.get(swapSelectToTokenAtom())).toBe(proToken);
  });

  it('does not apply a prepared plan after the Pro target changes asynchronously', () => {
    const fromToken = buildFullToken({
      networkId: 'evm--1',
      contractAddress: '',
      symbol: 'ETH',
      isNative: true,
    });
    const preparedToken = buildFullToken({
      networkId: 'evm--1',
      contractAddress: '0xuni',
      symbol: 'UNI',
    });
    const latestToken = buildFullToken({
      networkId: 'evm--1',
      contractAddress: '0xlink',
      symbol: 'LINK',
    });
    const { store, Wrapper } = createCarryHookWrapper((storeInstance) => {
      storeInstance.set(swapSelectFromTokenAtom(), fromToken);
      storeInstance.set(swapProSelectTokenAtom(), preparedToken);
      storeInstance.set(swapProUserSelectedTokenAtom(), preparedToken);
      storeInstance.set(swapNetworks(), buildSwapNetworks());
    });
    const { result } = renderHook(
      () => useSwapProTokenCarry({ accountNetworkId: 'evm--1' }),
      { wrapper: Wrapper },
    );

    let plan: ReturnType<typeof result.current.prepareProTokenCarryToSwap>;
    act(() => {
      plan = result.current.prepareProTokenCarryToSwap();
    });
    let claimed: boolean | undefined;
    act(() => {
      store.set(swapProSelectTokenAtom(), latestToken);
      store.set(swapProUserSelectedTokenAtom(), latestToken);
      claimed = plan?.claim();
      plan?.apply();
    });

    expect(claimed).toBe(false);
    expect(store.get(swapProUserSelectedTokenAtom())).toBe(latestToken);
    expect(store.get(swapSelectToTokenAtom())).toBeUndefined();
  });
});

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

  it('deduplicates and canonicalizes one bulk classification request', async () => {
    const usdt = buildToken({
      networkId: 'evm--1',
      contractAddress: '0xusdt',
    });
    const uni = buildToken({
      networkId: 'evm--1',
      contractAddress: '0xuni',
    });
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
      fetchSwapStableTokenKeys([uni, usdt, { ...usdt }]),
    ).resolves.toEqual(new Set([stableKey('evm--1', '0xusdt')]));
    expect(mockCheckStableCoinsList).toHaveBeenCalledTimes(1);
    expect(mockCheckStableCoinsList).toHaveBeenCalledWith({
      list: [
        {
          networkId: 'evm--1',
          contractAddressList: ['0xuni', '0xusdt'],
        },
      ],
    });
    expect(buildSwapStableTokenRequestKey([usdt, uni, { ...usdt }])).toBe(
      'evm--1:0xuni|evm--1:0xusdt',
    );
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
