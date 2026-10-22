/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

import { renderHook } from '@testing-library/react-native';

import { EHardwareVendor } from '@onekeyhq/shared/types/device';

const globalMockBag = globalThis as typeof globalThis & {
  __referralWalletLookupBg?: {
    serviceAccount: {
      getWallet: jest.Mock;
      getAccount: jest.Mock;
    };
    serviceHardware: {
      isBtcOnlyWallet: jest.Mock;
    };
  };
};

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => {
  const proxy = {
    serviceAccount: {
      getWallet: jest.fn(),
      getAccount: jest.fn(),
    },
    serviceHardware: {
      isBtcOnlyWallet: jest.fn(),
    },
  };
  (globalThis as typeof globalMockBag).__referralWalletLookupBg = proxy;
  return {
    __esModule: true,
    default: proxy,
  };
});

import { useGetReferralCodeWalletInfo } from './useGetReferralCodeWalletInfo';

const account = {
  address: '0xabc',
  pub: 'pub',
};

describe('useGetReferralCodeWalletInfo', () => {
  beforeEach(() => {
    const bg = globalMockBag.__referralWalletLookupBg;
    bg?.serviceAccount.getWallet.mockReset();
    bg?.serviceAccount.getAccount.mockReset();
    bg?.serviceHardware.isBtcOnlyWallet.mockReset();
    bg?.serviceHardware.isBtcOnlyWallet.mockResolvedValue(false);
    bg?.serviceAccount.getAccount.mockResolvedValue(account);
  });

  it.each([
    ['an HD wallet', { id: 'hd-1' }],
    [
      'a OneKey hardware wallet',
      {
        id: 'hw-onekey',
        associatedDeviceInfo: { vendor: EHardwareVendor.onekey },
      },
    ],
    ['a legacy hardware wallet with no vendor', { id: 'hw-legacy' }],
  ])('resolves the first EVM account for %s', async (_label, wallet) => {
    globalMockBag.__referralWalletLookupBg?.serviceAccount.getWallet.mockResolvedValue(
      wallet,
    );
    const { result } = renderHook(() => useGetReferralCodeWalletInfo());

    await expect(result.current(wallet.id)).resolves.toMatchObject({
      walletId: wallet.id,
      address: account.address,
    });
  });

  it.each([
    EHardwareVendor.ledger,
    EHardwareVendor.trezor,
    EHardwareVendor.keystone,
  ])('rejects a %s wallet before looking up an account', async (vendor) => {
    globalMockBag.__referralWalletLookupBg?.serviceAccount.getWallet.mockResolvedValue(
      {
        id: `hw-${vendor}`,
        associatedDeviceInfo: { vendor },
      },
    );
    const { result } = renderHook(() => useGetReferralCodeWalletInfo());

    await expect(result.current(`hw-${vendor}`)).resolves.toBeNull();
    expect(
      globalMockBag.__referralWalletLookupBg?.serviceAccount.getAccount,
    ).not.toHaveBeenCalled();
  });
});
