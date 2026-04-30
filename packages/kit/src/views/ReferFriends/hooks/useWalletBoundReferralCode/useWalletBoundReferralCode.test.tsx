/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

import { act, renderHook, waitFor } from '@testing-library/react-native';

type IWalletInfoGetter = (walletId: string | undefined) => Promise<unknown>;

const globalMockBag = globalThis as typeof globalThis & {
  __referralBg?: {
    serviceReferralCode: {
      getWalletReferralCode: jest.Mock;
      checkWalletBindStatus: jest.Mock;
      setWalletReferralCode: jest.Mock;
      setCachedInviteCode: jest.Mock;
      getBoundReferralCodeUnsignedMessage: jest.Mock;
      autoSignBoundReferralCodeMessageByHDWallet: jest.Mock;
      boundReferralCodeWithSignedMessage: jest.Mock;
    };
  };
  __referralDialog?: {
    show: jest.Mock;
  };
  __referralToast?: {
    success: jest.Mock;
    error: jest.Mock;
  };
  __referralWalletInfoMock?: jest.Mock;
};

function getWalletInfoMock(): IWalletInfoGetter {
  const mockBag = globalThis as typeof globalThis & {
    __referralWalletInfoMock?: IWalletInfoGetter;
  };
  return mockBag.__referralWalletInfoMock ?? (async () => null);
}

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const dialog = {
    show: jest.fn(),
  };
  const toast = {
    success: jest.fn(),
    error: jest.fn(),
  };
  (globalThis as any).__referralDialog = dialog;
  (globalThis as any).__referralToast = toast;
  return {
    __esModule: true,
    EInPageDialogType: {
      inModalPage: 'inModalPage',
      inTabPages: 'inTabPages',
    },
    Toast: toast,
    useInPageDialog: () => dialog,
  };
});

jest.mock('@onekeyhq/shared/src/utils/messageUtils', () => ({
  autoFixPersonalSignMessage: ({ message }: { message: string }) => message,
}));

jest.mock('./InviteCodeDialog', () => ({
  InviteCodeDialog: () => null,
}));

jest.mock('./useGetReferralCodeWalletInfo', () => ({
  useGetReferralCodeWalletInfo: () => getWalletInfoMock(),
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => {
  const proxy = {
    serviceReferralCode: {
      getWalletReferralCode: jest.fn(),
      checkWalletBindStatus: jest.fn(),
      setWalletReferralCode: jest.fn(),
      setCachedInviteCode: jest.fn(),
      getBoundReferralCodeUnsignedMessage: jest.fn(),
      autoSignBoundReferralCodeMessageByHDWallet: jest.fn(),
      boundReferralCodeWithSignedMessage: jest.fn(),
    },
  };
  (globalThis as any).__referralBg = proxy;
  return {
    __esModule: true,
    default: proxy,
  };
});

import { useWalletBoundReferralCode } from './useWalletBoundReferralCode';

function createWalletInfo() {
  return {
    walletId: 'hd-1',
    wallet: {
      id: 'hd-1',
      name: 'Wallet 1',
    } as never,
    accountId: "hd-1--m/44'/60'/0'/0/0",
    address: '0xabc',
    networkId: 'evm--1',
    pubkey: 'pubkey-1',
    isBtcOnlyWallet: false,
  };
}

describe('useWalletBoundReferralCode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();

    globalMockBag.__referralWalletInfoMock = jest
      .fn()
      .mockResolvedValue(createWalletInfo());

    globalMockBag.__referralBg?.serviceReferralCode.getWalletReferralCode.mockResolvedValue(
      null,
    );
    globalMockBag.__referralBg?.serviceReferralCode.checkWalletBindStatus.mockResolvedValue(
      {
        data: false,
        bindable: true,
      },
    );
    globalMockBag.__referralBg?.serviceReferralCode.setWalletReferralCode.mockResolvedValue(
      undefined,
    );
  });

  it('persists fresh bind status and opens the bind path for bindable wallets', async () => {
    const { result } = renderHook(() => useWalletBoundReferralCode());

    let shouldBind = false;
    await act(async () => {
      shouldBind = await result.current.getReferralCodeBondStatus({
        walletId: 'hd-1',
      });
    });

    expect(shouldBind).toBe(true);

    await waitFor(() => {
      expect(result.current.shouldBondReferralCode).toBe(true);
    });

    expect(
      globalMockBag.__referralBg?.serviceReferralCode.setWalletReferralCode,
    ).toHaveBeenCalledWith({
      walletId: 'hd-1',
      referralCodeInfo: {
        walletId: 'hd-1',
        address: '0xabc',
        networkId: 'evm--1',
        pubkey: 'pubkey-1',
        isBound: false,
        bindable: true,
        bindWindowReason: undefined,
      },
    });
  });

  it('falls back to cached expired status when the server check fails', async () => {
    globalMockBag.__referralBg?.serviceReferralCode.getWalletReferralCode.mockResolvedValue(
      {
        walletId: 'hd-1',
        isBound: false,
        bindable: false,
        bindWindowReason: 'exceeded_bind_window',
      },
    );
    globalMockBag.__referralBg?.serviceReferralCode.checkWalletBindStatus.mockRejectedValue(
      new Error('server failed'),
    );

    const { result } = renderHook(() => useWalletBoundReferralCode());

    let shouldBind = true;
    await act(async () => {
      shouldBind = await result.current.getReferralCodeBondStatus({
        walletId: 'hd-1',
      });
    });

    expect(shouldBind).toBe(false);
    expect(result.current.shouldBondReferralCode).toBeUndefined();
    expect(
      globalMockBag.__referralBg?.serviceReferralCode.setWalletReferralCode,
    ).not.toHaveBeenCalled();
  });

  it('does not show bind path from cached positive status when the server check fails', async () => {
    globalMockBag.__referralBg?.serviceReferralCode.getWalletReferralCode.mockResolvedValue(
      {
        walletId: 'hd-1',
        isBound: false,
        bindable: true,
      },
    );
    globalMockBag.__referralBg?.serviceReferralCode.checkWalletBindStatus.mockRejectedValue(
      new Error('server failed'),
    );

    const { result } = renderHook(() => useWalletBoundReferralCode());

    let shouldBind = true;
    await act(async () => {
      shouldBind = await result.current.getReferralCodeBondStatus({
        walletId: 'hd-1',
      });
    });

    expect(shouldBind).toBe(false);
    expect(result.current.shouldBondReferralCode).toBeUndefined();
    expect(
      globalMockBag.__referralBg?.serviceReferralCode.setWalletReferralCode,
    ).not.toHaveBeenCalled();
  });

  it('skips local persistence when the bind-status request times out', async () => {
    const setTimeoutSpy = jest.spyOn(
      globalThis,
      'setTimeout',
    ) as jest.SpiedFunction<typeof setTimeout>;
    setTimeoutSpy.mockImplementation(((callback: () => void) => {
      callback();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout);
    globalMockBag.__referralBg?.serviceReferralCode.checkWalletBindStatus.mockImplementation(
      () => new Promise(() => undefined),
    );

    const { result } = renderHook(() => useWalletBoundReferralCode());

    let shouldBind = true;
    await act(async () => {
      shouldBind = await result.current.getReferralCodeBondStatus({
        walletId: 'hd-1',
        skipIfTimeout: true,
      });
    });
    setTimeoutSpy.mockRestore();

    expect(shouldBind).toBe(false);
    expect(
      globalMockBag.__referralBg?.serviceReferralCode.setWalletReferralCode,
    ).not.toHaveBeenCalled();
    expect(result.current.shouldBondReferralCode).toBeUndefined();
  });
});
