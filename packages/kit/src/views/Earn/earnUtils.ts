import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';

import type { IAppNavigation } from '../../hooks/useAppNavigation';

export const EarntNavigation = {
  async pushDetailPageFromDeeplink(
    navigation: IAppNavigation,
    {
      accountId,
      networkId,
      indexedAccountId,
      symbol,
      provider,
    }: {
      accountId?: string;
      networkId: string;
      indexedAccountId?: string;
      symbol: string;
      provider: string;
    },
  ) {
    navigation.pushModal(EModalRoutes.StakingModal, {
      screen: EModalStakingRoutes.ProtocolDetails,
      params: {
        accountId: accountId ?? '',
        networkId,
        indexedAccountId,
        symbol,
        provider,
      },
    });
  },
};
