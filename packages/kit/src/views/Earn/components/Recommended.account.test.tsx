/** @jest-environment jsdom */

import { act, render, screen, waitFor } from '@testing-library/react';

import type { IRecommendAsset } from '@onekeyhq/shared/types/staking';

import { Recommended } from './Recommended';

type ITestAccount = {
  id: string;
  address: string;
  addressDetail: { address: string; normalizedAddress: string };
  connectedAddresses?: Record<string, string>;
  selectedAddress?: Record<string, number>;
};

let mockAccount: ITestAccount | undefined;
let mockIndexedAccount: { id: string } | undefined;
let mockEarnState: {
  recommendedTokens: IRecommendAsset[];
  recommendedTokensScope?: string;
  refreshTrigger: number;
};
const mockFetch = jest.fn<Promise<{ tokens: IRecommendAsset[] }>, [unknown]>();
const mockUpdate = jest.fn((tokens: IRecommendAsset[], scope?: string) => {
  mockEarnState = {
    ...mockEarnState,
    recommendedTokens: tokens,
    recommendedTokensScope: scope,
  };
});
const mockActions = { current: { updateRecommendedTokens: mockUpdate } };

jest.mock('@onekeyhq/components', () => {
  const deferredModule = jest.requireActual<
    typeof import('../../../../../components/src/hooks/useDeferredPromise')
  >('../../../../../components/src/hooks/useDeferredPromise');
  return {
    getCurrentVisibilityState: () => true,
    onVisibilityStateChange: () => () => undefined,
    useDeferredPromise: deferredModule.useDeferredPromise,
    useNetInfo: () => ({ isRawInternetReachable: true }),
  };
});
jest.mock('../../../hooks/useRouteIsFocused', () => ({
  useRouteIsFocusedWhenEnabled: () => true,
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStaking: {
      fetchAllNetworkAssetsV2: (params: unknown) => mockFetch(params),
    },
  },
}));
jest.mock('../../../states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({
    activeAccount: { account: mockAccount, indexedAccount: mockIndexedAccount },
  }),
}));
jest.mock('../../../states/jotai/contexts/earn', () => ({
  useEarnActions: () => mockActions,
  useEarnAtom: () => [mockEarnState],
}));
jest.mock('./RecommendedSection', () => ({
  RecommendedSection: ({
    tokens,
    showSkeleton,
  }: {
    tokens: IRecommendAsset[];
    showSkeleton: boolean;
  }) => (
    <div>
      <div data-testid="recommendations">
        {tokens
          .map((item) => `${item.symbol}:${item.available.text}`)
          .join('|')}
      </div>
      {showSkeleton ? <div data-testid="skeleton" /> : null}
    </div>
  ),
}));

function account(id: string, address: string): ITestAccount {
  return {
    id,
    address,
    addressDetail: { address, normalizedAddress: address },
  };
}

function token(symbol: string, balance: string): IRecommendAsset {
  return {
    name: symbol,
    symbol,
    logoURI: '',
    protocols: [{ networkId: 'evm--1', provider: 'native' }],
    aprWithoutFee: '1',
    aprInfo: {},
    bgColor: '$bg',
    available: { text: balance, color: '$text' },
    isRecommended: true,
    isPinedRecommend: false,
    badges: [],
  };
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

describe('Recommended account ownership', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockUpdate.mockClear();
    mockAccount = account('account-a', '0xaaa');
    mockIndexedAccount = undefined;
    mockEarnState = { recommendedTokens: [], refreshTrigger: 0 };
  });

  it('does not show account A data while account B loads', async () => {
    const next = deferred<{ tokens: IRecommendAsset[] }>();
    mockFetch
      .mockResolvedValueOnce({ tokens: [token('ETH', 'A balance')] })
      .mockReturnValueOnce(next.promise);
    const view = render(<Recommended />);
    await waitFor(() =>
      expect(screen.getByTestId('recommendations').textContent).toContain(
        'A balance',
      ),
    );

    mockAccount = account('account-b', '0xbbb');
    view.rerender(<Recommended />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId('recommendations').textContent).not.toContain(
      'A balance',
    );

    await act(async () =>
      next.resolve({ tokens: [token('ETH', 'B balance')] }),
    );
    await waitFor(() =>
      expect(screen.getByTestId('recommendations').textContent).toContain(
        'B balance',
      ),
    );
  });

  it('invalidates the result when an account keeps its ID but changes address', async () => {
    const next = deferred<{ tokens: IRecommendAsset[] }>();
    mockFetch
      .mockResolvedValueOnce({ tokens: [token('ETH', 'A balance')] })
      .mockReturnValueOnce(next.promise);
    const view = render(<Recommended />);
    await waitFor(() =>
      expect(screen.getByTestId('recommendations').textContent).toContain(
        'A balance',
      ),
    );

    mockAccount = account('account-a', '0xbbb');
    view.rerender(<Recommended />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId('recommendations').textContent).not.toContain(
      'A balance',
    );
    await act(async () =>
      next.resolve({ tokens: [token('ETH', 'B balance')] }),
    );
    await waitFor(() =>
      expect(screen.getByTestId('recommendations').textContent).toContain(
        'B balance',
      ),
    );
  });

  it('invalidates an external account when its selected address changes', async () => {
    const next = deferred<{ tokens: IRecommendAsset[] }>();
    mockAccount = {
      ...account('external-account', ''),
      connectedAddresses: { 'evm--1': '0xaaa,0xbbb' },
      selectedAddress: { 'evm--1': 0 },
    };
    mockFetch
      .mockResolvedValueOnce({ tokens: [token('ETH', 'A balance')] })
      .mockReturnValueOnce(next.promise);
    const view = render(<Recommended />);
    await waitFor(() =>
      expect(screen.getByTestId('recommendations').textContent).toContain(
        'A balance',
      ),
    );

    mockAccount = { ...mockAccount, selectedAddress: { 'evm--1': 1 } };
    view.rerender(<Recommended />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId('recommendations').textContent).not.toContain(
      'A balance',
    );
    await act(async () =>
      next.resolve({ tokens: [token('ETH', 'B balance')] }),
    );
    await waitFor(() =>
      expect(screen.getByTestId('recommendations').textContent).toContain(
        'B balance',
      ),
    );
  });

  it('does not use a legacy persisted cache with no account scope', async () => {
    mockEarnState = {
      recommendedTokens: [token('ETH', 'old balance')],
      refreshTrigger: 0,
    };
    const next = deferred<{ tokens: IRecommendAsset[] }>();
    mockFetch.mockReturnValue(next.promise);
    render(<Recommended />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('recommendations').textContent).not.toContain(
      'old balance',
    );
    await act(async () => next.resolve({ tokens: [] }));
  });

  it('keeps account B when the older account A request finishes last', async () => {
    const first = deferred<{ tokens: IRecommendAsset[] }>();
    const next = deferred<{ tokens: IRecommendAsset[] }>();
    mockFetch
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(next.promise);
    const view = render(<Recommended />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    mockAccount = account('account-b', '0xbbb');
    view.rerender(<Recommended />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    await act(async () =>
      next.resolve({ tokens: [token('WETH', 'B balance')] }),
    );
    await waitFor(() =>
      expect(screen.getByTestId('recommendations').textContent).toContain(
        'B balance',
      ),
    );
    await act(async () =>
      first.resolve({ tokens: [token('ETH', 'A balance')] }),
    );

    expect(screen.getByTestId('recommendations').textContent).toBe(
      'WETH:B balance',
    );
    expect(mockEarnState.recommendedTokens[0]?.available.text).toBe(
      'B balance',
    );
  });

  it('does not replace account B when an older account request fails offline', async () => {
    const first = deferred<{ tokens: IRecommendAsset[] }>();
    const next = deferred<{ tokens: IRecommendAsset[] }>();
    mockFetch
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(next.promise);
    const view = render(<Recommended />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    mockAccount = account('account-b', '0xbbb');
    view.rerender(<Recommended />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    await act(async () =>
      next.resolve({ tokens: [token('WETH', 'B balance')] }),
    );
    await waitFor(() =>
      expect(screen.getByTestId('recommendations').textContent).toContain(
        'B balance',
      ),
    );
    await act(async () => first.reject(new Error('network unavailable')));

    expect(screen.getByTestId('recommendations').textContent).toBe(
      'WETH:B balance',
    );
    expect(mockEarnState.recommendedTokens[0]?.available.text).toBe(
      'B balance',
    );
  });

  it('keeps same-account data during explicit refresh and persists updated balances', async () => {
    const refresh = deferred<{ tokens: IRecommendAsset[] }>();
    mockFetch
      .mockResolvedValueOnce({ tokens: [token('ETH', 'old balance')] })
      .mockReturnValueOnce(refresh.promise);
    const view = render(<Recommended />);
    await waitFor(() =>
      expect(screen.getByTestId('recommendations').textContent).toContain(
        'old balance',
      ),
    );
    await waitFor(() =>
      expect(mockEarnState.recommendedTokensScope).toBeDefined(),
    );

    mockEarnState = { ...mockEarnState, refreshTrigger: 1 };
    view.rerender(<Recommended />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId('recommendations').textContent).toContain(
      'old balance',
    );

    await act(async () =>
      refresh.resolve({ tokens: [token('ETH', 'new balance')] }),
    );
    await waitFor(() =>
      expect(mockEarnState.recommendedTokens[0]?.available.text).toBe(
        'new balance',
      ),
    );
    expect(screen.getByTestId('recommendations').textContent).toBe(
      'ETH:new balance',
    );
  });

  it('restores only a matching account cache while its next request is pending', async () => {
    mockFetch.mockResolvedValueOnce({
      tokens: [token('ETH', 'saved balance')],
    });
    const first = render(<Recommended />);
    await waitFor(() =>
      expect(mockEarnState.recommendedTokensScope).toBeDefined(),
    );
    first.unmount();
    const pending = deferred<{ tokens: IRecommendAsset[] }>();
    mockFetch.mockReturnValueOnce(pending.promise);
    render(<Recommended />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId('recommendations').textContent).toBe(
      'ETH:saved balance',
    );
    await act(async () => pending.resolve({ tokens: [] }));
  });

  it('does not display an account cache when no account is selected', async () => {
    mockFetch.mockResolvedValueOnce({
      tokens: [token('ETH', 'private balance')],
    });
    const view = render(<Recommended />);
    await waitFor(() =>
      expect(mockEarnState.recommendedTokensScope).toBeDefined(),
    );
    const pending = deferred<{ tokens: IRecommendAsset[] }>();
    mockFetch.mockReturnValueOnce(pending.promise);
    mockAccount = undefined;
    view.rerender(<Recommended />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId('recommendations').textContent).not.toContain(
      'private balance',
    );
    expect(mockFetch).toHaveBeenLastCalledWith(undefined);
    await act(async () => pending.resolve({ tokens: [] }));
  });

  it('passes an indexed account without a concrete account ID', async () => {
    mockAccount = undefined;
    mockIndexedAccount = { id: 'indexed-a' };
    mockFetch.mockResolvedValue({ tokens: [token('ETH', 'indexed balance')] });
    render(<Recommended />);
    await waitFor(() =>
      expect(screen.getByTestId('recommendations').textContent).toContain(
        'indexed balance',
      ),
    );
    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: '', indexedAccountId: 'indexed-a' }),
    );
  });

  it('keeps the server order and clears scoped cached data for a successful empty result', async () => {
    mockFetch
      .mockResolvedValueOnce({
        tokens: [token('USDT', '1'), token('ETH', '2')],
      })
      .mockResolvedValueOnce({ tokens: [] });
    const view = render(<Recommended />);
    await waitFor(() =>
      expect(screen.getByTestId('recommendations').textContent).toBe(
        'USDT:1|ETH:2',
      ),
    );
    await waitFor(() =>
      expect(mockEarnState.recommendedTokens).toHaveLength(2),
    );
    mockEarnState = { ...mockEarnState, refreshTrigger: 1 };
    view.rerender(<Recommended />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(mockEarnState.recommendedTokens).toHaveLength(0),
    );
    expect(screen.getByTestId('recommendations').textContent).toBe('');
  });

  it('reuses a recent result for the same account after returning to the screen', async () => {
    mockFetch.mockResolvedValue({ tokens: [token('ETH', 'balance')] });
    const view = render(<Recommended isActive />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByTestId('recommendations').textContent).toContain(
        'balance',
      ),
    );
    view.rerender(<Recommended isActive={false} />);
    view.rerender(<Recommended isActive />);
    await waitFor(() =>
      expect(screen.getByTestId('recommendations').textContent).toContain(
        'balance',
      ),
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('revalidates the same account after the focus cache expires', async () => {
    mockFetch.mockResolvedValue({ tokens: [token('ETH', 'balance')] });
    const view = render(<Recommended isActive />);
    await waitFor(() =>
      expect(screen.getByTestId('recommendations').textContent).toContain(
        'balance',
      ),
    );
    const later = Date.now() + 31_000;
    const clock = jest.spyOn(Date, 'now').mockReturnValue(later);
    try {
      view.rerender(<Recommended isActive={false} />);
      view.rerender(<Recommended isActive />);
      await waitFor(() =>
        expect(mockFetch.mock.calls.length).toBeGreaterThan(1),
      );
    } finally {
      clock.mockRestore();
    }
  });
});
