import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';

import type { IAppNavigation } from '../../hooks/useAppNavigation';

export const EarnNavigation = {
  async pushDetailPageFromDeeplink(
    navigation: IAppNavigation,
    {
      accountId,
      networkId,
      indexedAccountId,
      symbol,
      provider,
      vault,
    }: {
      accountId?: string;
      networkId: string;
      indexedAccountId?: string;
      symbol: string;
      provider: string;
      vault?: string;
    },
  ) {
    navigation.pushModal(EModalRoutes.StakingModal, {
      screen: EModalStakingRoutes.ProtocolDetailsV2,
      params: {
        accountId: accountId ?? '',
        networkId,
        indexedAccountId,
        symbol,
        provider,
        vault,
      },
    });
  },
};
