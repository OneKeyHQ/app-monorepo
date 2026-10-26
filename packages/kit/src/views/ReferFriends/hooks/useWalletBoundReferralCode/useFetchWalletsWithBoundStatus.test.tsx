/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

import { renderHook, waitFor } from '@testing-library/react-native';

import { EHardwareVendor } from '@onekeyhq/shared/types/device';

type IWalletInfoGetter = () => Promise<unknown>;

type IDeferredPromise = {
  promise: Promise<null>;
  resolve: jest.Mock;
  reset: jest.Mock;
};

const globalMockBag = globalThis as typeof globalThis & {
  __referralFetchBg?: {
    serviceAccount: {
      getWallets: jest.Mock;
    };
    serviceReferralCode: {
      batchCheckWalletsBoundReferralCodeV2: jest.Mock;
      getWalletReferralCode: jest.Mock;
      setWalletReferralCode: jest.Mock;
    };
  };
  __referralFetchWalletInfoMock?: jest.Mock;
};

function getFetchWalletInfoMock(): IWalletInfoGetter {
  const mockBag = globalThis as typeof globalThis & {
    __referralFetchWalletInfoMock?: IWalletInfoGetter;
  };
  return mockBag.__referralFetchWalletInfoMock ?? (async () => null);
}

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

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => true,
  useRouteIsFocusedWhenEnabled: () => true,
}));

jest.mock('@onekeyhq/components', () => ({
  __esModule: true,
  getCurrentVisibilityState: () => true,
  onVisibilityStateChange: () => () => {},
  useDeferredPromise: (): IDeferredPromise => ({
    promise: Promise.resolve(null),
    resolve: jest.fn(),
    reset: jest.fn(),
  }),
  useNetInfo: () => ({
    isRawInternetReachable: true,
  }),
}));

jest.mock('./useGetReferralCodeWalletInfo', () => ({
  useGetReferralCodeWalletInfo: () => getFetchWalletInfoMock(),
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => {
  const proxy = {
    serviceAccount: {
      getWallets: jest.fn(),
    },
    serviceReferralCode: {
      batchCheckWalletsBoundReferralCodeV2: jest.fn(),
      getWalletReferralCode: jest.fn(),
      setWalletReferralCode: jest.fn(),
    },
  };
  (globalThis as any).__referralFetchBg = proxy;
  return {
    __esModule: true,
    default: proxy,
  };
});

import { useFetchWalletsWithBoundStatus } from './useFetchWalletsWithBoundStatus';

function createWallet() {
  return {
    id: 'hd-1',
    name: 'Wallet 1',
    passphraseState: undefined,
  };
}

function createWalletInfo() {
  return {
    walletId: 'hd-1',
    wallet: createWallet(),
    accountId: "hd-1--m/44'/60'/0'/0/0",
    address: '0xabc',
    networkId: 'evm--1',
    pubkey: 'pubkey-1',
    isBtcOnlyWallet: false,
  };
}

describe('useFetchWalletsWithBoundStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    globalMockBag.__referralFetchWalletInfoMock = jest
      .fn()
      .mockResolvedValue(createWalletInfo());

    globalMockBag.__referralFetchBg?.serviceAccount.getWallets.mockResolvedValue(
      {
        wallets: [createWallet()],
      },
    );
    globalMockBag.__referralFetchBg?.serviceReferralCode.getWalletReferralCode.mockResolvedValue(
      null,
    );
    globalMockBag.__referralFetchBg?.serviceReferralCode.setWalletReferralCode.mockResolvedValue(
      undefined,
    );
  });

  it('excludes Ledger and Trezor before fetching referral wallet info', async () => {
    const wallets = [
      createWallet(),
      {
        id: 'hw-onekey',
        associatedDeviceInfo: { vendor: EHardwareVendor.onekey },
      },
      { id: 'hw-legacy-onekey' },
      {
        id: 'hw-ledger',
        associatedDeviceInfo: { vendor: EHardwareVendor.ledger },
      },
      {
        id: 'hw-trezor',
        associatedDeviceInfo: { vendor: EHardwareVendor.trezor },
      },
      { id: 'hw-hidden', passphraseState: 'hidden' },
      { id: 'watching' },
    ];
    globalMockBag.__referralFetchBg?.serviceAccount.getWallets.mockResolvedValue(
      { wallets },
    );
    globalMockBag.__referralFetchBg?.serviceReferralCode.batchCheckWalletsBoundReferralCodeV2.mockResolvedValue(
      {
        'evm--1:0xabc': { bound: false, bindable: true },
      },
    );

    const { result } = renderHook(() => useFetchWalletsWithBoundStatus());

    await waitFor(() => {
      expect(
        result.current.walletsWithStatus?.map(({ wallet }) => wallet.id),
      ).toEqual(['hd-1', 'hw-onekey', 'hw-legacy-onekey']);
    });
    expect(globalMockBag.__referralFetchWalletInfoMock?.mock.calls).toEqual([
      ['hd-1'],
      ['hw-onekey'],
      ['hw-legacy-onekey'],
    ]);
  });

  it('returns an empty list without querying referral status for only third-party wallets', async () => {
    globalMockBag.__referralFetchBg?.serviceAccount.getWallets.mockResolvedValue(
      {
        wallets: [
          {
            id: 'hw-ledger',
            associatedDeviceInfo: { vendor: EHardwareVendor.ledger },
          },
          {
            id: 'hw-trezor',
            associatedDeviceInfo: { vendor: EHardwareVendor.trezor },
          },
        ],
      },
    );

    const { result } = renderHook(() => useFetchWalletsWithBoundStatus());

    await waitFor(() => {
      expect(result.current.walletsWithStatus).toEqual([]);
    });
    expect(globalMockBag.__referralFetchWalletInfoMock).not.toHaveBeenCalled();
    expect(
      globalMockBag.__referralFetchBg?.serviceReferralCode
        .batchCheckWalletsBoundReferralCodeV2,
    ).not.toHaveBeenCalled();
  });

  it('uses V2 for UI status even when local data says bound', async () => {
    globalMockBag.__referralFetchBg?.serviceReferralCode.getWalletReferralCode.mockResolvedValue(
      {
        walletId: 'hd-1',
        isBound: true,
        bindable: false,
      },
    );
    globalMockBag.__referralFetchBg?.serviceReferralCode.batchCheckWalletsBoundReferralCodeV2.mockResolvedValue(
      {
        'evm--1:0xabc': {
          bound: false,
          bindable: false,
          reason: 'exceeded_bind_window',
        },
      },
    );

    const { result } = renderHook(() => useFetchWalletsWithBoundStatus());

    await waitFor(() => {
      expect(result.current.walletsWithStatus).toEqual([
        expect.objectContaining({
          wallet: expect.objectContaining({ id: 'hd-1' }),
          isBound: false,
          bindable: false,
          reason: 'exceeded_bind_window',
          status: 'expired',
        }),
      ]);
    });

    expect(
      globalMockBag.__referralFetchBg?.serviceReferralCode
        .batchCheckWalletsBoundReferralCodeV2,
    ).toHaveBeenCalled();
    expect(
      globalMockBag.__referralFetchBg?.serviceReferralCode
        .setWalletReferralCode,
    ).not.toHaveBeenCalled();
  });

  it('returns unknown and skips persistence when V2 fails', async () => {
    globalMockBag.__referralFetchBg?.serviceReferralCode.batchCheckWalletsBoundReferralCodeV2.mockRejectedValue(
      new Error('server failed'),
    );

    const { result } = renderHook(() => useFetchWalletsWithBoundStatus());

    await waitFor(() => {
      expect(result.current.walletsWithStatus).toEqual([
        expect.objectContaining({
          wallet: expect.objectContaining({ id: 'hd-1' }),
          isBound: false,
          status: 'unknown',
        }),
      ]);
    });
    expect(result.current.walletsWithStatus?.[0]).not.toEqual(
      expect.objectContaining({
        bindable: false,
      }),
    );
    expect(
      globalMockBag.__referralFetchBg?.serviceReferralCode
        .setWalletReferralCode,
    ).not.toHaveBeenCalled();
  });

  it('returns unknown and skips persistence when V2 omits the wallet', async () => {
    globalMockBag.__referralFetchBg?.serviceReferralCode.batchCheckWalletsBoundReferralCodeV2.mockResolvedValue(
      {},
    );

    const { result } = renderHook(() => useFetchWalletsWithBoundStatus());

    await waitFor(() => {
      expect(result.current.walletsWithStatus).toEqual([
        expect.objectContaining({
          wallet: expect.objectContaining({ id: 'hd-1' }),
          isBound: false,
          status: 'unknown',
        }),
      ]);
    });
    expect(
      globalMockBag.__referralFetchBg?.serviceReferralCode
        .setWalletReferralCode,
    ).not.toHaveBeenCalled();
  });

  it('shows expired only when V2 reports unbound expired', async () => {
    globalMockBag.__referralFetchBg?.serviceReferralCode.batchCheckWalletsBoundReferralCodeV2.mockResolvedValue(
      {
        'evm--1:0xabc': {
          bound: false,
          bindable: false,
          reason: 'exceeded_bind_window',
        },
      },
    );

    const { result } = renderHook(() => useFetchWalletsWithBoundStatus());

    await waitFor(() => {
      expect(result.current.walletsWithStatus).toEqual([
        expect.objectContaining({
          wallet: expect.objectContaining({ id: 'hd-1' }),
          isBound: false,
          bindable: false,
          reason: 'exceeded_bind_window',
          status: 'expired',
        }),
      ]);
    });
    expect(
      globalMockBag.__referralFetchBg?.serviceReferralCode
        .setWalletReferralCode,
    ).not.toHaveBeenCalled();
  });

  it('keeps bound higher priority than expiration from V2', async () => {
    globalMockBag.__referralFetchBg?.serviceReferralCode.batchCheckWalletsBoundReferralCodeV2.mockResolvedValue(
      {
        'evm--1:0xabc': {
          bound: true,
          bindable: false,
          reason: 'exceeded_bind_window',
        },
      },
    );

    const { result } = renderHook(() => useFetchWalletsWithBoundStatus());

    await waitFor(() => {
      expect(result.current.walletsWithStatus).toEqual([
        expect.objectContaining({
          wallet: expect.objectContaining({ id: 'hd-1' }),
          isBound: true,
          bindable: false,
          reason: undefined,
          status: 'bound',
        }),
      ]);
    });
  });

  it('treats unbound non-expired V2 status as bindable', async () => {
    globalMockBag.__referralFetchBg?.serviceReferralCode.batchCheckWalletsBoundReferralCodeV2.mockResolvedValue(
      {
        'evm--1:0xabc': {
          bound: false,
          bindable: false,
        },
      },
    );

    const { result } = renderHook(() => useFetchWalletsWithBoundStatus());

    await waitFor(() => {
      expect(result.current.walletsWithStatus).toEqual([
        expect.objectContaining({
          wallet: expect.objectContaining({ id: 'hd-1' }),
          isBound: false,
          bindable: true,
          reason: undefined,
          status: 'bindable',
        }),
      ]);
    });
  });
});
