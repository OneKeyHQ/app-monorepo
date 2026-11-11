/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { HardwareErrorCode as ThirdPartyHwErrorCode } from '@onekeyfe/hwk-adapter-core';
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react';

import { Dialog, Toast } from '@onekeyhq/components';
import { showIntercom } from '@onekeyhq/kit/src/views/Intercom/client';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useAccountSelectorCreateAddress } from './useAccountSelectorCreateAddress';

const mockAddDefaultNetworkAccounts = jest.fn<Promise<unknown>, [unknown]>();
const mockAddAccounts = jest.fn<Promise<unknown>, [unknown]>();
const mockIsThirdPartyHwByWalletId = jest.fn<Promise<boolean>, [unknown]>();
const mockGetNetwork = jest.fn<
  Promise<{ name: string } | undefined>,
  [unknown]
>();
const mockGetDeriveInfoOfNetwork = jest.fn<
  Promise<{ label: string } | undefined>,
  [unknown]
>();
const mockCallAccountSelectorAction = jest.fn<Promise<void>, [string, unknown]>(
  async () => undefined,
);

jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      getWalletDevice: jest.fn(async () => ({ connectId: 'device-1' })),
      isThirdPartyHwByWalletId: (params: unknown) =>
        mockIsThirdPartyHwByWalletId(params),
      getIndexedAccountsOfWallet: jest.fn(async () => ({ accounts: [] })),
      addHDOrHWAccounts: (params: unknown) => mockAddAccounts(params),
      isBtcOnlyFirmwareByWalletId: jest.fn(async () => false),
    },
    serviceBatchCreateAccount: {
      addDefaultNetworkAccounts: (params: unknown) =>
        mockAddDefaultNetworkAccounts(params),
    },
    serviceHardwareUI: {
      closeHardwareUiStateDialog: jest.fn(async () => undefined),
    },
    serviceNetwork: {
      getNetwork: (params: unknown) => mockGetNetwork(params),
      getDeriveInfoOfNetwork: (params: unknown) =>
        mockGetDeriveInfoOfNetwork(params),
    },
    servicePassword: {
      promptPasswordVerifyByWallet: jest.fn(async () => undefined),
    },
  },
}));

jest.mock('@onekeyhq/components', () => ({
  Button: ({
    children,
    onPress,
  }: {
    children: ReactNode;
    onPress: () => void;
  }) => <button onClick={onPress}>{children}</button>,
  Dialog: { show: jest.fn() },
  SizableText: ({ children }: { children: ReactNode }) => (
    <span>{children}</span>
  ),
  Stack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Toast: { error: jest.fn() },
  XStack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

jest.mock('@onekeyhq/kit/src/views/Intercom/client', () => ({
  showIntercom: jest.fn(async () => {}),
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }, values?: Record<string, string>) =>
      values ? `${id}:${values.network}:${values.addressType}` : id,
  }),
}));

jest.mock('../../../states/jotai/contexts/accountSelector/actionsLazy', () => ({
  useAccountSelectorLazyAction: () => mockCallAccountSelectorAction,
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

async function createAllNetworkAddress(selectAfterCreate = false) {
  const { result } = renderHook(() => useAccountSelectorCreateAddress());
  await act(async () => {
    await result.current.createAddress({
      num: 0,
      selectAfterCreate,
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
    mockGetNetwork.mockReset().mockResolvedValue({ name: 'Bitcoin' });
    mockGetDeriveInfoOfNetwork
      .mockReset()
      .mockResolvedValue({ label: 'Taproot' });
    mockAddDefaultNetworkAccounts.mockResolvedValue({
      addedAccounts: [{ networkId: 'evm--1', deriveType: 'default' }],
      failedAccounts: [pathForbidden],
    });
  });

  it('closes the failed QR-address dialog before opening support', async () => {
    let finishClose: () => void = () => {};
    const close = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          finishClose = resolve;
        }),
    );
    jest.mocked(Dialog.show).mockReturnValueOnce({
      close,
      isExist: () => true,
      getForm: () => undefined,
    });
    mockAddAccounts.mockRejectedValue({
      className: EOneKeyErrorClassNames.OneKeyErrorAirGapAccountNotFound,
    });
    const { result } = renderHook(() => useAccountSelectorCreateAddress());
    await act(async () => {
      await result.current.createAddress({
        num: 0,
        account: {
          walletId: 'qr-wallet-test',
          networkId: 'evm--1',
          indexedAccountId: 'qr-wallet-test--1',
          deriveType: 'default',
        },
      });
    });
    expect(Dialog.show).toHaveBeenCalledTimes(1);
    render(<>{jest.mocked(Dialog.show).mock.calls[0][0].renderContent}</>);
    fireEvent.click(
      screen.getByRole('button', { name: ETranslations.global_contact_us }),
    );
    expect(close).toHaveBeenCalledTimes(1);
    expect(showIntercom).not.toHaveBeenCalled();
    await act(async () => finishClose());
    expect(showIntercom).toHaveBeenCalledTimes(1);
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

  it('stays quiet about Bitcoin past Keystone account #1 when filling all networks', async () => {
    mockIsThirdPartyHwByWalletId.mockResolvedValue(true);
    mockAddDefaultNetworkAccounts.mockResolvedValue({
      addedAccounts: [{ networkId: 'evm--1', deriveType: 'default' }],
      failedAccounts: [
        {
          ...pathForbidden,
          error: {
            ...pathForbidden.error,
            key: ETranslations.hardware_third_party_keystone_btc_account_one_only__msg,
          },
        },
      ],
    });

    await createAllNetworkAddress();

    expect(Toast.error).not.toHaveBeenCalled();
  });

  it('keeps the OneKey toast as the raw failure message', async () => {
    mockIsThirdPartyHwByWalletId.mockResolvedValue(false);

    await createAllNetworkAddress();

    expect(Toast.error).toHaveBeenCalledWith({ title: 'Path not supported' });
  });

  it.each([
    {
      lookup: 'network',
      failNetwork: true,
      failDerive: false,
      expectedNetwork: 'btc--0',
      expectedAddressType: 'Taproot',
    },
    {
      lookup: 'derivation',
      failNetwork: false,
      failDerive: true,
      expectedNetwork: 'Bitcoin',
      expectedAddressType: 'BIP86',
    },
    {
      lookup: 'network and derivation',
      failNetwork: true,
      failDerive: true,
      expectedNetwork: 'btc--0',
      expectedAddressType: 'BIP86',
    },
  ])(
    'refreshes and selects created accounts when the $lookup lookup fails',
    async ({
      failNetwork,
      failDerive,
      expectedNetwork,
      expectedAddressType,
    }) => {
      mockIsThirdPartyHwByWalletId.mockResolvedValue(true);
      if (failNetwork) {
        mockGetNetwork.mockRejectedValueOnce(new Error('Network unavailable'));
      }
      if (failDerive) {
        mockGetDeriveInfoOfNetwork.mockRejectedValueOnce(
          new Error('Derivation unavailable'),
        );
      }

      await createAllNetworkAddress(true);

      expect(Toast.error).toHaveBeenCalledWith({
        title: `feedback.hw_create_unsupported_address_title:${expectedNetwork}:${expectedAddressType}`,
        message: 'Path not supported',
      });
      expect(mockAddDefaultNetworkAccounts).toHaveBeenCalledTimes(1);
      expect(mockCallAccountSelectorAction).toHaveBeenCalledTimes(2);
      expect(mockCallAccountSelectorAction).toHaveBeenNthCalledWith(
        1,
        'refresh',
        {
          num: 0,
        },
      );
      expect(mockCallAccountSelectorAction).toHaveBeenNthCalledWith(
        2,
        'updateSelectedAccountForHdOrHwAccount',
        {
          num: 0,
          walletId: 'hw-wallet-1',
          indexedAccountId: 'hw-wallet-1--1',
        },
      );
    },
  );

  it('still reports later failures after a derivation label lookup fails', async () => {
    mockIsThirdPartyHwByWalletId.mockResolvedValue(true);
    mockAddDefaultNetworkAccounts.mockResolvedValue({
      addedAccounts: [{ networkId: 'evm--1', deriveType: 'default' }],
      failedAccounts: [
        pathForbidden,
        {
          ...pathForbidden,
          deriveType: 'BIP84',
          error: { ...pathForbidden.error, message: 'Another rejected path' },
        },
      ],
    });
    mockGetDeriveInfoOfNetwork
      .mockRejectedValueOnce(new Error('Derivation unavailable'))
      .mockResolvedValueOnce({ label: 'Native Segwit' });

    await createAllNetworkAddress();

    expect(Toast.error).toHaveBeenCalledTimes(2);
    expect(Toast.error).toHaveBeenNthCalledWith(1, {
      title: 'feedback.hw_create_unsupported_address_title:Bitcoin:BIP86',
      message: 'Path not supported',
    });
    expect(Toast.error).toHaveBeenNthCalledWith(2, {
      title:
        'feedback.hw_create_unsupported_address_title:Bitcoin:Native Segwit',
      message: 'Another rejected path',
    });
    expect(mockAddDefaultNetworkAccounts).toHaveBeenCalledTimes(1);
    expect(mockCallAccountSelectorAction).toHaveBeenCalledWith('refresh', {
      num: 0,
    });
  });

  it('propagates account creation failures without refreshing or selecting', async () => {
    const error = new Error('Account creation failed');
    mockAddDefaultNetworkAccounts.mockRejectedValueOnce(error);

    await expect(createAllNetworkAddress(true)).rejects.toBe(error);

    expect(mockAddDefaultNetworkAccounts).toHaveBeenCalledTimes(1);
    expect(mockCallAccountSelectorAction).not.toHaveBeenCalled();
    expect(Toast.error).not.toHaveBeenCalled();
  });
});
