import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

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
    const earnAccount = await backgroundApiProxy.serviceStaking.getEarnAccount({
      accountId: accountId ?? '',
      indexedAccountId,
      networkId,
    });
    navigation.pushModal(EModalRoutes.StakingModal, {
      screen: EModalStakingRoutes.ProtocolDetailsV2,
      params: {
        accountId: earnAccount?.accountId || accountId || '',
        networkId,
        indexedAccountId: earnAccount?.account.indexedAccountId,
        symbol,
        provider,
        vault,
      },
    });
  },
};
