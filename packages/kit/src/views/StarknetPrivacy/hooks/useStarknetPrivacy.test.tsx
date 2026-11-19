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
  EStrk20SetupRequirement,
} from '@onekeyhq/shared/types/starknetPrivacy';
import type { IStrk20PrivateBalances } from '@onekeyhq/shared/types/starknetPrivacy';

const mockReadState = jest.fn(async () => ({
  optInStatus: EStrk20OptInStatus.Consented,
}));
type IBalanceSnapshot = IStrk20PrivateBalances & { lastSyncedAt: number };
const mockReadBalances = jest.fn<Promise<IBalanceSnapshot>, [object]>();
const mockReadCachedBalances = jest.fn<
  Promise<IBalanceSnapshot | undefined>,
  [object]
>();
const mockRecipient = jest.fn<Promise<EStrk20SetupRequirement>, [object]>();
let mockFocused = true;
const mockFocusListeners = new Set<() => void>();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStarknetPrivacy: {
      getAccountPrivacyState: () => mockReadState(),
      getCachedPrivateBalances: (params: object) =>
        mockReadCachedBalances(params),
      getPrivateBalances: (params: object) =>
        mockReadBalances({ ...params, allowPrompt: false }),
      refreshPrivateBalances: (params: object) => mockReadBalances(params),
      getRecipientRequirement: (params: object) => mockRecipient(params),
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
  useStarknetPrivateBalances,
  useStarknetRecipientRequirement,
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
  mockRecipient.mockResolvedValue(EStrk20SetupRequirement.Ready);
});
afterEach(() => {
  jest.useRealTimers();
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

it('does not reuse a previous recipient decision during address validation', async () => {
  const ui = renderHook(
    ({ recipient }) =>
      useStarknetRecipientRequirement({
        ...account,
        tokenAddress: '0x1',
        recipient,
      }),
    { initialProps: { recipient: '0x2' } },
  );
  await tick(1200);
  expect(ui.result.current.requirement).toBe(EStrk20SetupRequirement.Ready);
  mockRecipient.mockResolvedValue(EStrk20SetupRequirement.Register);
  ui.rerender({ recipient: '0x3' });
  expect(ui.result.current.requirement).toBeUndefined();
  expect(ui.result.current.isLoading).toBe(true);
  await tick(1200);
  expect(ui.result.current.requirement).toBe(EStrk20SetupRequirement.Register);
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
