/* eslint-disable import/first */

import { act, renderHook } from '@testing-library/react-native';

import type { IUserFunding } from '@onekeyhq/shared/types/hyperliquid';

const mockGetUserFundingHistory = jest.fn<
  Promise<IUserFunding[]>,
  [{ accountAddress: string }]
>();
let mockAccountAddress: string | undefined = '0xAbC';
let mockIsFocused = true;

jest.mock('@onekeyhq/components', () => ({
  getCurrentVisibilityState: () => true,
  onVisibilityStateChange: () => () => {},
  useDeferredPromise: jest.requireActual<
    typeof import('../../../../../components/src/hooks/useDeferredPromise')
  >('../../../../../components/src/hooks/useDeferredPromise')
    .useDeferredPromise,
  useNetInfo: () => ({ isRawInternetReachable: true }),
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false, isWeb: true, isRuntimeBrowser: true },
}));

jest.mock('@onekeyhq/shared/src/utils/swrCacheUtils', () => ({
  swrCacheUtils: {},
}));

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => mockIsFocused,
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid', () => ({
  useActiveTradeInstrumentAtom: () => [{ mode: 'perp' }],
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsActiveAccountAtom: () => [{ accountAddress: mockAccountAddress }],
}));

jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({}));
jest.mock('../../../hooks/useListenTabFocusState', () => jest.fn());
jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHyperliquid: {
      getUserFundingHistory: (args: { accountAddress: string }) =>
        mockGetUserFundingHistory(args),
    },
  },
}));

import { usePerpUserFundingHistory } from './usePerpOrderInfoPanel';

const HOUR = 60 * 60 * 1000;
const fundingRecord: IUserFunding = {
  time: 1,
  hash: `0x${'1'.repeat(64)}`,
  delta: {
    type: 'funding',
    coin: 'BTC',
    usdc: '1',
    szi: '2',
    fundingRate: '0.0001',
    nSamples: null,
  },
};

async function advanceTime(milliseconds = 0) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(milliseconds);
  });
}

describe('funding history refresh lifecycle', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockGetUserFundingHistory.mockReset();
    mockGetUserFundingHistory.mockResolvedValue([fundingRecord]);
    mockAccountAddress = '0xAbC';
    mockIsFocused = true;
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('updates new settlements while the view remains open', async () => {
    const { result } = renderHook(() => usePerpUserFundingHistory());
    await advanceTime();
    expect(result.current.records).toEqual([fundingRecord]);

    const nextRecord = { ...fundingRecord, time: 2 };
    mockGetUserFundingHistory.mockResolvedValue([fundingRecord, nextRecord]);
    await advanceTime(HOUR - 1);
    expect(mockGetUserFundingHistory).toHaveBeenCalledTimes(1);
    await advanceTime(1);
    expect(mockGetUserFundingHistory).toHaveBeenCalledTimes(2);
    expect(result.current.records).toEqual([fundingRecord, nextRecord]);

    await advanceTime(HOUR);
    expect(mockGetUserFundingHistory).toHaveBeenCalledTimes(3);
  });

  it.each([{ records: [] }, { records: [fundingRecord] }])(
    'keeps successful history visible while refreshing and after failure: %j',
    async ({ records }) => {
      mockGetUserFundingHistory.mockResolvedValue(records);
      const { result } = renderHook(() => usePerpUserFundingHistory());
      await advanceTime();
      let rejectRefresh: (error: Error) => void = () => {};
      mockGetUserFundingHistory.mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            rejectRefresh = reject;
          }),
      );
      await advanceTime(HOUR);
      expect(result.current.records).toEqual(records);
      expect(result.current.isLoading).toBe(false);
      await act(async () => {
        rejectRefresh(new Error('network unavailable'));
      });
      expect(result.current.records).toEqual(records);
      expect(result.current.isError).toBe(false);
      expect(result.current.isLoading).toBe(false);
      const nextRecord = { ...fundingRecord, time: 2 };
      mockGetUserFundingHistory.mockResolvedValue([nextRecord]);
      await advanceTime(HOUR);
      expect(result.current.records).toEqual([nextRecord]);
    },
  );

  it('reports initial failures and never falls back to another account history', async () => {
    const { result, rerender } = renderHook(() => usePerpUserFundingHistory());
    await advanceTime();
    mockGetUserFundingHistory.mockRejectedValue(
      new Error('network unavailable'),
    );
    mockAccountAddress = '0xDef';
    rerender(undefined);
    expect(result.current.records).toEqual([]);
    expect(result.current.isLoading).toBe(true);
    await advanceTime();
    expect(result.current.records).toEqual([]);
    expect(result.current.isError).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });

  it('restarts the delay after refocus instead of accumulating refreshes', async () => {
    const { rerender } = renderHook(() => usePerpUserFundingHistory());
    await advanceTime();
    await advanceTime(HOUR / 2);
    mockIsFocused = false;
    rerender(undefined);
    mockIsFocused = true;
    rerender(undefined);
    await advanceTime();
    expect(mockGetUserFundingHistory).toHaveBeenCalledTimes(2);

    await advanceTime(HOUR / 2);
    expect(mockGetUserFundingHistory).toHaveBeenCalledTimes(2);
    await advanceTime(HOUR / 2);
    expect(mockGetUserFundingHistory).toHaveBeenCalledTimes(3);
  });

  it('skips refreshes while blurred and recovers on focus', async () => {
    const { rerender } = renderHook(() => usePerpUserFundingHistory());
    await advanceTime();
    mockIsFocused = false;
    rerender(undefined);
    await advanceTime(HOUR * 2);
    expect(mockGetUserFundingHistory).toHaveBeenCalledTimes(1);

    mockIsFocused = true;
    rerender(undefined);
    await advanceTime();
    expect(mockGetUserFundingHistory).toHaveBeenCalledTimes(2);
    await advanceTime(HOUR);
    expect(mockGetUserFundingHistory).toHaveBeenCalledTimes(3);
  });

  it('does not request inactive, disconnected, or unmounted views', async () => {
    const { rerender, unmount } = renderHook<
      ReturnType<typeof usePerpUserFundingHistory>,
      { isActive: boolean }
    >(({ isActive }) => usePerpUserFundingHistory({ isActive }), {
      initialProps: { isActive: false },
    });
    await advanceTime(HOUR * 2);
    expect(mockGetUserFundingHistory).not.toHaveBeenCalled();

    rerender({ isActive: true });
    await advanceTime();
    expect(mockGetUserFundingHistory).toHaveBeenCalledTimes(1);
    rerender({ isActive: false });
    await advanceTime(HOUR);
    expect(mockGetUserFundingHistory).toHaveBeenCalledTimes(1);

    mockAccountAddress = undefined;
    rerender({ isActive: true });
    await advanceTime(HOUR);
    expect(mockGetUserFundingHistory).toHaveBeenCalledTimes(1);

    mockAccountAddress = '0xDef';
    rerender({ isActive: true });
    await advanceTime();
    expect(mockGetUserFundingHistory).toHaveBeenCalledTimes(2);
    unmount();
    await advanceTime(HOUR);
    expect(mockGetUserFundingHistory).toHaveBeenCalledTimes(2);
  });

  it('ignores an old account refresh that finishes after switching accounts', async () => {
    const { result, rerender } = renderHook(() => usePerpUserFundingHistory());
    await advanceTime();
    let finishOldRefresh: (records: IUserFunding[]) => void = () => {};
    mockGetUserFundingHistory.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOldRefresh = resolve;
        }),
    );
    await advanceTime(HOUR);
    expect(mockGetUserFundingHistory).toHaveBeenCalledTimes(2);
    await advanceTime(HOUR * 2);
    expect(mockGetUserFundingHistory).toHaveBeenCalledTimes(2);

    mockAccountAddress = '0xDef';
    const newAccountRecord = { ...fundingRecord, time: 3 };
    mockGetUserFundingHistory.mockResolvedValue([newAccountRecord]);
    rerender(undefined);
    await advanceTime();
    await act(async () => {
      finishOldRefresh([fundingRecord, { ...fundingRecord, time: 2 }]);
    });
    expect(result.current.accountAddress).toBe('0xdef');
    expect(result.current.records).toEqual([newAccountRecord]);
    await advanceTime(HOUR);
    expect(mockGetUserFundingHistory).toHaveBeenCalledTimes(4);
    expect(mockGetUserFundingHistory).toHaveBeenLastCalledWith({
      accountAddress: '0xDef',
    });
  });
});
