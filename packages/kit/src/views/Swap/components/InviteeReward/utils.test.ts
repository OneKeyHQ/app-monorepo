import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import {
  getSwapInviteeRewardActionPlacement,
  loadSwapInviteeReward,
} from './utils';

const ethNetworkId = 'evm--1';

const rewardData = {
  totalBonus: '12',
  undistributed: '3',
  token: {
    networkId: ethNetworkId,
    address: '0xToken',
    logoURI: 'https://example.com/usdc.png',
    name: 'USD Coin',
    symbol: 'USDC',
  },
  history: [],
};

describe('getSwapInviteeRewardActionPlacement', () => {
  test.each([
    {
      expected: 'desktopHeader',
      isDesktop: true,
      isMediumLayout: false,
      isModal: false,
      swapTypeSwitch: ESwapTabSwitchType.SWAP,
    },
    {
      expected: 'desktopHeader',
      isDesktop: true,
      isMediumLayout: false,
      isModal: false,
      swapTypeSwitch: ESwapTabSwitchType.BRIDGE,
    },
    {
      expected: 'swapHeader',
      isDesktop: true,
      isMediumLayout: true,
      isModal: false,
      swapTypeSwitch: ESwapTabSwitchType.SWAP,
    },
    {
      expected: 'swapHeader',
      isDesktop: false,
      isMediumLayout: false,
      isModal: false,
      swapTypeSwitch: ESwapTabSwitchType.SWAP,
    },
    {
      expected: 'mobileSettings',
      isDesktop: false,
      isMediumLayout: true,
      isModal: false,
      isNative: true,
      swapTypeSwitch: ESwapTabSwitchType.SWAP,
    },
    {
      expected: 'hidden',
      isDesktop: true,
      isMediumLayout: false,
      isModal: true,
      swapTypeSwitch: ESwapTabSwitchType.SWAP,
    },
    {
      expected: 'hidden',
      isDesktop: true,
      isMediumLayout: false,
      isModal: false,
      pendingRouteSwapType: ESwapTabSwitchType.LIMIT,
      swapTypeSwitch: ESwapTabSwitchType.SWAP,
    },
    {
      expected: 'desktopHeader',
      isDesktop: true,
      isMediumLayout: false,
      isModal: false,
      pendingRouteSwapType: ESwapTabSwitchType.SWAP,
      swapTypeSwitch: ESwapTabSwitchType.LIMIT,
    },
    {
      expected: 'hidden',
      isDesktop: true,
      isMediumLayout: false,
      isModal: false,
      swapTypeSwitch: ESwapTabSwitchType.LIMIT,
    },
  ])(
    'places the action in $expected for the current surface',
    ({
      expected,
      isDesktop,
      isMediumLayout,
      isModal,
      isNative,
      pendingRouteSwapType,
      swapTypeSwitch,
    }) => {
      expect(
        getSwapInviteeRewardActionPlacement({
          isDesktop,
          isMediumLayout,
          isModal,
          isNative,
          pendingRouteSwapType,
          swapTypeSwitch,
        }),
      ).toBe(expected);
    },
  );
});

describe('loadSwapInviteeReward', () => {
  test.each([
    {
      accountId: "hd-1--m/86'/0'/0'",
      name: 'a BTC-only representative address',
      walletId: 'hd-1',
      walletInfo: {
        address: 'bc1q-wallet',
        networkId: 'btc--0',
      },
    },
    {
      accountId: 'external--60--0xabc',
      name: 'an unsupported wallet',
      walletId: 'external',
      walletInfo: null,
    },
  ])(
    'does not request rewards for $name',
    async ({ accountId, walletId, walletInfo }) => {
      const getReferralCodeWalletInfo = jest.fn().mockResolvedValue(walletInfo);
      const getSwapInviteeRewards = jest.fn();

      await expect(
        loadSwapInviteeReward({
          accountId,
          dependencies: {
            ethNetworkId,
            getReferralCodeWalletInfo,
            getSwapInviteeRewards,
          },
        }),
      ).resolves.toEqual({ status: 'unsupported' });

      expect(getReferralCodeWalletInfo).toHaveBeenCalledWith({ walletId });
      expect(getSwapInviteeRewards).not.toHaveBeenCalled();
    },
  );

  test('queries the ETH representative address without a network filter', async () => {
    const getReferralCodeWalletInfo = jest.fn().mockResolvedValue({
      address: '0xAbCdEf',
      networkId: ethNetworkId,
    });
    const getSwapInviteeRewards = jest.fn().mockResolvedValue(rewardData);

    await expect(
      loadSwapInviteeReward({
        accountId: "hd-2--m/44'/60'/0'/0/0",
        dependencies: {
          ethNetworkId,
          getReferralCodeWalletInfo,
          getSwapInviteeRewards,
        },
      }),
    ).resolves.toEqual({ status: 'success', data: rewardData });

    expect(getReferralCodeWalletInfo).toHaveBeenCalledWith({
      walletId: 'hd-2',
    });
    expect(getSwapInviteeRewards).toHaveBeenCalledWith({
      walletAddress: '0xAbCdEf',
    });
  });

  test('returns an error state when the rewards request fails', async () => {
    const getReferralCodeWalletInfo = jest.fn().mockResolvedValue({
      address: '0xAbCdEf',
      networkId: ethNetworkId,
    });
    const getSwapInviteeRewards = jest
      .fn()
      .mockRejectedValue(new Error('request failed'));

    await expect(
      loadSwapInviteeReward({
        accountId: "hd-2--m/44'/60'/0'/0/0",
        dependencies: {
          ethNetworkId,
          getReferralCodeWalletInfo,
          getSwapInviteeRewards,
        },
      }),
    ).resolves.toEqual({ status: 'error' });
  });
});
