/* eslint-disable import/first */

import { renderHook } from '@testing-library/react-native';

import type { IUserFunding } from '@onekeyhq/shared/types/hyperliquid';

const mockRun = jest.fn();
const mockGetUserFundingHistory = jest.fn<
  Promise<IUserFunding[]>,
  [{ accountAddress: string }]
>();
type IMockFundingHistoryResult = {
  accountAddress: string | undefined;
  records: IUserFunding[];
  isError?: boolean;
};
type IMockPromiseResultReturn = {
  result: IMockFundingHistoryResult;
  isLoading: boolean;
  run: typeof mockRun;
  setResult: jest.Mock;
  setStopPolling: jest.Mock;
};
const mockUsePromiseResult = jest.fn<IMockPromiseResultReturn, unknown[]>();
let mockCurrentAccount: { accountAddress?: string } = {
  accountAddress: '0xAbC',
};
let mockQueryResult: IMockFundingHistoryResult = {
  accountAddress: '0xabc',
  records: [],
};

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (...args: unknown[]) => mockUsePromiseResult(...args),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid', () => ({
  useActiveTradeInstrumentAtom: () => [{ mode: 'perp' }],
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsActiveAccountAtom: () => [mockCurrentAccount],
  usePerpsTradesHistoryDataAtom: jest.fn(),
  usePerpsTradesHistoryRefreshHookAtom: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  openUrlExternal: jest.fn(),
  openUrlInApp: jest.fn(),
}));

jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHyperliquid: {
      getUserFundingHistory: (args: { accountAddress: string }) =>
        mockGetUserFundingHistory(args),
    },
  },
}));

jest.mock('../../../hooks/useListenTabFocusState', () => jest.fn());

import { usePerpUserFundingHistory } from './usePerpOrderInfoPanel';

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

describe('usePerpUserFundingHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentAccount = { accountAddress: '0xAbC' };
    mockQueryResult = {
      accountAddress: '0xabc',
      records: [fundingRecord],
    };
    mockUsePromiseResult.mockImplementation(() => ({
      result: mockQueryResult,
      isLoading: false,
      run: mockRun,
      setResult: jest.fn(),
      setStopPolling: jest.fn(),
    }));
  });

  it('keeps the account-scoped result while the info-panel tab is inactive', () => {
    const { result, rerender } = renderHook<
      ReturnType<typeof usePerpUserFundingHistory>,
      { isActive: boolean }
    >(({ isActive }) => usePerpUserFundingHistory({ isActive }), {
      initialProps: { isActive: true },
    });

    expect(result.current.accountAddress).toBe('0xabc');
    expect(result.current.records).toEqual([fundingRecord]);
    expect(mockUsePromiseResult.mock.calls.at(-1)?.[1]).toEqual(['0xAbC']);

    rerender({ isActive: false });

    expect(result.current.accountAddress).toBe('0xabc');
    expect(result.current.records).toEqual([fundingRecord]);
    expect(mockUsePromiseResult.mock.calls.at(-1)?.[1]).toEqual(['0xAbC']);
    const inactiveOptions = mockUsePromiseResult.mock.calls.at(-1)?.[2] as {
      overrideIsFocused: (isFocused: boolean) => boolean;
    };
    expect(inactiveOptions.overrideIsFocused(true)).toBe(false);

    rerender({ isActive: true });

    const activeOptions = mockUsePromiseResult.mock.calls.at(-1)?.[2] as {
      overrideIsFocused: (isFocused: boolean) => boolean;
      revalidateOnFocus: boolean;
    };
    expect(activeOptions.overrideIsFocused(true)).toBe(true);
    expect(activeOptions.revalidateOnFocus).toBe(true);
    expect(result.current.records).toEqual([fundingRecord]);
  });

  it('requests the complete funding history for the active account', async () => {
    mockGetUserFundingHistory.mockResolvedValue([fundingRecord]);

    renderHook(() => usePerpUserFundingHistory());

    const queryFn = mockUsePromiseResult.mock.calls.at(-1)?.[0] as
      | (() => Promise<IMockFundingHistoryResult>)
      | undefined;

    expect(queryFn).toBeDefined();
    await expect(queryFn?.()).resolves.toEqual({
      accountAddress: '0xabc',
      records: [fundingRecord],
      isError: false,
    });
    expect(mockGetUserFundingHistory).toHaveBeenCalledWith({
      accountAddress: '0xAbC',
    });
  });

  it('exposes request failures separately from empty history', async () => {
    mockGetUserFundingHistory.mockRejectedValue(
      new Error('funding history unavailable'),
    );

    renderHook(() => usePerpUserFundingHistory());

    const queryFn = mockUsePromiseResult.mock.calls.at(-1)?.[0] as
      | (() => Promise<IMockFundingHistoryResult>)
      | undefined;

    await expect(queryFn?.()).resolves.toEqual({
      accountAddress: '0xabc',
      records: [],
      isError: true,
    });

    mockQueryResult = {
      accountAddress: '0xabc',
      records: [],
      isError: true,
    };
    const { result } = renderHook(() => usePerpUserFundingHistory());

    expect(result.current.isError).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });

  it('hides the previous account result when the account changes while inactive', () => {
    const { result, rerender } = renderHook<
      ReturnType<typeof usePerpUserFundingHistory>,
      { isActive: boolean }
    >(({ isActive }) => usePerpUserFundingHistory({ isActive }), {
      initialProps: { isActive: true },
    });

    expect(result.current.records).toEqual([fundingRecord]);

    mockCurrentAccount = { accountAddress: '0xDef' };
    rerender({ isActive: false });

    expect(result.current.accountAddress).toBe('0xdef');
    expect(result.current.records).toEqual([]);
    expect(result.current.isLoading).toBe(true);
    expect(mockUsePromiseResult.mock.calls.at(-1)?.[1]).toEqual(['0xDef']);
  });
});
