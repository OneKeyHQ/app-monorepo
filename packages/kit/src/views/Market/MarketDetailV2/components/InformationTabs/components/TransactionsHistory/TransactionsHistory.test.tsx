/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, render } from '@testing-library/react';

import type { IMarketTokenTransaction } from '@onekeyhq/shared/types/marketV2';

import { createMockTransaction } from './__tests__/fixtures';
import { TransactionsHistoryBase as TransactionsHistory } from './TransactionsHistory';

const mockUseTransactionsWebSocket: jest.MockedFunction<
  (params: unknown) => void
> = jest.fn();
const mockSetRealtimePauseState = jest.fn();
const mockLoadMore = jest.fn();
const mockAddNewTransaction = jest.fn();
const mockFlushBufferedTransactions = jest.fn();
const mockResumeRealtimeUpdates = jest.fn();
const mockHandleRealtimePauseHoverIn = jest.fn();
const mockHandleRealtimePauseHoverOut = jest.fn();
const mockHandleRealtimePauseTouchStart = jest.fn();
const mockHandleRealtimePauseTouchEnd = jest.fn();
const mockTransactionsRelativeTimeProvider = jest.fn();
const mockMedia = { gtXl: true };
let mockFlatListProps: Record<
  string,
  ((...args: unknown[]) => void) | unknown
> = {};

const mockMarketTransactionsResult = {
  transactions: [] as IMarketTokenTransaction[],
  isRefreshing: false,
  isLoadingMore: false,
  hasMore: false,
  loadMore: mockLoadMore,
  addNewTransaction: mockAddNewTransaction,
  bufferedTransactionsCount: 0,
  hasBufferOverflow: false,
  isRealtimePaused: false,
  flushBufferedTransactions: mockFlushBufferedTransactions,
  resumeRealtimeUpdates: mockResumeRealtimeUpdates,
  handleRealtimePauseHoverIn: mockHandleRealtimePauseHoverIn,
  handleRealtimePauseHoverOut: mockHandleRealtimePauseHoverOut,
  handleRealtimePauseTouchStart: mockHandleRealtimePauseTouchStart,
  handleRealtimePauseTouchEnd: mockHandleRealtimePauseTouchEnd,
};

jest.mock('@onekeyhq/components', () => {
  const Stack = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );

  return {
    __esModule: true,
    SizableText: Stack,
    Spinner: Stack,
    Stack,
    Tabs: {
      FlatList: (props: Record<string, unknown>) => {
        mockFlatListProps = props;
        return <div data-testid="transactions-list" />;
      },
    },
    useCurrentTabScrollY: () => ({ value: 0 }),
    useMedia: () => mockMedia,
  };
});

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => true,
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/marketV2', () => ({
  EMPTY_MARKET_TRANSACTIONS_REALTIME_PAUSE_STATE: {
    isPaused: false,
    bufferedCount: 0,
    hasBufferOverflow: false,
  },
  useMarketTransactionsRealtimePauseAtom: () => [{}, mockSetRealtimePauseState],
}));

jest.mock('@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks', () => ({
  useTokenDetail: () => ({
    websocketConfig: { txs: true },
    isNative: false,
  }),
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('react-native-reanimated', () => ({
  runOnJS: (callback: (...args: unknown[]) => void) => callback,
  useAnimatedReaction: jest.fn(),
}));

jest.mock('use-debounce', () => ({
  useDebouncedCallback: (callback: (...args: unknown[]) => void) => callback,
}));

jest.mock('./components/TransactionRelativeTime', () => ({
  TransactionsRelativeTimeProvider: ({
    children,
    ...props
  }: {
    children?: ReactNode;
  }) => {
    mockTransactionsRelativeTimeProvider(props);
    return <div>{children}</div>;
  },
}));

jest.mock('./components/TransactionsSkeleton', () => ({
  TransactionsSkeleton: () => <div>skeleton</div>,
}));

jest.mock('./hooks/useMarketTransactions', () => ({
  useMarketTransactions: () => mockMarketTransactionsResult,
}));

jest.mock('./hooks/useTransactionsWebSocket', () => ({
  useTransactionsWebSocket: (params: unknown) => {
    mockUseTransactionsWebSocket(params);
  },
}));

jest.mock('./layout/TransactionItemNormal/TransactionItemNormal', () => ({
  TransactionItemNormal: () => <div>normal-item</div>,
}));

jest.mock('./layout/TransactionItemSmall/TransactionItemSmall', () => ({
  TransactionItemSmall: () => <div>small-item</div>,
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNative: false,
    isNativeAndroid: false,
  },
}));

function getMockPlatformEnv() {
  return jest.requireMock('@onekeyhq/shared/src/platformEnv').default as {
    isNative: boolean;
    isNativeAndroid: boolean;
  };
}

describe('TransactionsHistory', () => {
  beforeEach(() => {
    const platformEnv = getMockPlatformEnv();
    mockFlatListProps = {};
    mockSetRealtimePauseState.mockReset();
    mockUseTransactionsWebSocket.mockReset();
    mockLoadMore.mockReset();
    mockAddNewTransaction.mockReset();
    mockFlushBufferedTransactions.mockReset();
    mockResumeRealtimeUpdates.mockReset();
    mockHandleRealtimePauseHoverIn.mockReset();
    mockHandleRealtimePauseHoverOut.mockReset();
    mockHandleRealtimePauseTouchStart.mockReset();
    mockHandleRealtimePauseTouchEnd.mockReset();
    mockTransactionsRelativeTimeProvider.mockReset();
    mockMarketTransactionsResult.transactions = [];
    mockMarketTransactionsResult.isRealtimePaused = false;
    mockMedia.gtXl = true;
    platformEnv.isNative = false;
    platformEnv.isNativeAndroid = false;
  });

  it('keeps realtime pause state outside websocket self-heal callbacks', () => {
    render(
      <TransactionsHistory
        tokenAddress="0xabc"
        networkId="evm--1"
        isTabFocused
      />,
    );

    expect(mockUseTransactionsWebSocket).toHaveBeenCalledTimes(1);

    const websocketParams = mockUseTransactionsWebSocket.mock.calls[0][0];

    expect(websocketParams).toEqual(
      expect.objectContaining({
        networkId: 'evm--1',
        tokenAddress: '0xabc',
        enabled: true,
        onNewTransaction: mockAddNewTransaction,
      }),
    );
    expect(websocketParams).not.toHaveProperty('onSubscriptionRestored');
  });

  it('keeps web hover realtime pause enabled when desktop uses the small transaction list', () => {
    mockMedia.gtXl = false;

    render(
      <TransactionsHistory
        tokenAddress="0xabc"
        networkId="evm--1"
        isTabFocused
      />,
    );

    expect(mockFlatListProps).toEqual(
      expect.objectContaining({
        onMouseEnter: mockHandleRealtimePauseHoverIn,
        onMouseLeave: mockHandleRealtimePauseHoverOut,
      }),
    );
    expect(mockUseTransactionsWebSocket).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
      }),
    );
  });

  it('disables relative time ticking when the transactions tab is hidden', () => {
    mockMarketTransactionsResult.transactions = [createMockTransaction('0xtx')];

    render(
      <TransactionsHistory
        tokenAddress="0xabc"
        networkId="evm--1"
        isTabFocused={false}
      />,
    );

    expect(mockTransactionsRelativeTimeProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        isTickingEnabled: false,
      }),
    );
  });

  it('keeps relative time ticking while realtime transactions are paused', () => {
    mockMarketTransactionsResult.transactions = [createMockTransaction('0xtx')];
    mockMarketTransactionsResult.isRealtimePaused = true;

    render(
      <TransactionsHistory
        tokenAddress="0xabc"
        networkId="evm--1"
        isTabFocused
      />,
    );

    expect(mockTransactionsRelativeTimeProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        isTickingEnabled: true,
      }),
    );
  });

  it('waits for momentum scrolling to finish before resuming realtime updates on native', () => {
    getMockPlatformEnv().isNative = true;

    render(
      <TransactionsHistory
        tokenAddress="0xabc"
        networkId="evm--1"
        isTabFocused
      />,
    );

    expect(mockFlatListProps).toEqual(
      expect.objectContaining({
        onTouchStart: expect.any(Function),
        onTouchEnd: expect.any(Function),
        onScrollBeginDrag: expect.any(Function),
        onScrollEndDrag: expect.any(Function),
        onMomentumScrollBegin: expect.any(Function),
        onMomentumScrollEnd: expect.any(Function),
      }),
    );

    act(() => {
      (mockFlatListProps.onTouchStart as (() => void) | undefined)?.();
      (mockFlatListProps.onScrollBeginDrag as (() => void) | undefined)?.();
      (mockFlatListProps.onTouchEnd as (() => void) | undefined)?.();
    });

    expect(mockHandleRealtimePauseTouchStart).toHaveBeenCalledTimes(1);
    expect(mockResumeRealtimeUpdates).not.toHaveBeenCalled();

    act(() => {
      (mockFlatListProps.onMomentumScrollBegin as (() => void) | undefined)?.();
      (mockFlatListProps.onMomentumScrollEnd as (() => void) | undefined)?.();
    });

    expect(mockResumeRealtimeUpdates).toHaveBeenCalledTimes(1);
  });

  it('resumes native realtime updates when scroll end drag fires before touch end', () => {
    const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = ((callback) => {
      callback(0);
      return 1;
    }) as typeof requestAnimationFrame;
    getMockPlatformEnv().isNative = true;

    try {
      render(
        <TransactionsHistory
          tokenAddress="0xabc"
          networkId="evm--1"
          isTabFocused
        />,
      );

      act(() => {
        (mockFlatListProps.onTouchStart as (() => void) | undefined)?.();
        (mockFlatListProps.onScrollBeginDrag as (() => void) | undefined)?.();
        (
          mockFlatListProps.onScrollEndDrag as
            | ((event: unknown) => void)
            | undefined
        )?.({
          nativeEvent: {
            velocity: {
              y: 0,
            },
          },
        });
        (mockFlatListProps.onTouchEnd as (() => void) | undefined)?.();
      });

      expect(mockResumeRealtimeUpdates).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    }
  });
});
