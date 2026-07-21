import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';

import {
  EHomeBackgroundRecoveryRefreshDomain,
  useRegisterHomeBackgroundRecoveryRefresh,
} from '../../pages/HomeBackgroundRecoveryRefreshProvider';

import { useHomeNavigationSnapshot } from './homeStoreHooks';
import { useHomeNFTStoreSource } from './useHomeNFTStoreSource';

export function HomeNFTStoreController() {
  const {
    activeAccount: { account, network, wallet },
  } = useActiveAccount({ num: 0 });
  const navigation = useHomeNavigationSnapshot();
  const enabled =
    navigation.value.kind === 'ready' && navigation.value.tabs.includes('nft');
  const source = useHomeNFTStoreSource({
    enabled,
    visible:
      navigation.value.kind === 'ready' &&
      navigation.value.selectedTabId === 'nft',
  });

  useRegisterHomeBackgroundRecoveryRefresh({
    callback: source.refresh,
    domain: EHomeBackgroundRecoveryRefreshDomain.legacyNft,
    enabled,
    operationKey: 'home-nft-store-source',
    owner: {
      accountId: account?.id,
      networkId: network?.id,
      walletId: wallet?.id,
    },
  });

  return null;
}
