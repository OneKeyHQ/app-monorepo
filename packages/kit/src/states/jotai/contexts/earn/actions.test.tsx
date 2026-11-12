/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, renderHook } from '@testing-library/react';
import { createStore } from 'jotai';

import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import type { IEarnPermitCache } from '@onekeyhq/shared/types/earn';
import type { IRecommendAsset } from '@onekeyhq/shared/types/staking';

import { useEarnActions } from './actions';
import {
  ProviderJotaiContextEarn,
  basicEarnAtom,
  earnPermitCacheAtom,
  earnStorageReadyAtom,
  useEarnAtom,
} from './atoms';

type IGetEarnData = () => Promise<Record<string, never>>;
type ISetRawData = (payload: Record<string, unknown>) => void;

const mockGetEarnData: jest.MockedFunction<IGetEarnData> = jest.fn(
  async () => ({}),
);
const mockSetRawData: jest.MockedFunction<ISetRawData> = jest.fn();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    simpleDb: {
      earn: {
        getEarnData: () => mockGetEarnData(),
        setRawData: (payload: Record<string, unknown>) =>
          mockSetRawData(payload),
      },
    },
  },
}));

function createWrapper(permitCache?: IEarnPermitCache) {
  const store = createStore();
  store.set(earnStorageReadyAtom(), true);
  if (permitCache) {
    store.set(earnPermitCacheAtom(), {
      [earnUtils.getEarnPermitCacheKey(permitCache)]: permitCache,
    });
  }
  store.set(basicEarnAtom(), {
    earnAccount: {},
    availableAssetsByType: {},
    recommendedTokens: [],
    refreshTrigger: 0,
  });

  return function Wrapper({ children }: { children?: ReactNode }) {
    return (
      <ProviderJotaiContextEarn store={store}>
        {children}
      </ProviderJotaiContextEarn>
    );
  };
}

describe('useEarnActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('increments the available-assets refresh trigger when triggerRefresh runs', async () => {
    const { result } = renderHook(
      () => {
        const actions = useEarnActions().current;
        const [earnState] = useEarnAtom();

        return {
          actions,
          earnState,
        };
      },
      {
        wrapper: createWrapper(),
      },
    );

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.actions.triggerRefresh();
    });

    expect(result.current.earnState.refreshTrigger).toBe(1);
    expect(mockSetRawData).toHaveBeenCalledWith(
      expect.objectContaining({
        refreshTrigger: 1,
      }),
    );
  });

  it('writes recommendation tokens and their account scope together', async () => {
    const tokens: IRecommendAsset[] = [
      {
        name: 'Ether',
        symbol: 'ETH',
        logoURI: '',
        protocols: [{ networkId: 'evm--1', provider: 'native' }],
        aprWithoutFee: '1',
        aprInfo: {},
        bgColor: '$bg',
        available: { text: '10', color: '$text' },
        isRecommended: true,
        isPinedRecommend: false,
        badges: [],
      },
    ];
    const { result } = renderHook(
      () => {
        const actions = useEarnActions().current;
        const [earnState] = useEarnAtom();
        return { actions, earnState };
      },
      { wrapper: createWrapper() },
    );
    await act(async () => {
      await Promise.resolve();
    });

    act(() =>
      result.current.actions.updateRecommendedTokens(tokens, 'scope-a'),
    );

    expect(result.current.earnState.recommendedTokens).toEqual(tokens);
    expect(result.current.earnState.recommendedTokensScope).toBe('scope-a');
    expect(mockSetRawData).toHaveBeenLastCalledWith(
      expect.objectContaining({
        recommendedTokens: tokens,
        recommendedTokensScope: 'scope-a',
      }),
    );
  });

  it('does not reuse EtherFi permits across deposit attempts', () => {
    const { result } = renderHook(() => useEarnActions().current, {
      wrapper: createWrapper(),
    });
    const key = {
      accountId: 'account',
      networkId: 'evm--1',
      providerName: 'EtherFi',
      approveSpenderAddress: '0xspender',
      tokenAddress: '0xtoken',
      amount: '1',
    };
    act(() => {
      result.current.updatePermitCache({
        ...key,
        signature: 'signature',
        expiredAt: Date.now() + 60_000,
      });
    });
    expect(result.current.getPermitCache(key)).toBeNull();
  });

  it('ignores an EtherFi permit already present in the cache', () => {
    const permit = {
      accountId: 'account',
      networkId: 'evm--1',
      providerName: 'etherfi',
      approveSpenderAddress: '0xspender',
      tokenAddress: '0xtoken',
      amount: '1',
      signature: 'stale-signature',
      expiredAt: Date.now() + 60_000,
    };
    const { result } = renderHook(() => useEarnActions().current, {
      wrapper: createWrapper(permit),
    });
    expect(result.current.getPermitCache(permit)).toBeNull();
  });

  it('keeps caching permits for providers using the existing flow', () => {
    const { result } = renderHook(() => useEarnActions().current, {
      wrapper: createWrapper(),
    });
    const key = {
      accountId: 'account',
      networkId: 'evm--1',
      providerName: 'Morpho',
      approveSpenderAddress: '0xspender',
      tokenAddress: '0xtoken',
      amount: '1',
    };
    act(() => {
      result.current.updatePermitCache({
        ...key,
        signature: 'signature',
        expiredAt: Date.now() + 60_000,
      });
    });
    expect(result.current.getPermitCache(key)?.signature).toBe('signature');
  });

  it('removes only the matching old Permit and keeps a newer same-key signature', () => {
    const { result } = renderHook(() => useEarnActions().current, {
      wrapper: createWrapper(),
    });
    const key = {
      accountId: 'account',
      networkId: 'evm--1',
      providerName: 'Morpho',
      approveSpenderAddress: '0xspender',
      tokenAddress: '0xtoken',
      amount: '1',
    };
    const old = {
      ...key,
      accountAddress: '0xowner',
      signature: 'old',
      expiredAt: Date.now() + 60_000,
    };
    act(() => result.current.updatePermitCache(old));
    act(() =>
      result.current.removePermitCache({
        ...key,
        expectedSignature: 'old',
        expectedAccountAddress: '0xowner',
      }),
    );
    expect(result.current.getPermitCache(key)).toBeNull();
    act(() => result.current.updatePermitCache({ ...old, signature: 'new' }));
    act(() =>
      result.current.removePermitCache({
        ...key,
        expectedSignature: 'new',
        expectedAccountAddress: '0xother',
      }),
    );
    expect(result.current.getPermitCache(key)?.signature).toBe('new');
    act(() =>
      result.current.removePermitCache({
        ...key,
        expectedSignature: 'old',
        expectedAccountAddress: '0xowner',
      }),
    );
    expect(result.current.getPermitCache(key)?.signature).toBe('new');
    act(() => result.current.removePermitCache(key));
    expect(result.current.getPermitCache(key)).toBeNull();
  });
});
