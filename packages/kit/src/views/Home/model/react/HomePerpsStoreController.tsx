import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useHomeNavigation } from '@onekeyhq/kit/src/states/jotai/contexts/home';

import {
  EHomeBackgroundRecoveryRefreshDomain,
  useRegisterHomeBackgroundRecoveryRefresh,
} from '../../pages/HomeBackgroundRecoveryRefreshProvider';
import { usePerpsHomePortfolio } from '../../pages/usePerpsHomePortfolio';

import { isHomePerpsSourceActive } from './homePerpsStoreControllerPolicy';

export function HomePerpsStoreController() {
  const navigation = useHomeNavigation();
  const isSourceActive = isHomePerpsSourceActive(navigation.value);
  const {
    activeAccount: { account, network, wallet },
  } = useActiveAccount({ num: 0 });
  const { refresh } = usePerpsHomePortfolio({ isSourceActive });

  useRegisterHomeBackgroundRecoveryRefresh({
    callback: refresh,
    domain: EHomeBackgroundRecoveryRefreshDomain.legacyPerps,
    operationKey: 'home-perps-store-source',
    owner: {
      accountId: account?.id,
      networkId: network?.id,
      walletId: wallet?.id,
    },
  });

  return null;
}
