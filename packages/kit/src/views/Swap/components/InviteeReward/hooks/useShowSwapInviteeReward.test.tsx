/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

import { act, renderHook, waitFor } from '@testing-library/react-native';

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const dialogShow = jest.fn(() => ({ close: jest.fn() }));
  return {
    __esModule: true,
    __dialogShow: dialogShow,
    useInTabDialog: () => ({
      show: dialogShow,
    }),
    useMedia: () => ({
      gtMd: true,
    }),
  };
});

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => {
  const pushModal = jest.fn();
  return {
    __esModule: true,
    default: () => ({
      pushModal,
    }),
  };
});

jest.mock(
  '@onekeyhq/kit/src/views/ReferFriends/hooks/useWalletBoundReferralCode',
  () => {
    const bindWalletInviteCode = jest.fn();
    const getReferralCodeBondStatus = jest.fn();
    return {
      __esModule: true,
      __referralMocks: {
        bindWalletInviteCode,
        getReferralCodeBondStatus,
      },
      useWalletBoundReferralCode: () => ({
        bindWalletInviteCode,
        getReferralCodeBondStatus,
      }),
    };
  },
);

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => {
  const getReferralCodeWalletInfo = jest.fn();
  const getWallet = jest.fn();
  return {
    __esModule: true,
    __backgroundMocks: {
      getReferralCodeWalletInfo,
      getWallet,
    },
    default: {
      serviceAccount: {
        getWallet,
      },
      serviceReferralCode: {
        getReferralCodeWalletInfo,
      },
    },
  };
});

jest.mock('@onekeyhq/shared/src/config/networkIds', () => ({
  getNetworkIdsMap: () => ({
    eth: 'evm--1',
  }),
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNative: false,
  },
}));

jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: {
    getWalletIdFromAccountId: ({ accountId }: { accountId: string }) =>
      accountId.split('--')[0],
  },
}));

jest.mock('../SwapInviteeRewardContent', () => ({
  SwapInviteeRewardContent: () => null,
}));

import { useShowSwapInviteeReward } from './useShowSwapInviteeReward';

function getMocks() {
  const dialogShow = jest.requireMock('@onekeyhq/components')
    .__dialogShow as jest.Mock;
  const { bindWalletInviteCode, getReferralCodeBondStatus } = jest.requireMock(
    '@onekeyhq/kit/src/views/ReferFriends/hooks/useWalletBoundReferralCode',
  ).__referralMocks;
  const { getReferralCodeWalletInfo, getWallet } = jest.requireMock(
    '@onekeyhq/kit/src/background/instance/backgroundApiProxy',
  ).__backgroundMocks;
  return {
    bindWalletInviteCode: bindWalletInviteCode as jest.Mock,
    dialogShow,
    getReferralCodeBondStatus: getReferralCodeBondStatus as jest.Mock,
    getReferralCodeWalletInfo: getReferralCodeWalletInfo as jest.Mock,
    getWallet: getWallet as jest.Mock,
  };
}

describe('useShowSwapInviteeReward', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const mocks = getMocks();
    mocks.getWallet.mockResolvedValue({
      id: 'hd-1',
      name: 'Wallet 1',
    });
  });

  it('prompts an eligible unbound EVM wallet before opening rewards', async () => {
    const mocks = getMocks();
    mocks.getReferralCodeWalletInfo.mockResolvedValue({
      address: '0xabc',
      networkId: 'evm--1',
    });
    mocks.getReferralCodeBondStatus.mockResolvedValue(true);

    const { result } = renderHook(() =>
      useShowSwapInviteeReward({
        accountId: "hd-1--m/44'/60'/0'/0/0",
      }),
    );

    act(() => {
      result.current.showSwapInviteeReward();
    });

    await waitFor(() => {
      expect(mocks.bindWalletInviteCode).toHaveBeenCalledTimes(1);
    });
    expect(mocks.getReferralCodeBondStatus).toHaveBeenCalledWith({
      walletId: 'hd-1',
      skipIfTimeout: true,
    });
    expect(mocks.dialogShow).not.toHaveBeenCalled();

    const bindParams = mocks.bindWalletInviteCode.mock.calls[0][0] as {
      onClose: () => void;
      onSuccess: () => void;
    };
    act(() => {
      bindParams.onSuccess();
    });
    expect(mocks.dialogShow).not.toHaveBeenCalled();

    act(() => {
      bindParams.onClose();
    });
    expect(mocks.dialogShow).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['binding is not required', false],
    ['binding status is unavailable', new Error('status unavailable')],
  ])('opens rewards directly when %s', async (_name, bondStatus) => {
    const mocks = getMocks();
    mocks.getReferralCodeWalletInfo.mockResolvedValue({
      address: '0xabc',
      networkId: 'evm--1',
    });
    if (bondStatus instanceof Error) {
      mocks.getReferralCodeBondStatus.mockRejectedValue(bondStatus);
    } else {
      mocks.getReferralCodeBondStatus.mockResolvedValue(bondStatus);
    }

    const { result } = renderHook(() =>
      useShowSwapInviteeReward({
        accountId: "hd-1--m/44'/60'/0'/0/0",
      }),
    );

    act(() => {
      result.current.showSwapInviteeReward();
    });

    await waitFor(() => {
      expect(mocks.dialogShow).toHaveBeenCalledTimes(1);
    });
    expect(mocks.bindWalletInviteCode).not.toHaveBeenCalled();
  });

  it('allows another attempt after the binding dialog is closed', async () => {
    const mocks = getMocks();
    mocks.getReferralCodeWalletInfo.mockResolvedValue({
      address: '0xabc',
      networkId: 'evm--1',
    });
    mocks.getReferralCodeBondStatus.mockResolvedValue(true);

    const { result } = renderHook(() =>
      useShowSwapInviteeReward({
        accountId: "hd-1--m/44'/60'/0'/0/0",
      }),
    );

    act(() => {
      result.current.showSwapInviteeReward();
    });

    await waitFor(() => {
      expect(mocks.bindWalletInviteCode).toHaveBeenCalledTimes(1);
    });

    const firstBindParams = mocks.bindWalletInviteCode.mock.calls[0][0] as {
      onClose: () => void;
    };
    act(() => {
      firstBindParams.onClose();
      result.current.showSwapInviteeReward();
    });

    await waitFor(() => {
      expect(mocks.bindWalletInviteCode).toHaveBeenCalledTimes(2);
    });
  });

  it('does not offer binding to a BTC-only wallet unsupported by Swap rewards', async () => {
    const mocks = getMocks();
    mocks.getReferralCodeWalletInfo.mockResolvedValue({
      address: 'bc1p-wallet',
      networkId: 'btc--0',
    });

    const { result } = renderHook(() =>
      useShowSwapInviteeReward({
        accountId: "hw-1--m/86'/0'/0'",
      }),
    );

    act(() => {
      result.current.showSwapInviteeReward();
    });

    await waitFor(() => {
      expect(mocks.dialogShow).toHaveBeenCalledTimes(1);
    });
    expect(mocks.getReferralCodeBondStatus).not.toHaveBeenCalled();
    expect(mocks.bindWalletInviteCode).not.toHaveBeenCalled();
  });

  it('ignores a pending binding check after the active account changes', async () => {
    const mocks = getMocks();
    let resolveWalletInfo:
      | ((value: { address: string; networkId: string }) => void)
      | undefined;
    mocks.getReferralCodeWalletInfo.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveWalletInfo = resolve;
        }),
    );

    const { rerender, result } = renderHook(
      ({ accountId }: { accountId: string }) =>
        useShowSwapInviteeReward({ accountId }),
      {
        initialProps: {
          accountId: "hd-1--m/44'/60'/0'/0/0",
        },
      },
    );

    act(() => {
      result.current.showSwapInviteeReward();
    });
    rerender({
      accountId: "hd-2--m/44'/60'/0'/0/0",
    });
    await act(async () => {
      resolveWalletInfo?.({
        address: '0xabc',
        networkId: 'evm--1',
      });
      await Promise.resolve();
    });

    expect(mocks.getReferralCodeBondStatus).not.toHaveBeenCalled();
    expect(mocks.bindWalletInviteCode).not.toHaveBeenCalled();
    expect(mocks.dialogShow).not.toHaveBeenCalled();
  });
});
