import { act, renderHook } from '@testing-library/react-native';

import { ESwapTxHistoryStatus } from '@onekeyhq/shared/types/swap/types';
import type { ISwapTxHistory } from '@onekeyhq/shared/types/swap/types';

import {
  matchesFundingIntent,
  resolveEModeFundingState,
  shouldDisarmFundingIntentOnFocus,
  useEModeFundingTx,
} from './useEModeFundingTx';

let mockPendingList: ISwapTxHistory[] = [];

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/InAppNotification', () => ({
  filterSwapHistoryPendingList: (list: unknown[]) => list.filter(Boolean),
  useInAppNotificationAtom: () => [{ swapHistoryPendingList: mockPendingList }],
}));

const NETWORK_ID = 'evm--1';
const ACCOUNT_ID = 'hd-1--m/44/60/0/0/0';
const USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';

const intent = {
  stepKey: 'repay:usdt',
  tokenAddress: USDT.toLowerCase(),
  armedAt: 1000,
  broadcasted: false,
  seen: false,
};

function buildHistory(
  overrides: {
    contractAddress?: string;
    networkId?: string;
    receiverAccountId?: string;
    created?: number;
  } = {},
): ISwapTxHistory {
  const {
    contractAddress = USDT.toLowerCase(),
    networkId = NETWORK_ID,
    receiverAccountId = ACCOUNT_ID,
    created = 2000,
  } = overrides;
  return {
    baseInfo: {
      toToken: { contractAddress, networkId },
    },
    accountInfo: {
      receiver: { accountId: receiverAccountId, networkId },
    },
    date: { created },
  } as unknown as ISwapTxHistory;
}

describe('matchesFundingIntent', () => {
  const match = (history: ISwapTxHistory) =>
    matchesFundingIntent({
      history,
      intent,
      networkId: NETWORK_ID,
      accountId: ACCOUNT_ID,
    });

  it('matches a swap delivering the funding token to this account', () => {
    expect(match(buildHistory())).toBe(true);
  });

  it('ignores address casing, which differs across swap providers', () => {
    expect(match(buildHistory({ contractAddress: USDT }))).toBe(true);
  });

  it('rejects a swap delivering a different token', () => {
    expect(
      match(
        buildHistory({ contractAddress: '0x0000000000000000000000000001' }),
      ),
    ).toBe(false);
  });

  it('rejects a swap landing on another network', () => {
    expect(match(buildHistory({ networkId: 'evm--8453' }))).toBe(false);
  });

  it('rejects a swap received by a different account', () => {
    expect(match(buildHistory({ receiverAccountId: 'hd-1--other' }))).toBe(
      false,
    );
  });

  it('rejects a swap that predates the detour', () => {
    // An unrelated swap already in flight when the user opened this screen must
    // not be mistaken for the top-up and pull them out of wherever they are.
    expect(match(buildHistory({ created: 999 }))).toBe(false);
  });

  it('rejects a swap whose receiver account is unknown', () => {
    // An incomplete history entry cannot safely drive automatic navigation.
    expect(match(buildHistory({ receiverAccountId: '' }))).toBe(false);
  });

  it('matches a native-token top-up, where the address is the empty sentinel', () => {
    expect(
      matchesFundingIntent({
        history: buildHistory({ contractAddress: '' }),
        intent: { ...intent, tokenAddress: '' },
        networkId: NETWORK_ID,
        accountId: ACCOUNT_ID,
      }),
    ).toBe(true);
  });

  it('does not treat a missing toToken address as a native match', () => {
    const history = buildHistory();
    (history.baseInfo.toToken as { contractAddress?: string }).contractAddress =
      undefined;
    expect(
      matchesFundingIntent({
        history,
        intent: { ...intent, tokenAddress: '' },
        networkId: NETWORK_ID,
        accountId: ACCOUNT_ID,
      }),
    ).toBe(false);
  });
});

describe('shouldDisarmFundingIntentOnFocus', () => {
  it('does not disarm on the initial focused render', () => {
    expect(
      shouldDisarmFundingIntentOnFocus({
        isFocused: true,
        previousIsFocused: undefined,
        fundingTxKey: null,
        fundingBroadcasted: false,
      }),
    ).toBe(false);
  });

  it('disarms when a Swap detour returns without a pending transaction', () => {
    expect(
      shouldDisarmFundingIntentOnFocus({
        isFocused: true,
        previousIsFocused: false,
        fundingTxKey: null,
        fundingBroadcasted: false,
      }),
    ).toBe(true);
  });

  it('keeps the intent when the selected Swap has produced a transaction', () => {
    expect(
      shouldDisarmFundingIntentOnFocus({
        isFocused: true,
        previousIsFocused: false,
        fundingTxKey: '0xtx',
        fundingBroadcasted: false,
      }),
    ).toBe(false);
  });

  it('keeps an explicitly broadcast swap while pending history crosses runtimes', () => {
    expect(
      shouldDisarmFundingIntentOnFocus({
        isFocused: true,
        previousIsFocused: false,
        fundingTxKey: null,
        fundingBroadcasted: true,
      }),
    ).toBe(false);
  });

  it('does not disarm while the Swap detour is still covering the page', () => {
    expect(
      shouldDisarmFundingIntentOnFocus({
        isFocused: false,
        previousIsFocused: true,
        fundingTxKey: null,
        fundingBroadcasted: false,
      }),
    ).toBe(false);
  });
});

describe('resolveEModeFundingState', () => {
  const broadcast = { ...intent, broadcasted: true };
  const withStatus = (status: ESwapTxHistoryStatus) =>
    ({ ...buildHistory(), status }) as ISwapTxHistory;
  const resolve = ({
    intent: currentIntent,
    match = null,
    appearanceDeadlinePassed = false,
  }: {
    intent: typeof intent | null;
    match?: ISwapTxHistory | null;
    appearanceDeadlinePassed?: boolean;
  }) =>
    resolveEModeFundingState({
      intent: currentIntent,
      match,
      appearanceDeadlinePassed,
    });

  it('is idle without an armed intent', () => {
    expect(resolve({ intent: null })).toBe('idle');
  });

  it('waits while a broadcast top-up has not reached pending history yet', () => {
    // The bg→UI hop on iOS, Android and the extension is exactly this gap;
    // treating it as an outcome would cancel a live transaction.
    expect(resolve({ intent: broadcast })).toBe('waiting');
  });

  it('is in flight while the matched top-up is still pending', () => {
    expect(
      resolve({
        intent: broadcast,
        match: withStatus(ESwapTxHistoryStatus.PENDING),
      }),
    ).toBe('inFlight');
  });

  it.each([
    ['a failed', ESwapTxHistoryStatus.FAILED],
    ['a canceled', ESwapTxHistoryStatus.CANCELED],
    // Landing successfully is not the same as covering the shortfall: an
    // under-sized swap leaves the step underfunded and needs another top-up.
    ['a successful', ESwapTxHistoryStatus.SUCCESS],
    ['a partially filled', ESwapTxHistoryStatus.PARTIALLY_FILLED],
  ])('resolves on %s top-up', (_label, status) => {
    expect(resolve({ intent: broadcast, match: withStatus(status) })).toBe(
      'resolved',
    );
  });

  it('resolves when a seen top-up is evicted before its status is read', () => {
    // The DB-driven rebuilds keep only PENDING/CANCELING, so a terminal swap
    // can leave the list without the terminal status ever being observed here.
    expect(resolve({ intent: { ...broadcast, seen: true } })).toBe('resolved');
  });

  it('resolves once a broadcast top-up never shows up before the deadline', () => {
    expect(resolve({ intent: broadcast, appearanceDeadlinePassed: true })).toBe(
      'resolved',
    );
  });

  it('keeps waiting past the deadline when the swap was never broadcast', () => {
    // Arming without broadcasting is the Swap-cancelled case; the focus edge
    // disarms it, and resolving here would race that with the deadline.
    expect(resolve({ intent, appearanceDeadlinePassed: true })).toBe('waiting');
  });
});

describe('useEModeFundingTx', () => {
  const STEP_KEY = 'repay:usdt';

  function buildPending(status: ESwapTxHistoryStatus): ISwapTxHistory {
    return {
      ...buildHistory({ created: 10_000 }),
      status,
      txInfo: { txId: '0xtopup' },
    } as unknown as ISwapTxHistory;
  }

  function renderFundingHook() {
    return renderHook(() =>
      useEModeFundingTx({
        networkId: NETWORK_ID,
        accountId: ACCOUNT_ID,
        activeStepKey: STEP_KEY,
        activeFundingAddress: USDT.toLowerCase(),
      }),
    );
  }

  beforeEach(() => {
    mockPendingList = [];
    jest.spyOn(Date, 'now').mockReturnValue(5000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reopens the top-up after the swap reaches a terminal status', () => {
    // Regression: funding used to latch on fundingBroadcasted with no terminal
    // transition, so a failed or under-sized top-up left the page with the
    // footer disabled on the shortfall and Get funds hidden behind `funding` —
    // no affordance at all short of leaving and re-entering the flow.
    const { result, rerender } = renderFundingHook();

    act(() => result.current.armFunding());
    act(() => result.current.markFundingBroadcasted());
    expect(result.current.funding).toBe(true);
    expect(result.current.fundingResolved).toBe(false);

    mockPendingList = [buildPending(ESwapTxHistoryStatus.PENDING)];
    rerender({});
    expect(result.current.fundingTxKey).toBe('0xtopup');
    expect(result.current.fundingResolved).toBe(false);

    mockPendingList = [buildPending(ESwapTxHistoryStatus.FAILED)];
    rerender({});
    expect(result.current.fundingResolved).toBe(true);
    // Still submitted-looking until the consumer disarms, so the card does not
    // flash the warning while the refreshed balance is still in flight.
    expect(result.current.funding).toBe(true);

    act(() => result.current.disarmFunding());
    expect(result.current.funding).toBe(false);
    expect(result.current.fundingResolved).toBe(false);
  });

  it('resolves when a seen top-up is evicted before its terminal status is read', () => {
    const { result, rerender } = renderFundingHook();

    act(() => result.current.armFunding());
    act(() => result.current.markFundingBroadcasted());

    mockPendingList = [buildPending(ESwapTxHistoryStatus.PENDING)];
    rerender({});
    expect(result.current.fundingResolved).toBe(false);

    mockPendingList = [];
    rerender({});
    expect(result.current.fundingResolved).toBe(true);
  });

  it('holds the intent while a broadcast top-up has not appeared yet', () => {
    const { result } = renderFundingHook();

    act(() => result.current.armFunding());
    act(() => result.current.markFundingBroadcasted());

    expect(result.current.funding).toBe(true);
    expect(result.current.fundingResolved).toBe(false);
  });
});
