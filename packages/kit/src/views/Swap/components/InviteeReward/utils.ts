import type {
  ISwapInviteeRewardsParams,
  ISwapInviteeRewardsResponse,
} from '@onekeyhq/shared/src/referralCode/type';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { getVisibleSwapTabSwitchType } from '@onekeyhq/shared/src/utils/swapTypeUtils';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

function shouldShowSwapInviteeRewardAction({
  isModal,
  swapTypeSwitch,
}: {
  isModal?: boolean;
  swapTypeSwitch?: ESwapTabSwitchType;
}) {
  return (
    !isModal &&
    getVisibleSwapTabSwitchType(swapTypeSwitch) === ESwapTabSwitchType.SWAP
  );
}

export type ISwapActivityHubActionPlacement =
  | 'desktopHeader'
  | 'settings'
  | 'hidden';

export function getSwapActivityHubActionPlacement({
  isDesktop,
  isMediumLayout,
  isModal,
  pendingRouteSwapType,
  swapTypeSwitch,
}: {
  isDesktop: boolean;
  isMediumLayout: boolean;
  isModal?: boolean;
  pendingRouteSwapType?: ESwapTabSwitchType;
  swapTypeSwitch?: ESwapTabSwitchType;
}): ISwapActivityHubActionPlacement {
  if (
    !shouldShowSwapInviteeRewardAction({
      isModal,
      swapTypeSwitch: pendingRouteSwapType ?? swapTypeSwitch,
    })
  ) {
    return 'hidden';
  }

  // Only the wide desktop header has room for its own gift button; every other
  // surface reaches the activity hub through the Swap settings sheet.
  return isDesktop && !isMediumLayout ? 'desktopHeader' : 'settings';
}

interface ISwapInviteeWalletInfo {
  address: string;
  networkId: string;
}

export function isSwapInviteeRewardWalletSupported(
  walletInfo: ISwapInviteeWalletInfo | null | undefined,
  ethNetworkId: string,
): walletInfo is ISwapInviteeWalletInfo {
  return Boolean(walletInfo && walletInfo.networkId === ethNetworkId);
}

interface ILoadSwapInviteeRewardDependencies {
  ethNetworkId: string;
  getReferralCodeWalletInfo: (params: {
    walletId: string;
  }) => Promise<ISwapInviteeWalletInfo | null>;
  getSwapInviteeRewards: (
    params: ISwapInviteeRewardsParams,
  ) => Promise<ISwapInviteeRewardsResponse>;
}

export type ILoadSwapInviteeRewardResult =
  | {
      status: 'success';
      data: ISwapInviteeRewardsResponse;
    }
  | {
      status: 'unsupported';
    }
  | {
      status: 'error';
    };

export async function loadSwapInviteeReward({
  accountId,
  currentEvmAddress,
  dependencies,
}: {
  accountId: string;
  currentEvmAddress?: string;
  dependencies: ILoadSwapInviteeRewardDependencies;
}): Promise<ILoadSwapInviteeRewardResult> {
  try {
    const walletId = accountUtils.getWalletIdFromAccountId({ accountId });
    const walletInfo = await dependencies.getReferralCodeWalletInfo({
      walletId,
    });

    if (
      !isSwapInviteeRewardWalletSupported(walletInfo, dependencies.ethNetworkId)
    ) {
      return { status: 'unsupported' };
    }

    if (!currentEvmAddress) {
      return { status: 'unsupported' };
    }

    const data = await dependencies.getSwapInviteeRewards({
      walletAddress: currentEvmAddress,
    });
    return { status: 'success', data };
  } catch {
    return { status: 'error' };
  }
}
