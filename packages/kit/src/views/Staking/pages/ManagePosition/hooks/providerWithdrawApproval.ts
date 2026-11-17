import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  swrCacheUtils,
  swrKeys,
} from '@onekeyhq/shared/src/utils/swrCacheUtils';
import { EEarnProviderEnum } from '@onekeyhq/shared/types/earn';
import type {
  IEarnManagePageResponse,
  IProtocolInfo,
  IStakeEarnDetail,
  IStakeProtocolListItem,
} from '@onekeyhq/shared/types/staking';

import { resolveManagePageWithdrawApprove } from './useManagePage.utils';

export async function resolveProviderWithdrawApproval({
  provider,
  networkId,
  symbol,
  vault,
  locale,
  currencyId,
  managePageData,
  protocolList,
}: {
  provider: string;
  networkId: string;
  symbol: string;
  vault?: string;
  locale: string;
  currencyId: string;
  managePageData: IEarnManagePageResponse;
  protocolList: IStakeProtocolListItem[];
}): Promise<{
  withdrawApprove: IProtocolInfo['withdrawApprove'];
  withdrawApprovalUnavailable: boolean;
}> {
  if (provider.toLowerCase() !== EEarnProviderEnum.EtherFi.toLowerCase()) {
    return {
      withdrawApprove: managePageData.withdrawApprove,
      withdrawApprovalUnavailable: false,
    };
  }

  const resolvedVault =
    vault ||
    protocolList.find(
      (item) =>
        item.provider.name.toLowerCase() === provider.toLowerCase() &&
        item.network.networkId === networkId,
    )?.provider.vault;
  const detailParams = { networkId, symbol, provider, vault: resolvedVault };
  const detailCacheKey = swrKeys.earnProtocolDetail({
    ...detailParams,
    locale,
    currencyId,
  });
  const detailCacheEntry =
    swrCacheUtils.getWithTimestamp<IStakeEarnDetail>(detailCacheKey);
  try {
    const withdrawApprove = await resolveManagePageWithdrawApprove({
      managePageData,
      vault: resolvedVault,
      detailCacheEntry,
      loadDetail: async () => {
        const detail =
          await backgroundApiProxy.serviceStaking.getProtocolDetailsV2(
            detailParams,
          );
        swrCacheUtils.set(detailCacheKey, detail);
        return detail;
      },
    });
    return { withdrawApprove, withdrawApprovalUnavailable: false };
  } catch {
    return { withdrawApprove: undefined, withdrawApprovalUnavailable: true };
  }
}
