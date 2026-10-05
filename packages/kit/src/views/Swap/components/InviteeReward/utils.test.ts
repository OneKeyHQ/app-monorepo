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
  test('does not request rewards when the current account has no EVM address', async () => {
    const getSwapInviteeRewards = jest.fn();

    await expect(
      loadSwapInviteeReward({
        dependencies: {
          getSwapInviteeRewards,
        },
      }),
    ).resolves.toEqual({ status: 'unsupported' });

    expect(getSwapInviteeRewards).not.toHaveBeenCalled();
  });

  test('queries rewards for the current EVM address without a wallet-type filter', async () => {
    const getSwapInviteeRewards = jest.fn().mockResolvedValue(rewardData);

    await expect(
      loadSwapInviteeReward({
        currentEvmAddress: '0xWatch',
        dependencies: {
          getSwapInviteeRewards,
        },
      }),
    ).resolves.toEqual({ status: 'success', data: rewardData });

    expect(getSwapInviteeRewards).toHaveBeenCalledWith({
      walletAddress: '0xWatch',
    });
  });

  test('returns an error state when the rewards request fails', async () => {
    const getSwapInviteeRewards = jest
      .fn()
      .mockRejectedValue(new Error('request failed'));

    await expect(
      loadSwapInviteeReward({
        currentEvmAddress: '0xCurrent',
        dependencies: {
          getSwapInviteeRewards,
        },
      }),
    ).resolves.toEqual({ status: 'error' });
  });
});
