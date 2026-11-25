/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import {
  EStrk20ErrorCode,
  type IStrk20HistoryCursor,
} from '@onekeyhq/shared/types/starknetPrivacy';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import { useStarknetPrivateHistory } from './useStarknetPrivateHistory';

type IPage = {
  txs: IAccountHistoryTx[];
  discoveryTxIds?: string[];
  hasMore: boolean;
  isEnabled?: boolean;
  cursor?: IStrk20HistoryCursor;
};
const mockRead = jest.fn<Promise<IPage>, [object]>();
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStarknetPrivacy: {
      fetchPrivateHistory: async (params: object) => {
        const page = await mockRead(params);
        return {
          ...page,
          discoveryTxIds:
            page.discoveryTxIds ?? page.txs.map((item) => item.id),
        };
      },
    },
  },
}));
jest.mock('@onekeyhq/components', () => ({
  getCurrentVisibilityState: () => true,
  onVisibilityStateChange: () => () => undefined,
  useNetInfo: () => ({ isInternetReachable: true }),
  useDeferredPromise:
    // eslint-disable-next-line import-path/parent-depth -- The package alias maps to a component stub in Jest.
    (
      jest.requireActual(
        '../../../../../components/src/hooks/useDeferredPromise',
      ) as typeof import('@onekeyhq/components/src/hooks/useDeferredPromise')
    ).useDeferredPromise,
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false, isWeb: true, isRuntimeBrowser: true },
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocusedWhenEnabled: () => true,
}));

const scope = {
  accountId: 'test-account',
  networkId: 'starknet--mainnet',
  tokenAddress: '0x1',
  focused: true,
};
const cursor = { cursorId: 'first-page-cursor' };
const tx = (id: string): IAccountHistoryTx => ({
  id,
  isLocalCreated: false,
  decodedTx: {
    txid: id,
    owner: '0x1',
    signer: '0x1',
    nonce: 0,
    actions: [],
    extraInfo: null,
    status: EDecodedTxStatus.Confirmed,
    accountId: scope.accountId,
    networkId: scope.networkId,
  },
});
const tick = async () => {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(500);
  });
};
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockRead.mockResolvedValue({ txs: [tx('0x1')], hasMore: true, cursor });
});
afterEach(() => jest.useRealTimers());

it('paginates the private cursor and deduplicates overlapping rows', async () => {
  const ui = renderHook(() => useStarknetPrivateHistory(scope));
  await tick();
  mockRead.mockResolvedValueOnce({
    txs: [tx('0x1'), tx('0x2')],
    hasMore: false,
  });
  await act(async () => ui.result.current.loadMore());
  expect(mockRead.mock.calls[1][0]).toMatchObject({
    tokenAddress: scope.tokenAddress,
    cursor,
  });
  expect(ui.result.current.txs.map((item) => item.id)).toEqual(['0x1', '0x2']);
  expect(ui.result.current.hasMore).toBe(false);
});

it('keeps the cursor and existing rows when a later page fails', async () => {
  const ui = renderHook(() => useStarknetPrivateHistory(scope));
  await tick();
  mockRead.mockRejectedValueOnce(new Error('Discovery unavailable'));
  await act(async () => ui.result.current.loadMore());
  expect(ui.result.current.txs).toHaveLength(1);
  expect(ui.result.current.moreErrorKey).toBeDefined();
  expect(ui.result.current.hasMore).toBe(true);
});

it('ignores a late page after switching accounts', async () => {
  const ui = renderHook(
    ({ accountId }) => useStarknetPrivateHistory({ ...scope, accountId }),
    { initialProps: { accountId: scope.accountId } },
  );
  await tick();
  let finish!: (page: IPage) => void;
  mockRead.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  let loading!: Promise<void>;
  act(() => {
    loading = ui.result.current.loadMore();
  });
  mockRead.mockResolvedValue({ txs: [tx('0x3')], hasMore: false });
  ui.rerender({ accountId: 'another-account' });
  await tick();
  await act(async () => {
    finish({ txs: [tx('0x2')], hasMore: false });
    await loading;
  });
  expect(ui.result.current.txs.map((item) => item.id)).toEqual(['0x3']);
});

it('does not mistake an empty intermediate page for complete history', async () => {
  mockRead.mockResolvedValueOnce({ txs: [], hasMore: true, cursor });
  const ui = renderHook(() => useStarknetPrivateHistory(scope));
  await tick();
  expect(ui.result.current.hasMore).toBe(true);
  await act(async () => ui.result.current.loadMore());
  expect(ui.result.current.txs).toHaveLength(1);
});

it('keeps loaded rows when a first-page refresh fails', async () => {
  const ui = renderHook(() => useStarknetPrivateHistory(scope));
  await tick();
  mockRead.mockRejectedValueOnce(new Error('Discovery unavailable'));
  act(() => ui.result.current.reload());
  await tick();
  expect(ui.result.current.txs.map((item) => item.id)).toEqual(['0x1']);
  expect(ui.result.current.errorKey).toBeDefined();
});

it('preserves loaded pages and their cursor across an overlapping refresh', async () => {
  const ui = renderHook(() => useStarknetPrivateHistory(scope));
  await tick();
  mockRead.mockResolvedValueOnce({ txs: [tx('0x2')], hasMore: false });
  await act(async () => ui.result.current.loadMore());
  mockRead.mockResolvedValueOnce({
    txs: [tx('0x3'), tx('0x1')],
    hasMore: true,
    cursor,
  });
  act(() => ui.result.current.reload());
  await tick();
  expect(ui.result.current.txs.map((item) => item.id)).toEqual([
    '0x3',
    '0x1',
    '0x2',
  ]);
  expect(ui.result.current.hasMore).toBe(false);
});

it('starts a new remote range when only a confirmed local row overlaps', async () => {
  const local = { ...tx('0x44'), isLocalCreated: true };
  mockRead.mockResolvedValueOnce({
    txs: [local, tx('0x21')],
    discoveryTxIds: ['0x21'],
    hasMore: true,
    cursor,
  });
  const ui = renderHook(() => useStarknetPrivateHistory(scope));
  await tick();
  mockRead.mockResolvedValueOnce({
    txs: [local, tx('0x10')],
    discoveryTxIds: ['0x10'],
    hasMore: false,
  });
  await act(async () => ui.result.current.loadMore());
  expect(ui.result.current.hasMore).toBe(false);
  mockRead.mockResolvedValueOnce({
    txs: [local, tx('0x30')],
    discoveryTxIds: ['0x30'],
    hasMore: true,
    cursor,
  });
  act(() => ui.result.current.reload());
  await tick();
  expect(ui.result.current.hasMore).toBe(true);
  expect(ui.result.current.txs).toEqual([local, tx('0x30')]);
  await act(async () => ui.result.current.loadMore());
  expect(mockRead).toHaveBeenLastCalledWith(
    expect.objectContaining({ cursor }),
  );
});

describe.each(['first page', 'later page'] as const)(
  'access changes on the %s',
  (source) => {
    it.each([
      EStrk20ErrorCode.Locked,
      EStrk20ErrorCode.KeyMismatch,
      EStrk20ErrorCode.Unavailable,
      'disabled',
    ] as const)('clears all rows and the cursor on %s', async (reason) => {
      const ui = renderHook(() => useStarknetPrivateHistory(scope));
      await tick();
      if (reason === 'disabled') {
        mockRead.mockResolvedValueOnce({
          txs: [],
          hasMore: false,
          isEnabled: false,
        });
      } else {
        mockRead.mockRejectedValueOnce({
          data: { starknetPrivacyErrorCode: reason },
        });
      }
      if (source === 'first page') {
        act(() => ui.result.current.reload());
        await tick();
      } else {
        await act(async () => ui.result.current.loadMore());
      }
      expect(ui.result.current.txs).toEqual([]);
      expect(ui.result.current.hasMore).toBe(false);
      if (reason === 'disabled')
        expect(ui.result.current.isEnabled).toBe(false);
      else expect(ui.result.current.errorCode).toBe(reason);
      mockRead.mockRejectedValueOnce(new Error('Discovery unavailable'));
      act(() => ui.result.current.reload());
      await tick();
      expect(ui.result.current.txs).toEqual([]);
      mockRead.mockResolvedValueOnce({ txs: [tx('0x3')], hasMore: false });
      act(() => ui.result.current.reload());
      await tick();
      expect(ui.result.current.txs.map((item) => item.id)).toEqual(['0x3']);
    });
  },
);

it('discards a first page started before access was revoked during pagination', async () => {
  const ui = renderHook(() => useStarknetPrivateHistory(scope));
  await tick();
  let finish!: (page: IPage) => void;
  mockRead.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  act(() => ui.result.current.reload());
  await tick();
  mockRead.mockRejectedValueOnce({
    data: { starknetPrivacyErrorCode: EStrk20ErrorCode.KeyMismatch },
  });
  await act(async () => ui.result.current.loadMore());
  await act(async () => {
    finish({ txs: [tx('0x2')], hasMore: false });
  });
  expect(ui.result.current.txs).toEqual([]);
  expect(ui.result.current.errorCode).toBe(EStrk20ErrorCode.KeyMismatch);
});

it('silently reloads the first page once on unlock and ignores an older locked response', async () => {
  const old = Promise.withResolvers<IPage>();
  mockRead.mockReturnValueOnce(old.promise);
  const ui = renderHook(() => useStarknetPrivateHistory(scope));
  await tick();
  expect(mockRead).toHaveBeenCalledTimes(1);
  act(() => {
    appEventBus.emit(EAppEventBusNames.UnlockApp, undefined);
  });
  await tick();
  expect(ui.result.current.txs.map((item) => item.id)).toEqual(['0x1']);
  act(() => {
    appEventBus.emit(EAppEventBusNames.UnlockApp, undefined);
  });
  await act(async () => {
    old.reject({ data: { starknetPrivacyErrorCode: EStrk20ErrorCode.Locked } });
  });
  await tick();
  expect(mockRead).toHaveBeenCalledTimes(2);
  expect(mockRead.mock.lastCall?.[0]).toEqual({
    accountId: scope.accountId,
    networkId: scope.networkId,
    tokenAddress: scope.tokenAddress,
    cursor: undefined,
  });
  expect(ui.result.current.errorCode).toBeUndefined();
  expect(ui.result.current.txs).toHaveLength(1);
});

it('waits for the private tab to regain focus after unlock', async () => {
  const ui = renderHook(
    ({ focused }) => useStarknetPrivateHistory({ ...scope, focused }),
    { initialProps: { focused: false } },
  );
  await tick();
  act(() => {
    appEventBus.emit(EAppEventBusNames.UnlockApp, undefined);
  });
  await tick();
  expect(mockRead).not.toHaveBeenCalled();
  ui.rerender({ focused: true });
  await tick();
  expect(mockRead).toHaveBeenCalledTimes(1);
});

it('does not start history discovery for a disabled account on unlock', async () => {
  mockRead.mockResolvedValue({ txs: [], hasMore: false, isEnabled: false });
  const ui = renderHook(() => useStarknetPrivateHistory(scope));
  await tick();
  expect(ui.result.current.isEnabled).toBe(false);
  act(() => {
    appEventBus.emit(EAppEventBusNames.UnlockApp, undefined);
  });
  await tick();
  expect(mockRead).toHaveBeenCalledTimes(1);
});

it('deduplicates local-id pending rows against bare-hash discovered rows on overlapping refresh', async () => {
  const localPending: IAccountHistoryTx = {
    ...tx('0x01'),
    id: 'local_starknet--mainnet_0x1_0x01',
    isLocalCreated: true,
    decodedTx: {
      ...tx('0x01').decodedTx,
      txid: '0x01',
      status: EDecodedTxStatus.Pending,
    },
  };
  mockRead.mockResolvedValueOnce({
    txs: [localPending],
    discoveryTxIds: ['0x1'],
    hasMore: true,
    cursor,
  });
  const ui = renderHook(() => useStarknetPrivateHistory(scope));
  await tick();
  mockRead.mockResolvedValueOnce({
    txs: [tx('0x2')],
    hasMore: false,
  });
  await act(async () => ui.result.current.loadMore());
  mockRead.mockResolvedValueOnce({
    txs: [tx('0x1')],
    discoveryTxIds: ['0x1'],
    hasMore: true,
    cursor,
  });
  act(() => ui.result.current.reload());
  await tick();
  expect(ui.result.current.txs).toHaveLength(2);
  expect(ui.result.current.txs[0].id).toBe('0x1');
  expect(ui.result.current.txs[0].decodedTx.status).toBe(
    EDecodedTxStatus.Confirmed,
  );
});

it('resets retained range and reloads a fresh page when the background cursor was evicted', async () => {
  const freshCursor = { cursorId: 'fresh-cursor' };
  const ui = renderHook(() => useStarknetPrivateHistory(scope));
  await tick();
  mockRead.mockResolvedValueOnce({
    txs: [],
    hasMore: false,
    isEnabled: true,
    cursorExpired: true,
  } as IPage & { cursorExpired: boolean });
  mockRead.mockResolvedValueOnce({
    txs: [tx('0x9')],
    hasMore: true,
    cursor: freshCursor,
  });
  await act(async () => ui.result.current.loadMore());
  await tick();
  expect(ui.result.current.txs.map((item) => item.id)).toEqual(['0x9']);
  expect(ui.result.current.hasMore).toBe(true);
});
