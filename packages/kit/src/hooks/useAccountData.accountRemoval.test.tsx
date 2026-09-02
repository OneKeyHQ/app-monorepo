/** @jest-environment jsdom */

import { renderHook, waitFor } from '@testing-library/react-native';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import { useAccountData } from './useAccountData';

jest.mock('react-intl', () => {
  const intl = {
    formatMessage: ({ id }: { id: string }) => id,
  };
  return {
    useIntl: () => intl,
  };
});

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNative: false,
    isDesktop: false,
    isWeb: true,
    isRuntimeBrowser: true,
    isRuntimeChrome: false,
  },
}));

jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: {
    isAllNetworkMockAccount: jest.fn(() => false),
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    accountSelector: {
      perf: {
        trace: jest.fn(),
      },
    },
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => true,
}));

jest.mock('@onekeyhq/components', () => {
  const { useDeferredPromise } = jest.requireActual<
    typeof import('../../../components/src/hooks/useDeferredPromise')
  >('../../../components/src/hooks/useDeferredPromise');
  return {
    __esModule: true,
    getCurrentVisibilityState: () => true,
    onVisibilityStateChange: () => () => undefined,
    useDeferredPromise,
    useNetInfo: () => ({
      isInternetReachable: true,
      isRawInternetReachable: true,
    }),
  };
});

jest.mock('../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      getAccount: jest.fn(),
      getDBAccountSafe: jest.fn(),
      getIndexedAccountSafe: jest.fn(),
      getWallet: jest.fn(),
      getAccountAddressType: jest.fn(),
    },
    serviceNetwork: {
      getNetwork: jest.fn(),
      getVaultSettings: jest.fn(),
      getDeriveTypeByAddress: jest.fn(),
      getDeriveInfoByAddress: jest.fn(),
      getDeriveTypeByTemplate: jest.fn(),
    },
  },
}));

type IServiceAccountMock = {
  getAccount: jest.Mock;
  getDBAccountSafe: jest.Mock;
  getIndexedAccountSafe: jest.Mock;
  getWallet: jest.Mock;
  getAccountAddressType: jest.Mock;
};

type IServiceNetworkMock = {
  getNetwork: jest.Mock;
  getVaultSettings: jest.Mock;
  getDeriveTypeByAddress: jest.Mock;
  getDeriveInfoByAddress: jest.Mock;
  getDeriveTypeByTemplate: jest.Mock;
};

function getServiceMocks() {
  return {
    serviceAccount:
      backgroundApiProxy.serviceAccount as unknown as IServiceAccountMock,
    serviceNetwork:
      backgroundApiProxy.serviceNetwork as unknown as IServiceNetworkMock,
  };
}

describe('useAccountData account-removal races', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { serviceAccount, serviceNetwork } = getServiceMocks();
    serviceAccount.getAccount.mockRejectedValue(new Error('account not found'));
    serviceAccount.getWallet.mockResolvedValue({
      id: 'wallet-1',
      name: 'Wallet 1',
    });
    serviceNetwork.getNetwork.mockResolvedValue({
      id: 'evm--1',
      name: 'Ethereum',
    });
    serviceNetwork.getVaultSettings.mockResolvedValue({
      implementation: 'evm',
    });
  });

  it('keeps non-account data when the account is removed during loading', async () => {
    const { serviceAccount } = getServiceMocks();
    serviceAccount.getDBAccountSafe.mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useAccountData({
        accountId: 'account-1',
        networkId: 'evm--1',
        walletId: 'wallet-1',
        options: { watchLoading: true },
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.network?.id).toBe('evm--1');
    });

    expect(result.current.account).toBeUndefined();
    expect(result.current.wallet?.id).toBe('wallet-1');
    expect(result.current.vaultSettings).toEqual({ implementation: 'evm' });
    expect(serviceAccount.getIndexedAccountSafe).not.toHaveBeenCalled();
    expect(serviceAccount.getAccountAddressType).not.toHaveBeenCalled();
  });

  it('keeps non-account data when the indexed account is removed during loading', async () => {
    const { serviceAccount } = getServiceMocks();
    serviceAccount.getDBAccountSafe.mockResolvedValue({
      id: 'account-1',
      indexedAccountId: 'indexed-account-1',
    });
    serviceAccount.getIndexedAccountSafe.mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useAccountData({
        accountId: 'account-1',
        networkId: 'evm--1',
        walletId: 'wallet-1',
        options: { watchLoading: true },
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.network?.id).toBe('evm--1');
    });

    expect(result.current.account).toBeUndefined();
    expect(result.current.wallet?.id).toBe('wallet-1');
    expect(serviceAccount.getIndexedAccountSafe).toHaveBeenCalledWith({
      id: 'indexed-account-1',
    });
    expect(serviceAccount.getAccountAddressType).not.toHaveBeenCalled();
  });

  it('rethrows errors that are not caused by account removal', async () => {
    const { serviceAccount, serviceNetwork } = getServiceMocks();
    serviceAccount.getAccount.mockRejectedValue(
      new Error('network unreachable'),
    );
    // The account is still there, so the removal fallback must not swallow it.
    serviceAccount.getDBAccountSafe.mockResolvedValue({ id: 'account-1' });

    const { result } = renderHook(() =>
      useAccountData({
        accountId: 'account-1',
        networkId: 'evm--1',
        walletId: 'wallet-1',
        // undefinedResultIfError keeps the rethrown error inside
        // usePromiseResult instead of leaking an unhandled rejection.
        options: { watchLoading: true, undefinedResultIfError: true },
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(serviceNetwork.getNetwork).toHaveBeenCalled();
    expect(result.current.account).toBeUndefined();
    expect(result.current.network).toBeUndefined();
    expect(result.current.wallet).toBeUndefined();
    expect(result.current.vaultSettings).toBeUndefined();
  });
});
