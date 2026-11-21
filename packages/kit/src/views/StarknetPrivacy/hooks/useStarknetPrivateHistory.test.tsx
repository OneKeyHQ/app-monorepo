/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import { useStarknetPrivateHistory } from './useStarknetPrivateHistory';

type IPage = {
  txs: IAccountHistoryTx[];
  hasMore: boolean;
  cursor?: { subchannels: []; historyComplete: boolean };
};
const mockRead = jest.fn<Promise<IPage>, [object]>();
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStarknetPrivacy: {
      fetchPrivateHistory: (params: object) => mockRead(params),
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
const cursor = { subchannels: [] as [], historyComplete: false };
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
    cursor: { subchannels: [], historyComplete: true },
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
