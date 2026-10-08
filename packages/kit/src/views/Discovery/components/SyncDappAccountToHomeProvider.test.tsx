/** @jest-environment jsdom */

import { act, render, renderHook, waitFor } from '@testing-library/react';

import type { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/actions';
import { isSameSelectedAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/selectedAccountCompare';
import type { IAccountSelectorSelectedAccount } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import {
  SyncHomeAccountPageToDappAccount,
  useSyncDappAccountToHomeAccount,
} from './SyncDappAccountToHomeProvider';

const mockConfirmAccountSelect = jest.fn(async (_params: unknown) => true);
type ISelectionUpdateParams = Parameters<
  ReturnType<
    typeof useAccountSelectorActions
  >['current']['updateSelectedAccount']
>[0];

const mockUpdateSelectedAccount = jest.fn(
  async (_params: ISelectionUpdateParams) => ({
    outcome: 'commit',
  }),
);
const mockSetIsAlignPrimaryAccountProcessing = jest.fn(
  async (_params: unknown) => undefined,
);
const mockErrorLog = jest.fn((_message: string) => undefined);
const mockIsOthersAccount = jest.fn((_params: unknown) => false);

jest.mock('@onekeyhq/kit/src/components/AccountSelector', () => ({
  AccountSelectorProviderMirror: () => null,
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useAccountSelectorContextDataAtom: () => [{ sceneName: 'home' }],
}));

jest.mock(
  '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/actions',
  () => ({
    useAccountSelectorActions: () => ({
      current: {
        confirmAccountSelect: async (params: unknown) =>
          mockConfirmAccountSelect(params),
        updateSelectedAccount: async (params: ISelectionUpdateParams) =>
          mockUpdateSelectedAccount(params),
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
    serviceDApp: {
      setIsAlignPrimaryAccountProcessing: (params: unknown) =>
        mockSetIsAlignPrimaryAccountProcessing(params),
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

describe('SyncHomeAccountPageToDappAccount', () => {
  beforeEach(() => {
    mockUpdateSelectedAccount.mockReset();
    mockUpdateSelectedAccount.mockImplementation(async () => ({
      outcome: 'commit',
    }));
  });

  function observeSelection(initialSelection: IAccountSelectorSelectedAccount) {
    let currentSelection = initialSelection;
    // Exercise the action's full and partial CAS contracts against the UI value,
    // rather than assuming every call commits as the transport mock does.
    mockUpdateSelectedAccount.mockImplementation(async (params) => {
      if (
        (params.expectedSelection &&
          !isSameSelectedAccount(currentSelection, params.expectedSelection)) ||
        (params.expectedPartialSelection &&
          Object.entries(params.expectedPartialSelection).some(
            ([field, expectedValue]) =>
              currentSelection[
                field as keyof IAccountSelectorSelectedAccount
              ] !== expectedValue,
          ))
      ) {
        return { outcome: 'stale' };
      }
      currentSelection = params.builder(currentSelection);
      return { outcome: 'commit' };
    });
    return () => currentSelection;
  }

  const persistedAllNetworkSelection: IAccountSelectorSelectedAccount = {
    deriveType: undefined,
    focusedWallet: 'hd-1',
    indexedAccountId: 'hd-1--0',
    networkId: 'onekeyall--0',
    othersWalletAccountId: undefined,
    walletId: 'hd-1',
  };
  const alignedSelection: IAccountSelectorSelectedAccount = {
    ...persistedAllNetworkSelection,
    indexedAccountId: 'hd-1--1',
  };

  it.each([false, true])(
    'aligns AllNetwork Home despite the storage/UI derive type difference (JSON transport: %s)',
    async (jsonTransport) => {
      const readSelection = observeSelection({
        ...persistedAllNetworkSelection,
        deriveType: 'default',
      });
      const expectedSelectedAccount = jsonTransport
        ? (JSON.parse(
            JSON.stringify(persistedAllNetworkSelection),
          ) as IAccountSelectorSelectedAccount)
        : persistedAllNetworkSelection;
      render(<SyncHomeAccountPageToDappAccount />);

      await act(async () => {
        appEventBus.emit(EAppEventBusNames.SyncDappAccountToHomeAccount, {
          expectedSelectedAccount,
          selectedAccount: alignedSelection,
        });
      });

      expect(readSelection()).toEqual(alignedSelection);
      const guard = mockUpdateSelectedAccount.mock.calls[0][0];
      expect(guard.expectedSelection).toBeUndefined();
      expect(guard.expectedPartialSelection).toStrictEqual({
        focusedWallet: 'hd-1',
        indexedAccountId: 'hd-1--0',
        networkId: 'onekeyall--0',
        othersWalletAccountId: undefined,
        walletId: 'hd-1',
      });
      expect(guard.expectedPartialSelection).not.toHaveProperty('deriveType');
    },
  );

  it.each([
    ['walletId', 'hd-2'],
    ['indexedAccountId', 'hd-1--2'],
    ['networkId', 'evm--1'],
    ['othersWalletAccountId', 'imported--evm-1'],
    ['focusedWallet', 'hd-2'],
  ] as const)('does not overwrite a newer Home %s', async (field, value) => {
    const userSelection: IAccountSelectorSelectedAccount = {
      ...persistedAllNetworkSelection,
      deriveType: 'default',
      [field]: value,
    };
    const readSelection = observeSelection(userSelection);
    render(<SyncHomeAccountPageToDappAccount />);

    await act(async () => {
      appEventBus.emit(EAppEventBusNames.SyncDappAccountToHomeAccount, {
        expectedSelectedAccount: persistedAllNetworkSelection,
        selectedAccount: alignedSelection,
      });
    });

    expect(readSelection()).toEqual(userSelection);
  });

  it('still checks the derive type on a single network', async () => {
    const expectedSelectedAccount: IAccountSelectorSelectedAccount = {
      ...persistedAllNetworkSelection,
      networkId: 'btc--0',
      deriveType: 'BIP84',
    };
    const userSelection: IAccountSelectorSelectedAccount = {
      ...expectedSelectedAccount,
      deriveType: 'BIP86',
    };
    const readSelection = observeSelection(userSelection);
    render(<SyncHomeAccountPageToDappAccount />);

    await act(async () => {
      appEventBus.emit(EAppEventBusNames.SyncDappAccountToHomeAccount, {
        expectedSelectedAccount,
        selectedAccount: {
          ...expectedSelectedAccount,
          indexedAccountId: 'hd-1--1',
        },
      });
    });

    expect(readSelection()).toEqual(userSelection);
    expect(
      mockUpdateSelectedAccount.mock.calls[0][0].expectedSelection,
    ).toEqual(expectedSelectedAccount);
  });

  it('applies the background result only while the observed Home selection is current', async () => {
    const expectedSelectedAccount = {
      deriveType: 'default' as const,
      focusedWallet: 'hd-1',
      indexedAccountId: 'hd-1--0',
      networkId: 'evm--1',
      othersWalletAccountId: undefined,
      walletId: 'hd-1',
    };
    const selectedAccount = {
      ...expectedSelectedAccount,
      indexedAccountId: 'hd-2--0',
      walletId: 'hd-2',
    };
    render(<SyncHomeAccountPageToDappAccount />);

    await act(async () => {
      appEventBus.emit(EAppEventBusNames.SyncDappAccountToHomeAccount, {
        expectedSelectedAccount,
        selectedAccount,
      });
    });

    await waitFor(() => {
      expect(mockUpdateSelectedAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          expectedSelection: expectedSelectedAccount,
          num: 0,
          reason: 'syncDappAccountToHomeAccount',
        }),
      );
    });
  });
});
