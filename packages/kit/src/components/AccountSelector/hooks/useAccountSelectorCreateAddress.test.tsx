/** @jest-environment jsdom */

import { HardwareErrorCode as ThirdPartyHwErrorCode } from '@onekeyfe/hwk-adapter-core';
import { act, renderHook } from '@testing-library/react';

import { Toast } from '@onekeyhq/components';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';

import { useAccountSelectorCreateAddress } from './useAccountSelectorCreateAddress';

const mockAddDefaultNetworkAccounts = jest.fn<Promise<unknown>, [unknown]>();
const mockIsThirdPartyHwByWalletId = jest.fn<Promise<boolean>, [unknown]>();

jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      getWalletDevice: jest.fn(async () => ({ connectId: 'device-1' })),
      isThirdPartyHwByWalletId: (params: unknown) =>
        mockIsThirdPartyHwByWalletId(params),
      getIndexedAccountsOfWallet: jest.fn(async () => ({ accounts: [] })),
    },
    serviceBatchCreateAccount: {
      addDefaultNetworkAccounts: (params: unknown) =>
        mockAddDefaultNetworkAccounts(params),
    },
    serviceHardwareUI: {
      closeHardwareUiStateDialog: jest.fn(async () => undefined),
    },
    serviceNetwork: {
      getNetwork: jest.fn(async () => ({ name: 'Bitcoin' })),
      getDeriveInfoOfNetwork: jest.fn(async () => ({ label: 'Taproot' })),
    },
    servicePassword: {
      promptPasswordVerifyByWallet: jest.fn(async () => undefined),
    },
  },
}));

jest.mock('@onekeyhq/components', () => ({
  Button: () => null,
  Dialog: { show: jest.fn() },
  SizableText: () => null,
  Stack: () => null,
  Toast: { error: jest.fn() },
  XStack: () => null,
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }, values?: Record<string, string>) =>
      values ? `${id}:${values.network}:${values.addressType}` : id,
  }),
}));

jest.mock('../../../states/jotai/contexts/accountSelector/actionsLazy', () => ({
  useAccountSelectorLazyAction: () => jest.fn(async () => undefined),
}));

jest.mock('./useCreateQrWallet', () => ({
  useCreateQrWallet: () => ({ createQrWalletAccount: jest.fn() }),
}));

jest.mock('../../TutorialsList', () => ({ TutorialsList: () => null }));

const pathForbidden = {
  networkId: 'btc--0',
  deriveType: 'BIP86',
  error: {
    code: ThirdPartyHwErrorCode.DevicePathForbidden,
    className: EOneKeyErrorClassNames.OneKeyHardwareError,
    $isHardwareError: true,
    message: 'Path not supported',
    // The device stage clears this on every hardware error it shows.
    autoToast: false,
  },
};

async function createAllNetworkAddress() {
  const { result } = renderHook(() => useAccountSelectorCreateAddress());
  await act(async () => {
    await result.current.createAddress({
      num: 0,
      account: {
        walletId: 'hw-wallet-1',
        networkId: getNetworkIdsMap().onekeyall,
        indexedAccountId: 'hw-wallet-1--1',
        deriveType: 'default',
      },
    });
  });
}

describe('useAccountSelectorCreateAddress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAddDefaultNetworkAccounts.mockResolvedValue({
      addedAccounts: [{ networkId: 'evm--1', deriveType: 'default' }],
      failedAccounts: [pathForbidden],
    });
  });

  it('names the chain a third-party device refused while others succeeded', async () => {
    mockIsThirdPartyHwByWalletId.mockResolvedValue(true);

    await createAllNetworkAddress();

    expect(Toast.error).toHaveBeenCalledTimes(1);
    expect(Toast.error).toHaveBeenCalledWith({
      title: 'feedback.hw_create_unsupported_address_title:Bitcoin:Taproot',
      message: 'Path not supported',
    });
  });

  it('keeps the OneKey toast as the raw failure message', async () => {
    mockIsThirdPartyHwByWalletId.mockResolvedValue(false);

    await createAllNetworkAddress();

    expect(Toast.error).toHaveBeenCalledWith({ title: 'Path not supported' });
  });
});
