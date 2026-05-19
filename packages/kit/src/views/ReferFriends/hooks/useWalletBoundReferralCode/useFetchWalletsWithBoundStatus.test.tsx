/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

import { renderHook, waitFor } from '@testing-library/react-native';

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
  } as never;
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
