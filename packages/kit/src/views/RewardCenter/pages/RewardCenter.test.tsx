/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, render } from '@testing-library/react';

import RewardCenter from './RewardCenter';

const mockConfirmAccountSelect = jest.fn(async (_params: unknown) => true);
const mockWaitForAutoSelectUnlock = jest.fn(async () => undefined);
const mockUpdateSelectedAccountFocusedWallet = jest.fn(
  async (_params: unknown) => undefined,
);
const mockGetSelectedAccount = jest.fn((_params: unknown) => ({}));
const mockReloadActiveAccountInfo = jest.fn(
  async (_params: unknown) => undefined,
);
const mockErrorLog = jest.fn((_message: string) => undefined);
const mockIsOthersAccount = jest.fn((_params: unknown) => false);

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: () => '' }),
}));

jest.mock('@react-navigation/core', () => ({
  useRoute: () => ({
    params: {
      accountId: 'hd-1--account-1',
      networkId: 'tron--0x2b6653dc',
      walletId: 'hd-1',
      showAccountSelector: true,
    },
  }),
}));

// One factory serves both the bare package import and the
// '@onekeyhq/components/src/hooks/useForm' subpath import: the repo-wide
// moduleNameMapper collapses every '@onekeyhq/components*' specifier into the
// same mocked module.
jest.mock('@onekeyhq/components', () => {
  const Passthrough = ({ children }: { children?: ReactNode }) =>
    children ?? null;
  const Null = () => null;
  return {
    Alert: Null,
    Button: Null,
    Divider: Null,
    Form: Object.assign(Passthrough, { Field: Passthrough }),
    Input: Null,
    NavCloseButton: Null,
    Page: Object.assign(Passthrough, { Header: Null, Body: Passthrough }),
    SizableText: Null,
    Skeleton: Object.assign(Null, { BodyLg: Null }),
    Stack: Passthrough,
    Toast: { error: jest.fn(), success: jest.fn() },
    XStack: Passthrough,
    YStack: Passthrough,
    useForm: () => ({
      getValues: () => '',
      formState: { isSubmitting: false, isValid: false },
    }),
  };
});

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    app: {
      error: {
        log: (message: string) => mockErrorLog(message),
      },
    },
  },
}));

jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: {
    isOthersAccount: (params: unknown) => mockIsOthersAccount(params),
    isQrAccount: () => false,
    isWatchingAccount: () => false,
    buildIndexedAccountId: () => 'hd-1--0',
    getWalletIdFromAccountId: () => 'hd-1',
  },
}));

jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: {
    isTronNetworkByNetworkId: () => false,
    isAllNetwork: () => false,
  },
}));

jest.mock('@onekeyhq/shared/src/utils/chainResourceUtils', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      getAccount: async () => ({ id: 'hd-1--account-1' }),
      getWallet: async () => ({ id: 'hd-1' }),
      getIndexedAccountByAccount: async () => ({ id: 'hd-1--0' }),
    },
    serviceNetwork: {
      getGlobalDeriveTypeOfNetwork: async () => 'default',
      getNetwork: async () => ({ id: 'tron--0x2b6653dc' }),
    },
  },
}));

jest.mock('../../../components/AccountSelector', () => ({
  AccountSelectorProviderMirror: ({ children }: { children?: ReactNode }) =>
    children ?? null,
  AccountSelectorTriggerRewardCenter: () => null,
}));

jest.mock(
  '../../../components/AccountSelector/hooks/useAccountSelectorCreateAddress',
  () => ({
    useAccountSelectorCreateAddress: () => ({
      createAddress: jest.fn(),
    }),
  }),
);

jest.mock('../../../hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({
    pop: jest.fn(),
    pushModal: jest.fn(),
  }),
}));

jest.mock('../../../hooks/usePromiseResult', () => ({
  usePromiseResult: (
    _factory: unknown,
    _deps: unknown,
    options?: { initResult?: unknown },
  ) => ({
    result: options?.initResult,
    isLoading: false,
    setStopPolling: jest.fn(),
  }),
}));

jest.mock('../../../states/jotai/contexts/accountSelector', () => {
  const stableActiveAccountState = { activeAccount: {} };
  return {
    useActiveAccount: () => stableActiveAccountState,
  };
});

jest.mock('../../../states/jotai/contexts/accountSelector/actions', () => {
  // The sync effect lists `actions` in its deps; the real hook returns a
  // stable ref, so the mock must too or the effect re-runs on every render.
  const stableActions = {
    current: {
      confirmAccountSelect: async (params: unknown) =>
        mockConfirmAccountSelect(params),
      waitForAutoSelectUnlock: async () => mockWaitForAutoSelectUnlock(),
      updateSelectedAccountFocusedWallet: async (params: unknown) =>
        mockUpdateSelectedAccountFocusedWallet(params),
      getSelectedAccount: (params: unknown) => mockGetSelectedAccount(params),
      reloadActiveAccountInfo: async (params: unknown) =>
        mockReloadActiveAccountInfo(params),
    },
  };
  return {
    useAccountSelectorActions: () => stableActions,
  };
});

async function renderAndFlushSync() {
  render(<RewardCenter />);
  // The selector sync effect chains several awaits; drain the microtask queue
  // until the whole chain settles before asserting.
  await act(async () => {
    for (let i = 0; i < 20; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await Promise.resolve();
    }
  });
}

describe('RewardCenter account selector sync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConfirmAccountSelect.mockImplementation(async () => true);
    mockIsOthersAccount.mockImplementation(() => false);
    mockGetSelectedAccount.mockImplementation(() => ({}));
  });

  it('aborts indexed-account initialization when selection is rejected', async () => {
    mockConfirmAccountSelect.mockImplementation(() =>
      Promise.reject(new Error('save to storage failed')),
    );

    await renderAndFlushSync();

    expect(mockConfirmAccountSelect).toHaveBeenCalledTimes(1);
    expect(mockUpdateSelectedAccountFocusedWallet).not.toHaveBeenCalled();
    expect(mockReloadActiveAccountInfo).not.toHaveBeenCalled();
  });

  it('aborts others-account initialization when selection is rejected', async () => {
    mockIsOthersAccount.mockImplementation(() => true);
    mockConfirmAccountSelect.mockImplementation(() =>
      Promise.reject(new Error('save to storage failed')),
    );

    await renderAndFlushSync();

    expect(mockConfirmAccountSelect).toHaveBeenCalledTimes(1);
    expect(mockUpdateSelectedAccountFocusedWallet).not.toHaveBeenCalled();
    expect(mockReloadActiveAccountInfo).not.toHaveBeenCalled();
  });

  it('aborts initialization when selection returns false', async () => {
    mockConfirmAccountSelect.mockResolvedValue(false);

    await renderAndFlushSync();

    expect(mockConfirmAccountSelect).toHaveBeenCalledTimes(1);
    expect(mockUpdateSelectedAccountFocusedWallet).not.toHaveBeenCalled();
    expect(mockReloadActiveAccountInfo).not.toHaveBeenCalled();
  });

  it('runs the full init sequence without logging when the selection is persisted', async () => {
    await renderAndFlushSync();

    expect(mockConfirmAccountSelect).toHaveBeenCalledTimes(1);
    expect(mockErrorLog).not.toHaveBeenCalled();
    expect(mockUpdateSelectedAccountFocusedWallet).toHaveBeenCalledTimes(1);
    expect(mockReloadActiveAccountInfo).toHaveBeenCalledTimes(1);
  });
});
