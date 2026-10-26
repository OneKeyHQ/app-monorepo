/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

import { renderHook } from '@testing-library/react-native';

import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { FIRST_BTC_TAPROOT_ADDRESS_PATH } from '@onekeyhq/shared/src/engine/engineConsts';
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

import {
  lookupReferralCodeWallet,
  useGetReferralCodeWalletInfo,
} from './useGetReferralCodeWalletInfo';

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

    await expect(lookupReferralCodeWallet(wallet.id)).resolves.toMatchObject({
      status: 'ready',
      walletInfo: {
        walletId: wallet.id,
        address: account.address,
      },
    });
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

    await expect(lookupReferralCodeWallet(`hw-${vendor}`)).resolves.toEqual({
      status: 'unsupported',
    });
    await expect(result.current(`hw-${vendor}`)).resolves.toBeNull();
    expect(
      globalMockBag.__referralWalletLookupBg?.serviceAccount.getAccount,
    ).not.toHaveBeenCalled();
  });

  it('reports a hidden hardware wallet as unsupported', async () => {
    globalMockBag.__referralWalletLookupBg?.serviceAccount.getWallet.mockResolvedValue(
      {
        id: 'hw-1',
        passphraseState: 'secret',
      },
    );

    await expect(lookupReferralCodeWallet('hw-1')).resolves.toEqual({
      status: 'unsupported',
    });
    expect(
      globalMockBag.__referralWalletLookupBg?.serviceAccount.getAccount,
    ).not.toHaveBeenCalled();
  });

  it.each(['imported', 'watching', 'external', 'qr-1'])(
    'reports %s as unsupported before reading the wallet',
    async (walletId) => {
      await expect(lookupReferralCodeWallet(walletId)).resolves.toEqual({
        status: 'unsupported',
      });
      expect(
        globalMockBag.__referralWalletLookupBg?.serviceAccount.getWallet,
      ).not.toHaveBeenCalled();
    },
  );

  it('reports a missing wallet id as unavailable', async () => {
    await expect(lookupReferralCodeWallet(undefined)).resolves.toEqual({
      status: 'unavailable',
    });
  });

  it('keeps a wallet lookup error out of unsupported', async () => {
    globalMockBag.__referralWalletLookupBg?.serviceAccount.getWallet.mockRejectedValue(
      new Error('wallet not ready'),
    );

    await expect(lookupReferralCodeWallet('hd-1')).resolves.toEqual({
      status: 'unavailable',
    });
    const { result } = renderHook(() => useGetReferralCodeWalletInfo());
    await expect(result.current('hd-1')).resolves.toBeNull();
  });

  it('keeps a missing first account out of unsupported', async () => {
    globalMockBag.__referralWalletLookupBg?.serviceAccount.getWallet.mockResolvedValue(
      { id: 'hd-1' },
    );
    globalMockBag.__referralWalletLookupBg?.serviceAccount.getAccount.mockResolvedValue(
      null,
    );

    await expect(lookupReferralCodeWallet('hd-1')).resolves.toEqual({
      status: 'unavailable',
    });
  });

  it('keeps an account lookup error out of unsupported', async () => {
    globalMockBag.__referralWalletLookupBg?.serviceAccount.getWallet.mockResolvedValue(
      { id: 'hd-1' },
    );
    globalMockBag.__referralWalletLookupBg?.serviceAccount.getAccount.mockRejectedValue(
      new Error('account not ready'),
    );

    await expect(lookupReferralCodeWallet('hd-1')).resolves.toEqual({
      status: 'unavailable',
    });
  });

  it('resolves the first taproot account for a BTC-only wallet', async () => {
    globalMockBag.__referralWalletLookupBg?.serviceAccount.getWallet.mockResolvedValue(
      { id: 'hd-1' },
    );
    globalMockBag.__referralWalletLookupBg?.serviceHardware.isBtcOnlyWallet.mockResolvedValue(
      true,
    );
    globalMockBag.__referralWalletLookupBg?.serviceAccount.getAccount.mockResolvedValue(
      { address: 'bc1p', pub: 'btc-pub' },
    );

    await expect(lookupReferralCodeWallet('hd-1')).resolves.toMatchObject({
      status: 'ready',
      walletInfo: {
        networkId: getNetworkIdsMap().btc,
        address: 'bc1p',
        pubkey: 'btc-pub',
        isBtcOnlyWallet: true,
        accountId: `hd-1--${FIRST_BTC_TAPROOT_ADDRESS_PATH}`,
      },
    });
  });
});
