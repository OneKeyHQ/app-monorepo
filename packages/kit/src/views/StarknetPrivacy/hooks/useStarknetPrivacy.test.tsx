/** @jest-environment jsdom */
/* eslint-disable import/first */
import { type PropsWithChildren, StrictMode } from 'react';

import { act, renderHook } from '@testing-library/react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EStrk20ErrorCode,
  EStrk20OptInStatus,
  EStrk20SequencingStatus,
} from '@onekeyhq/shared/types/starknetPrivacy';
import type { IStrk20PrivateBalances } from '@onekeyhq/shared/types/starknetPrivacy';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

const mockSequencing = jest.fn<
  Promise<{ status: EStrk20SequencingStatus }>,
  []
>();
const mockAvailable = jest.fn(async () => true);
const mockReadState = jest.fn(async () => ({
  optInStatus: EStrk20OptInStatus.Consented,
}));
type IBalanceSnapshot = IStrk20PrivateBalances & { lastSyncedAt: number };
const mockReadBalances = jest.fn<Promise<IBalanceSnapshot>, [object]>();
const mockReadCachedBalances = jest.fn<
  Promise<IBalanceSnapshot | undefined>,
  [object]
>();
const mockToastError = jest.fn<void, [{ title: string }]>();
let mockFocused = true;
const mockFocusListeners = new Set<() => void>();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStarknetPrivacy: {
      getSequencingState: () => mockSequencing(),
      isPrivacyAvailable: () => mockAvailable(),
      getPrivacyConfig: async () => ({}),
      getAccountPrivacyState: () => mockReadState(),
      getCachedPrivateBalances: (params: object) =>
        mockReadCachedBalances(params),
      getPrivateBalances: (params: object) =>
        mockReadBalances({ ...params, allowPrompt: false }),
      refreshPrivateBalances: (params: object) => mockReadBalances(params),
    },
  },
}));
jest.mock('@onekeyhq/components', () => ({
  Toast: { error: (options: { title: string }) => mockToastError(options) },
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
jest.mock('react-intl', () => {
  const intl = { formatMessage: ({ id }: { id: string }) => id };
  return { useIntl: () => intl };
});
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false, isWeb: true, isRuntimeBrowser: true },
}));
jest.mock('@onekeyhq/shared/src/errors/utils/errorUtils', () => ({
  __esModule: true,
  default: {
    isErrorByClassName: ({
      error,
      className,
    }: {
      error: { name?: string };
      className: string[];
    }) => className.includes(error?.name ?? ''),
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => {
  const reactModule = require('react') as typeof import('react');
  return {
    useRouteIsFocusedWhenEnabled: ({ enabled }: { enabled: boolean }) =>
      reactModule.useSyncExternalStore(
        (callback) => {
          mockFocusListeners.add(callback);
          return () => {
            mockFocusListeners.delete(callback);
          };
        },
        () => (enabled ? mockFocused : true),
      ),
  };
});

import {
  useStarknetPrivacyAccountState,
  useStarknetPrivacyAvailability,
  useStarknetPrivacySequencing,
  useStarknetPrivateBalances,
} from './useStarknetPrivacy';

const account = { networkId: 'starknet--mainnet', accountId: 'test-account' };
const balances: IBalanceSnapshot = {
  byToken: {},
  noteCount: 0,
  blockNumber: 100,
  lastSyncedAt: 123,
};
const tick = async (ms = 500) => {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
};
const setFocused = (focused: boolean) => {
  act(() => {
    mockFocused = focused;
    for (const listener of mockFocusListeners) listener();
  });
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockFocused = true;
  mockReadState.mockResolvedValue({
    optInStatus: EStrk20OptInStatus.Consented,
  });
  mockReadBalances.mockResolvedValue(balances);
  mockReadCachedBalances.mockResolvedValue(undefined);
});
afterEach(() => {
  jest.useRealTimers();
});

it('refreshes availability only on network configuration changes or focus', async () => {
  renderHook(() => useStarknetPrivacyAvailability(account));
  await tick();
  mockAvailable.mockClear();
  act(() => {
    appEventBus.emit(EAppEventBusNames.HistoryTxStatusChanged, undefined);
    appEventBus.emit(EAppEventBusNames.CustomRpcChanged, {
      networkIds: ['another-network'],
    });
  });
  await tick();
  expect(mockAvailable).not.toHaveBeenCalled();
  await act(() =>
    appEventBus.emit(EAppEventBusNames.CustomRpcChanged, {
      networkIds: [account.networkId],
    }),
  );
  await tick();
  expect(mockAvailable).toHaveBeenCalledTimes(1);
  await act(() =>
    appEventBus.emit(EAppEventBusNames.AddedCustomNetwork, undefined),
  );
  await tick();
  expect(mockAvailable).toHaveBeenCalledTimes(2);
  setFocused(false);
  setFocused(true);
  await tick();
  expect(mockAvailable).toHaveBeenCalledTimes(3);
});

it('stops polling a ready account, and resumes while its next confirmed transaction is cooling down', async () => {
  mockSequencing.mockResolvedValue({ status: EStrk20SequencingStatus.Ready });
  const ui = renderHook(() => useStarknetPrivacySequencing(account));
  await tick();
  expect(ui.result.current.sequencing?.status).toBe(
    EStrk20SequencingStatus.Ready,
  );
  mockSequencing.mockClear();
  const confirmed = {
    ...account,
    txid: '0x1',
    status: EDecodedTxStatus.Confirmed,
  };
  await act(() =>
    appEventBus.emit(EAppEventBusNames.LocalPendingTxConfirmed, {
      ...confirmed,
      accountId: 'another-account',
    }),
  );
  await tick(20_000);
  expect(mockSequencing).not.toHaveBeenCalled();
  mockSequencing.mockResolvedValueOnce({
    status: EStrk20SequencingStatus.Waiting,
  });
  await act(() =>
    appEventBus.emit(EAppEventBusNames.LocalPendingTxConfirmed, confirmed),
  );
  await tick();
  expect(ui.result.current.sequencing?.status).toBe(
    EStrk20SequencingStatus.Waiting,
  );
  await tick(10_000);
  expect(ui.result.current.sequencing?.status).toBe(
    EStrk20SequencingStatus.Ready,
  );
  await tick(20_000);
  expect(mockSequencing).toHaveBeenCalledTimes(2);
});

it('refreshes after the confirm modal closes even when its callback ran while blurred', async () => {
  const ui = renderHook(() => useStarknetPrivacyAccountState(account));
  await tick();
  expect(ui.result.current.state?.optInStatus).toBe(
    EStrk20OptInStatus.Consented,
  );
  setFocused(false);
  mockReadState.mockResolvedValue({
    optInStatus: EStrk20OptInStatus.RegisterPending,
  });
  act(() => ui.result.current.reload());
  await tick();
  expect(mockReadState).toHaveBeenCalledTimes(1);
  setFocused(true);
  await tick();
  expect(ui.result.current.state?.optInStatus).toBe(
    EStrk20OptInStatus.RegisterPending,
  );
  mockReadState.mockResolvedValue({
    optInStatus: EStrk20OptInStatus.Registered,
  });
  await tick(10_500);
  expect(ui.result.current.state?.optInStatus).toBe(
    EStrk20OptInStatus.Registered,
  );
});

it('only asks to unlock after an explicit refresh, never on a background read', async () => {
  mockReadBalances.mockRejectedValueOnce({
    key: ETranslations.privacy_balance_verification_pending__msg,
    data: { starknetPrivacyErrorCode: EStrk20ErrorCode.Locked },
  });
  const ui = renderHook(() =>
    useStarknetPrivateBalances({ ...account, tokenAddress: '0x1' }),
  );
  await tick();
  expect(mockReadBalances.mock.calls[0][0]).toMatchObject({
    allowPrompt: false,
  });
  expect(ui.result.current.errorKey).toBe(
    ETranslations.privacy_balance_verification_pending__msg,
  );
  act(() => {
    ui.result.current.reload();
    ui.result.current.reload();
  });
  await tick();
  expect(mockReadBalances).toHaveBeenCalledTimes(2);
  expect(mockReadBalances.mock.calls[1][0]).toMatchObject({
    allowPrompt: true,
  });
  expect(ui.result.current.balances).toEqual(balances);
});

it('refreshes an expired viewing key in one action and updates history', async () => {
  const ui = renderHook(() =>
    useStarknetPrivateBalances({ ...account, tokenAddress: '0x1' }),
  );
  await tick();
  expect(ui.result.current.balances?.blockNumber).toBe(100);
  const lockedError = Object.assign(new Error('Viewing key unavailable'), {
    key: ETranslations.privacy_balance_verification_pending__msg,
    data: { starknetPrivacyErrorCode: EStrk20ErrorCode.Locked },
  });
  mockReadBalances.mockImplementation((params) =>
    'allowPrompt' in params && params.allowPrompt === true
      ? Promise.resolve({ ...balances, blockNumber: 101 })
      : Promise.reject(lockedError),
  );
  const historyEvent = jest.spyOn(appEventBus, 'emit');
  try {
    act(() => ui.result.current.reload());
    await tick();
    expect(ui.result.current.balances?.blockNumber).toBe(101);
    expect(ui.result.current.errorKey).toBeUndefined();
    expect(historyEvent).toHaveBeenCalledWith(
      EAppEventBusNames.HistoryTxStatusChanged,
      undefined,
    );
  } finally {
    historyEvent.mockRestore();
  }
});

it('does not carry an unlock request into another account', async () => {
  mockReadBalances.mockRejectedValueOnce({
    key: ETranslations.privacy_balance_verification_pending__msg,
    data: { starknetPrivacyErrorCode: EStrk20ErrorCode.Locked },
  });
  const ui = renderHook(
    ({ accountId }) =>
      useStarknetPrivateBalances({
        ...account,
        accountId,
        tokenAddress: '0x1',
      }),
    { initialProps: { accountId: account.accountId } },
  );
  await tick();
  setFocused(false);
  act(() => ui.result.current.reload());
  await tick();
  ui.rerender({ accountId: 'other-account' });
  setFocused(true);
  await tick();
  expect(mockReadBalances.mock.calls.at(-1)?.[0]).toMatchObject({
    accountId: 'other-account',
    allowPrompt: false,
  });
});

it('resumes account-scoped reads when retained effects reconnect', async () => {
  const wrapper = ({ children }: PropsWithChildren) => (
    <StrictMode>{children}</StrictMode>
  );
  const ui = renderHook(
    ({ tokenAddress }) =>
      useStarknetPrivateBalances({ ...account, tokenAddress }),
    { initialProps: { tokenAddress: '0x1' }, wrapper },
  );
  await tick();
  expect(ui.result.current.balances?.blockNumber).toBe(100);
  mockReadBalances.mockResolvedValue({ ...balances, blockNumber: 200 });
  ui.rerender({ tokenAddress: '0x2' });
  await tick();
  expect(ui.result.current.balances?.blockNumber).toBe(200);
  expect(mockReadBalances.mock.calls.at(-1)?.[0]).toMatchObject({
    tokenAddresses: ['0x2'],
    allowPrompt: false,
  });
});

it('reads immediately when registration enables balance polling', async () => {
  mockReadBalances.mockRejectedValue({
    key: ETranslations.privacy_balance_verification_pending__msg,
    data: { starknetPrivacyErrorCode: EStrk20ErrorCode.Locked },
  });
  const ui = renderHook(
    ({ enabled }) =>
      useStarknetPrivateBalances({
        ...account,
        tokenAddress: '0x1',
        enabled,
      }),
    { initialProps: { enabled: false } },
  );
  await tick();
  expect(mockReadBalances).not.toHaveBeenCalled();
  ui.rerender({ enabled: true });
  await tick();
  expect(mockReadBalances).toHaveBeenCalledTimes(1);
  expect(ui.result.current.errorKey).toBe(
    ETranslations.privacy_balance_verification_pending__msg,
  );
  expect(ui.result.current.isLoading).toBe(false);
});

it('reads the balance without a prompt when the app is unlocked', async () => {
  mockReadBalances.mockRejectedValueOnce({
    data: { starknetPrivacyErrorCode: EStrk20ErrorCode.Locked },
  });
  const ui = renderHook(() =>
    useStarknetPrivateBalances({ ...account, tokenAddress: '0x1' }),
  );
  await tick();
  expect(ui.result.current.errorCode).toBe(EStrk20ErrorCode.Locked);

  act(() => {
    void appEventBus.emit(EAppEventBusNames.UnlockApp, undefined);
  });
  await tick();
  expect(ui.result.current.balances?.blockNumber).toBe(100);
  expect(ui.result.current.errorCode).toBeUndefined();
  expect(mockReadBalances.mock.calls.at(-1)?.[0]).toMatchObject({
    allowPrompt: false,
  });
});

it('keeps the last loaded balance when a network refresh fails', async () => {
  const ui = renderHook(() =>
    useStarknetPrivateBalances({ ...account, tokenAddress: '0x1' }),
  );
  await tick();
  const lastSyncedAt = ui.result.current.lastSyncedAt;
  mockReadBalances.mockRejectedValueOnce(new Error('Discovery unavailable'));
  act(() => ui.result.current.refreshSilently());
  await tick();
  expect(ui.result.current.balances).toEqual(balances);
  expect(ui.result.current.lastSyncedAt).toBe(lastSyncedAt);
  expect(ui.result.current.errorKey).toBeDefined();
  expect(mockToastError).not.toHaveBeenCalled();
});

it('shows one sync error toast after a manual refresh fails with a reorg', async () => {
  const ui = renderHook(() =>
    useStarknetPrivateBalances({ ...account, tokenAddress: '0x1' }),
  );
  await tick();
  mockReadBalances.mockRejectedValueOnce({ name: 'ReorgError' });
  act(() => ui.result.current.reload());
  await tick();
  expect(mockToastError).toHaveBeenCalledTimes(1);
  expect(mockToastError).toHaveBeenCalledWith({
    title: ETranslations.global_sync_error,
  });
  expect(ui.result.current.balances).toEqual(balances);
});

it('shows the cached balance while Discovery is still refreshing on re-entry', async () => {
  mockReadCachedBalances.mockResolvedValue(balances);
  const { promise, resolve } = Promise.withResolvers<IBalanceSnapshot>();
  mockReadBalances.mockReturnValueOnce(promise);
  const ui = renderHook(() =>
    useStarknetPrivateBalances({ ...account, tokenAddress: '0x1' }),
  );
  await tick();
  expect(ui.result.current.balances).toEqual(balances);
  expect(ui.result.current.lastSyncedAt).toBe(balances.lastSyncedAt);
  expect(ui.result.current.isRefreshing).toBe(false);

  const next = { ...balances, blockNumber: 101, lastSyncedAt: 456 };
  resolve(next);
  await tick();
  expect(ui.result.current.balances).toEqual(next);
});

it('keeps a cached balance visible when the viewing key has expired', async () => {
  mockReadCachedBalances.mockResolvedValue(balances);
  mockReadBalances.mockRejectedValueOnce({
    key: ETranslations.privacy_balance_verification_pending__msg,
    data: { starknetPrivacyErrorCode: EStrk20ErrorCode.Locked },
  });
  const ui = renderHook(() =>
    useStarknetPrivateBalances({ ...account, tokenAddress: '0x1' }),
  );
  await tick();
  expect(ui.result.current.errorCode).toBe(EStrk20ErrorCode.Locked);
  expect(ui.result.current.balances).toEqual(balances);
});

it('clears protected balance data when the app locks', async () => {
  const ui = renderHook(() =>
    useStarknetPrivateBalances({ ...account, tokenAddress: '0x1' }),
  );
  await tick();
  mockReadBalances.mockRejectedValue({
    key: ETranslations.privacy_balance_verification_pending__msg,
    data: { starknetPrivacyErrorCode: EStrk20ErrorCode.Locked },
  });
  act(() => {
    void appEventBus.emit(EAppEventBusNames.LockApp, undefined);
  });
  expect(ui.result.current.balances).toBeUndefined();
  await tick();
  expect(ui.result.current.balances).toBeUndefined();
});

it('stops polling while activation requires a user action', async () => {
  mockSequencing.mockResolvedValue({
    status: EStrk20SequencingStatus.ActivationRequired,
  });
  const ui = renderHook(() => useStarknetPrivacySequencing(account));
  await tick();
  expect(ui.result.current.sequencing?.status).toBe(
    EStrk20SequencingStatus.ActivationRequired,
  );
  mockSequencing.mockClear();
  await tick(30_000);
  expect(mockSequencing).not.toHaveBeenCalled();
  mockSequencing.mockResolvedValue({ status: EStrk20SequencingStatus.Ready });
  setFocused(false);
  setFocused(true);
  await tick();
  expect(ui.result.current.sequencing?.status).toBe(
    EStrk20SequencingStatus.Ready,
  );
});

it('uses fresh funds for spending and clears the previous balance after a failed refresh', async () => {
  mockReadCachedBalances.mockResolvedValue(balances);
  const ui = renderHook(() =>
    useStarknetPrivateBalances({
      ...account,
      tokenAddress: '0x1',
      requireFresh: true,
    }),
  );
  await tick();
  expect(ui.result.current.balances).toEqual(balances);
  expect(mockReadCachedBalances).not.toHaveBeenCalled();
  mockReadBalances.mockRejectedValueOnce({
    data: { starknetPrivacyErrorCode: EStrk20ErrorCode.Locked },
  });
  act(() => ui.result.current.reload());
  await tick();
  expect(ui.result.current.errorCode).toBe(EStrk20ErrorCode.Locked);
  expect(ui.result.current.balances).toBeUndefined();
});

it('restores spendable funds once on unlock without a password prompt, when the page is focused', async () => {
  mockReadBalances.mockRejectedValueOnce({
    data: { starknetPrivacyErrorCode: EStrk20ErrorCode.Locked },
  });
  const ui = renderHook(() =>
    useStarknetPrivateBalances({
      ...account,
      tokenAddress: '0x1',
      requireFresh: true,
    }),
  );
  await tick();
  expect(ui.result.current.errorCode).toBe(EStrk20ErrorCode.Locked);
  setFocused(false);
  act(() => {
    appEventBus.emit(EAppEventBusNames.UnlockApp, undefined);
  });
  await tick();
  expect(mockReadBalances).toHaveBeenCalledTimes(1);
  setFocused(true);
  await tick();
  act(() => {
    appEventBus.emit(EAppEventBusNames.UnlockApp, undefined);
  });
  await tick();
  expect(mockReadBalances).toHaveBeenCalledTimes(2);
  expect(mockReadBalances.mock.lastCall?.[0]).toMatchObject({
    allowPrompt: false,
  });
  expect(ui.result.current.balances).toEqual(balances);
});

it('finishes an explicit unlock already running for this balance without starting a second read', async () => {
  const pending = Promise.withResolvers<IBalanceSnapshot>();
  const ui = renderHook(() =>
    useStarknetPrivateBalances({
      ...account,
      tokenAddress: '0x1',
      requireFresh: true,
    }),
  );
  await tick();
  mockReadBalances.mockReturnValueOnce(pending.promise);
  act(() => ui.result.current.reload());
  await tick();
  act(() => {
    appEventBus.emit(EAppEventBusNames.UnlockApp, undefined);
  });
  await tick();
  expect(mockReadBalances).toHaveBeenCalledTimes(2);
  await act(async () => {
    pending.resolve({ ...balances, blockNumber: 200 });
  });
  await tick();
  expect(ui.result.current.balances?.blockNumber).toBe(200);
});
