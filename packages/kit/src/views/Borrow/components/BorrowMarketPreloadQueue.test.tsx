/* eslint-disable import/first */

type IMockImageSession = {
  scopeKey: string;
  enqueue: jest.Mock;
  cancel: jest.Mock;
};
const mockImageSessions: IMockImageSession[] = [];
const mockWorkerMounts = jest.fn();
const mockWorkerUnmounts = jest.fn();
let mockReservesResult:
  | { scopeKey: string; data: { overview?: object; supply: { assets: [] } } }
  | undefined;
let mockReservesLoading: boolean | undefined;

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => {
    const React = jest.requireActual<typeof import('react')>('react');
    React.useEffect(() => {
      mockWorkerMounts();
      return () => {
        mockWorkerUnmounts();
      };
    }, []);
    return { result: mockReservesResult, isLoading: mockReservesLoading };
  },
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useSelectedAccount: () => ({ selectedAccount: {} }),
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    WalletClear: 'WalletClear',
    AccountRemove: 'AccountRemove',
    AccountUpdate: 'AccountUpdate',
    GlobalDeriveTypeUpdate: 'GlobalDeriveTypeUpdate',
    NetworkDeriveTypeChanged: 'NetworkDeriveTypeChanged',
  },
  appEventBus: { on: jest.fn(), off: jest.fn() },
}));
jest.mock('@onekeyhq/shared/src/utils/swrCacheUtils', () => ({
  swrKeys: { borrowReserves: () => 'reserves-key' },
  swrCacheUtils: { getWithTimestamp: () => undefined },
}));
jest.mock('../hooks/useBorrowReserves', () => ({
  useBorrowReserves: () => ({ fetchReserves: jest.fn() }),
  isBorrowReservesCacheReusable: () => true,
  isBorrowReservesPayloadUsable: (value?: { overview?: object }) =>
    Boolean(value?.overview),
}));
jest.mock('./borrowImagePrewarm', () => ({
  createBorrowImagePrewarmSession: (scopeKey: string) => {
    const session: IMockImageSession = {
      scopeKey,
      enqueue: jest.fn(),
      cancel: jest.fn(),
    };
    mockImageSessions.push(session);
    return session;
  },
  getBorrowVisibleAssetIconSources: () => [
    { uri: 'https://example.com/target-token.png', resizeWidth: 32 },
  ],
}));

import { act, render } from '@testing-library/react-native';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IBorrowMarketItem } from '@onekeyhq/shared/types/staking';

import { buildBorrowMarketKey } from '../borrowMarketKey';

import { BORROW_MARKET_PRELOAD_SUCCESS_TTL } from './borrowMarketPreload.utils';
import { BorrowMarketPreloadQueue } from './BorrowMarketPreloadQueue';

const visibleMarket = {
  provider: 'aave',
  networkId: 'evm--1',
  marketAddress: '0xVisible',
} as IBorrowMarketItem;
const targetMarket = {
  provider: 'aave',
  networkId: 'evm--42161',
  marketAddress: '0xTarget',
} as IBorrowMarketItem;
const queueProps = {
  markets: [visibleMarket, targetMarket],
  visibleMarketKey: buildBorrowMarketKey(visibleMarket),
  accountScopeKey: 'account-a',
};

describe('BorrowMarketPreloadQueue image ownership', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockWorkerMounts.mockClear();
    mockWorkerUnmounts.mockClear();
    mockImageSessions.length = 0;
    mockReservesResult = {
      scopeKey: 'aave-evm--42161-0xTarget-public',
      data: { overview: {}, supply: { assets: [] } },
    };
    mockReservesLoading = false;
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('requeues unfinished target images after the page becomes active again', () => {
    const screen = render(
      <BorrowMarketPreloadQueue {...queueProps} enabled canStartNextMarket />,
    );
    act(() => jest.advanceTimersByTime(500));

    expect(mockImageSessions).toHaveLength(1);
    const firstSession = mockImageSessions[0];
    const imageSources = [
      { uri: 'https://example.com/target-token.png', resizeWidth: 32 },
    ];
    expect(firstSession.enqueue).toHaveBeenCalledWith(
      expect.any(String),
      imageSources,
    );
    const completionKey = firstSession.enqueue.mock.calls[0][0];

    screen.rerender(
      <BorrowMarketPreloadQueue
        {...queueProps}
        enabled={false}
        canStartNextMarket={false}
      />,
    );
    expect(firstSession.cancel).toHaveBeenCalledTimes(1);

    screen.rerender(
      <BorrowMarketPreloadQueue {...queueProps} enabled canStartNextMarket />,
    );
    expect(mockImageSessions).toHaveLength(2);
    expect(mockImageSessions[1].enqueue).toHaveBeenCalledWith(
      completionKey,
      imageSources,
    );
  });

  it('restarts the public preload session when the account changes in place', () => {
    const onSpy = jest.spyOn(appEventBus, 'on');
    const screen = render(
      <BorrowMarketPreloadQueue {...queueProps} enabled canStartNextMarket />,
    );
    const firstSession = mockImageSessions[0];
    const onAccountUpdate = onSpy.mock.calls.find(
      ([event]) => event === EAppEventBusNames.AccountUpdate,
    )?.[1];

    expect(onAccountUpdate).toBeDefined();
    act(() => onAccountUpdate?.(undefined));

    expect(firstSession.cancel).toHaveBeenCalledTimes(1);
    expect(mockImageSessions).toHaveLength(2);
    expect(mockImageSessions[1].scopeKey).not.toBe(firstSession.scopeKey);
    screen.unmount();
    onSpy.mockRestore();
  });

  it('waits 500ms after Ready and keeps an in-flight worker during Refreshing', () => {
    mockReservesLoading = true;
    const screen = render(
      <BorrowMarketPreloadQueue
        {...queueProps}
        enabled
        canStartNextMarket={false}
      />,
    );
    act(() => jest.advanceTimersByTime(1000));
    expect(mockWorkerMounts).not.toHaveBeenCalled();

    screen.rerender(
      <BorrowMarketPreloadQueue {...queueProps} enabled canStartNextMarket />,
    );
    act(() => jest.advanceTimersByTime(499));
    expect(mockWorkerMounts).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1));
    expect(mockWorkerMounts).toHaveBeenCalledTimes(1);

    screen.rerender(
      <BorrowMarketPreloadQueue
        {...queueProps}
        enabled
        canStartNextMarket={false}
      />,
    );
    expect(mockWorkerUnmounts).not.toHaveBeenCalled();
  });

  it('unmounts background work during a foreground market transition', () => {
    mockReservesLoading = true;
    const screen = render(
      <BorrowMarketPreloadQueue {...queueProps} enabled canStartNextMarket />,
    );
    act(() => jest.advanceTimersByTime(500));
    expect(mockWorkerMounts).toHaveBeenCalledTimes(1);

    screen.rerender(
      <BorrowMarketPreloadQueue
        {...queueProps}
        enabled
        canStartNextMarket={false}
        isMarketChangePending
      />,
    );
    expect(mockWorkerUnmounts).toHaveBeenCalledTimes(1);
    screen.unmount();
  });

  it('retries an unsuccessful market after backoff', () => {
    mockReservesResult = undefined;
    const screen = render(
      <BorrowMarketPreloadQueue {...queueProps} enabled canStartNextMarket />,
    );
    act(() => jest.advanceTimersByTime(500));
    expect(mockWorkerMounts).toHaveBeenCalledTimes(1);
    expect(mockWorkerUnmounts).toHaveBeenCalledTimes(1);

    act(() => jest.advanceTimersByTime(4999));
    expect(mockWorkerMounts).toHaveBeenCalledTimes(1);
    act(() => jest.advanceTimersByTime(1));
    expect(mockWorkerMounts).toHaveBeenCalledTimes(2);
    screen.unmount();
  });

  it('does not treat a malformed hydrated reserves result as preloaded', () => {
    mockReservesResult = {
      scopeKey: 'aave-evm--42161-0xTarget-public',
      data: { supply: { assets: [] } },
    };
    const screen = render(
      <BorrowMarketPreloadQueue {...queueProps} enabled canStartNextMarket />,
    );
    act(() => jest.advanceTimersByTime(500));

    expect(mockWorkerMounts).toHaveBeenCalledTimes(1);
    expect(mockWorkerUnmounts).toHaveBeenCalledTimes(1);
    expect(mockImageSessions[0].enqueue).not.toHaveBeenCalled();

    act(() => jest.advanceTimersByTime(5000));
    expect(mockWorkerMounts).toHaveBeenCalledTimes(2);
    screen.unmount();
  });

  it('refreshes a successfully preloaded market after its TTL', () => {
    const screen = render(
      <BorrowMarketPreloadQueue {...queueProps} enabled canStartNextMarket />,
    );
    act(() => jest.advanceTimersByTime(500));
    expect(mockWorkerMounts).toHaveBeenCalledTimes(1);
    expect(mockWorkerUnmounts).toHaveBeenCalledTimes(1);

    act(() => jest.advanceTimersByTime(BORROW_MARKET_PRELOAD_SUCCESS_TTL - 1));
    expect(mockWorkerMounts).toHaveBeenCalledTimes(1);
    act(() => jest.advanceTimersByTime(1));
    expect(mockWorkerMounts).toHaveBeenCalledTimes(2);
    screen.unmount();
  });
});
