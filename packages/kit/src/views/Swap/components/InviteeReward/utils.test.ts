import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import {
  getSwapActivityHubActionPlacement,
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

describe('getSwapActivityHubActionPlacement', () => {
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
      expected: 'settings',
      isDesktop: true,
      isMediumLayout: true,
      isModal: false,
      swapTypeSwitch: ESwapTabSwitchType.SWAP,
    },
    {
      expected: 'settings',
      isDesktop: false,
      isMediumLayout: false,
      isModal: false,
      swapTypeSwitch: ESwapTabSwitchType.SWAP,
    },
    {
      expected: 'settings',
      isDesktop: false,
      isMediumLayout: true,
      isModal: false,
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
    {
      expected: 'hidden',
      isDesktop: false,
      isMediumLayout: true,
      isModal: false,
      pendingRouteSwapType: ESwapTabSwitchType.LIMIT,
      swapTypeSwitch: ESwapTabSwitchType.SWAP,
    },
    {
      expected: 'settings',
      isDesktop: false,
      isMediumLayout: true,
      isModal: false,
      pendingRouteSwapType: ESwapTabSwitchType.SWAP,
      swapTypeSwitch: ESwapTabSwitchType.LIMIT,
    },
  ])(
    'places the action in $expected when desktop=$isDesktop medium=$isMediumLayout modal=$isModal type=$swapTypeSwitch pending=$pendingRouteSwapType',
    ({
      expected,
      isDesktop,
      isMediumLayout,
      isModal,
      pendingRouteSwapType,
      swapTypeSwitch,
    }) => {
      expect(
        getSwapActivityHubActionPlacement({
          isDesktop,
          isMediumLayout,
          isModal,
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

  test('queries the current logical account EVM address without a network filter', async () => {
    const accountId = "hd-2--m/501'/7'/0'";
    const getReferralCodeWalletInfo = jest.fn().mockResolvedValue({
      address: '0xFirstEvm',
      networkId: ethNetworkId,
    });
    const getSwapInviteeRewards = jest.fn().mockResolvedValue(rewardData);

    await expect(
      loadSwapInviteeReward({
        accountId,
        currentEvmAddress: '0xCurrent',
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
      walletAddress: '0xCurrent',
    });
  });

  test('does not request rewards when the current account has no EVM address', async () => {
    const getReferralCodeWalletInfo = jest.fn().mockResolvedValue({
      address: '0xFirstEvm',
      networkId: ethNetworkId,
    });
    const getSwapInviteeRewards = jest.fn();

    await expect(
      loadSwapInviteeReward({
        accountId: "hd-2--m/501'/7'/0'",
        dependencies: {
          ethNetworkId,
          getReferralCodeWalletInfo,
          getSwapInviteeRewards,
        },
      }),
    ).resolves.toEqual({ status: 'unsupported' });

    expect(getSwapInviteeRewards).not.toHaveBeenCalled();
  });

  test('returns an error state when the rewards request fails', async () => {
    const getReferralCodeWalletInfo = jest.fn().mockResolvedValue({
      address: '0xFirstEvm',
      networkId: ethNetworkId,
    });
    const getSwapInviteeRewards = jest
      .fn()
      .mockRejectedValue(new Error('request failed'));

    await expect(
      loadSwapInviteeReward({
        accountId: "hd-2--m/44'/60'/0'/0/0",
        currentEvmAddress: '0xCurrent',
        dependencies: {
          ethNetworkId,
          getReferralCodeWalletInfo,
          getSwapInviteeRewards,
        },
      }),
    ).resolves.toEqual({ status: 'error' });
  });
});
