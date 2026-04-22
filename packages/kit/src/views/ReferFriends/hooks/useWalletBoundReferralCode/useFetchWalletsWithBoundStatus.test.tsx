/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

import { renderHook, waitFor } from '@testing-library/react-native';

type IWalletInfoGetter = () => Promise<unknown>;

type IGlobalNetInfo = {
  listeners: unknown[];
  state: {
    isInternetReachable: boolean | null;
  };
  prevIsInternetReachable: boolean;
};

const globalMockBag = globalThis as typeof globalThis & {
  __referralFetchBg?: {
    serviceAccount: {
      getWallets: jest.Mock;
    };
    serviceReferralCode: {
      batchCheckWalletsBoundReferralCodeV2: jest.Mock;
      batchCheckWalletsBoundReferralCode: jest.Mock;
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

function getReferralGlobalNetInfo(): IGlobalNetInfo {
  const mockBag = globalThis as typeof globalThis & {
    __referralGlobalNetInfo?: IGlobalNetInfo;
  };
  return (
    mockBag.__referralGlobalNetInfo ?? {
      listeners: [],
      state: {
        isInternetReachable: null,
      },
      prevIsInternetReachable: false,
    }
  );
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

jest.mock('@onekeyhq/components', () => {
  const deferredPromiseModule = require('../../../../../../components/src/hooks/useDeferredPromise');
  const netInfoModule = require('../../../../../../components/src/hooks/useNetInfo');
  (
    globalThis as typeof globalThis & {
      __referralGlobalNetInfo?: IGlobalNetInfo;
    }
  ).__referralGlobalNetInfo = netInfoModule.globalNetInfo as IGlobalNetInfo;

  return {
    __esModule: true,
    getCurrentVisibilityState: () => true,
    onVisibilityStateChange: () => () => {},
    useDeferredPromise: deferredPromiseModule.useDeferredPromise,
    useNetInfo: netInfoModule.useNetInfo,
  };
});

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
      batchCheckWalletsBoundReferralCode: jest.fn(),
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
    const globalNetInfo = getReferralGlobalNetInfo();
    globalNetInfo.listeners = [];
    globalNetInfo.state = { isInternetReachable: null };
    globalNetInfo.prevIsInternetReachable = false;

    globalMockBag.__referralFetchWalletInfoMock = jest
      .fn()
      .mockResolvedValue(createWalletInfo());

    globalMockBag.__referralFetchBg?.serviceAccount.getWallets.mockResolvedValue(
      {
        wallets: [createWallet()],
      },
    );
    globalMockBag.__referralFetchBg?.serviceReferralCode.setWalletReferralCode.mockResolvedValue(
      undefined,
    );
    globalMockBag.__referralFetchBg?.serviceReferralCode.getWalletReferralCode.mockResolvedValue(
      null,
    );
  });

  it('preserves cached bindable during V1 fallback when V2 is unavailable', async () => {
    globalMockBag.__referralFetchBg?.serviceReferralCode.batchCheckWalletsBoundReferralCodeV2.mockRejectedValue(
      new Error('not found'),
    );
    globalMockBag.__referralFetchBg?.serviceReferralCode.batchCheckWalletsBoundReferralCode.mockResolvedValue(
      {
        'evm--1:0xabc': false,
      },
    );
    globalMockBag.__referralFetchBg?.serviceReferralCode.getWalletReferralCode.mockResolvedValue(
      {
        walletId: 'hd-1',
        isBound: false,
        bindable: false,
      },
    );

    const { result } = renderHook(() => useFetchWalletsWithBoundStatus());

    await waitFor(() => {
      expect(result.current.walletsWithStatus).toEqual([
        expect.objectContaining({
          wallet: expect.objectContaining({ id: 'hd-1' }),
          isBound: false,
          bindable: false,
          reason: undefined,
        }),
      ]);
    });

    expect(
      globalMockBag.__referralFetchBg?.serviceReferralCode
        .batchCheckWalletsBoundReferralCode,
    ).toHaveBeenCalledWith([
      {
        address: '0xabc',
        networkId: 'evm--1',
      },
    ]);
    expect(
      globalMockBag.__referralFetchBg?.serviceReferralCode
        .setWalletReferralCode,
    ).toHaveBeenCalledWith({
      walletId: 'hd-1',
      referralCodeInfo: {
        walletId: 'hd-1',
        address: '0xabc',
        networkId: 'evm--1',
        pubkey: 'pubkey-1',
        isBound: false,
        bindable: false,
        bindWindowReason: undefined,
      },
    });
  });

  it('keeps cached status and skips persistence when both batch APIs fail', async () => {
    globalMockBag.__referralFetchBg?.serviceReferralCode.batchCheckWalletsBoundReferralCodeV2.mockRejectedValue(
      new Error('server failed'),
    );
    globalMockBag.__referralFetchBg?.serviceReferralCode.batchCheckWalletsBoundReferralCode.mockRejectedValue(
      new Error('server failed'),
    );
    globalMockBag.__referralFetchBg?.serviceReferralCode.getWalletReferralCode.mockResolvedValue(
      {
        walletId: 'hd-1',
        isBound: false,
        bindable: false,
        bindWindowReason: 'exceeded_bind_window',
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
        }),
      ]);
    });

    expect(
      globalMockBag.__referralFetchBg?.serviceReferralCode
        .setWalletReferralCode,
    ).not.toHaveBeenCalled();
  });

  it('uses V2 bindability and reason when the server supports the new API', async () => {
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
        }),
      ]);
    });

    expect(
      globalMockBag.__referralFetchBg?.serviceReferralCode
        .batchCheckWalletsBoundReferralCode,
    ).not.toHaveBeenCalled();
    expect(
      globalMockBag.__referralFetchBg?.serviceReferralCode
        .getWalletReferralCode,
    ).not.toHaveBeenCalled();
    expect(
      globalMockBag.__referralFetchBg?.serviceReferralCode
        .setWalletReferralCode,
    ).toHaveBeenCalledWith({
      walletId: 'hd-1',
      referralCodeInfo: {
        walletId: 'hd-1',
        address: '0xabc',
        networkId: 'evm--1',
        pubkey: 'pubkey-1',
        isBound: false,
        bindable: false,
        bindWindowReason: 'exceeded_bind_window',
      },
    });
  });
});
