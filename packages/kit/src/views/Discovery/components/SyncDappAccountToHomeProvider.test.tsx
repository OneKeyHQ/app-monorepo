/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { useSyncDappAccountToHomeAccount } from './SyncDappAccountToHomeProvider';

const mockConfirmAccountSelect = jest.fn(async (_params: unknown) => true);
const mockErrorLog = jest.fn((_message: string) => undefined);
const mockIsOthersAccount = jest.fn((_params: unknown) => false);

jest.mock('@onekeyhq/kit/src/components/AccountSelector', () => ({
  AccountSelectorProviderMirror: () => null,
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useAccountSelectorContextDataAtom: () => [undefined],
}));

jest.mock(
  '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/actions',
  () => ({
    useAccountSelectorActions: () => ({
      current: {
        confirmAccountSelect: async (params: unknown) =>
          mockConfirmAccountSelect(params),
      },
    }),
  }),
);

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/settings', () => ({
  useSettingsPersistAtom: () => [{}],
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      getAccount: async () => ({ id: 'account-id' }),
      getIndexedAccount: async () => ({ id: 'indexed-account-id' }),
    },
  },
}));

jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: {
    isOthersAccount: (params: unknown) => mockIsOthersAccount(params),
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    app: {
      error: {
        log: (message: string) => mockErrorLog(message),
      },
    },
  },
}));

jest.mock('../../../components/Spotlight', () => ({
  useSpotlight: () => ({
    isFirstVisit: false,
    tourVisited: async () => undefined,
  }),
}));

async function syncOnce() {
  const { result } = renderHook(() => useSyncDappAccountToHomeAccount());
  await act(async () => {
    await result.current.syncDappAccountToWallet({
      dAppAccountInfos: [
        {
          accountId: 'account-id',
          indexedAccountId: 'indexed-account-id',
          networkId: 'evm--1',
        },
        // The hook only accepts the single-account shape; the cast keeps the
        // fixture minimal instead of building a full IConnectionAccountInfo.
      ] as unknown as Parameters<
        typeof result.current.syncDappAccountToWallet
      >[0]['dAppAccountInfos'],
    });
    // The confirm call is deferred through setTimeout, so drain the timer and
    // the promise chain it starts before asserting.
    jest.runOnlyPendingTimers();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('useSyncDappAccountToHomeAccount', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockConfirmAccountSelect.mockClear();
    mockErrorLog.mockClear();
    mockIsOthersAccount.mockClear();
    mockConfirmAccountSelect.mockImplementation(async () => true);
    mockIsOthersAccount.mockImplementation(() => false);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('swallows and logs a rejected confirmAccountSelect for indexed accounts', async () => {
    mockConfirmAccountSelect.mockImplementation(() =>
      Promise.reject(new Error('save to storage failed')),
    );

    await syncOnce();

    expect(mockConfirmAccountSelect).toHaveBeenCalledTimes(1);
    expect(mockErrorLog).toHaveBeenCalledTimes(1);
    expect(mockErrorLog.mock.calls[0][0]).toContain(
      'syncDappAccountToWallet confirmAccountSelect (indexed) failed',
    );
    expect(mockErrorLog.mock.calls[0][0]).toContain('save to storage failed');
  });

  it('swallows and logs a rejected confirmAccountSelect for others accounts', async () => {
    mockIsOthersAccount.mockImplementation(() => true);
    mockConfirmAccountSelect.mockImplementation(() =>
      Promise.reject(new Error('save to storage failed')),
    );

    await syncOnce();

    expect(mockErrorLog).toHaveBeenCalledTimes(1);
    expect(mockErrorLog.mock.calls[0][0]).toContain(
      'syncDappAccountToWallet confirmAccountSelect (others) failed',
    );
  });

  it('logs nothing when the selection is persisted', async () => {
    await syncOnce();

    expect(mockConfirmAccountSelect).toHaveBeenCalledTimes(1);
    expect(mockErrorLog).not.toHaveBeenCalled();
  });
});
