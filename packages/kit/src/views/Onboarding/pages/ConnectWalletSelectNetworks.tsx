import { useCallback } from 'react';

import { Page, YStack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import type { IOnboardingParamList } from '@onekeyhq/shared/src/routes';
import { EOnboardingPages } from '@onekeyhq/shared/src/routes';

import { NetworkAvatarGroup } from '../../../components/NetworkAvatar';
import useAppNavigation from '../../../hooks/useAppNavigation';

export function ConnectWalletSelectNetworksPage() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { btc, eth, cosmoshub, bsc, polygon, avalanche, sol } =
    getNetworkIdsMap();

  const navigation = useAppNavigation();

  const handlePress = useCallback(
    (params: IOnboardingParamList[EOnboardingPages.ConnectWallet]) => {
      console.log('handleAddExternalAccount');
      navigation.push(EOnboardingPages.ConnectWallet, params);
    },
    [navigation],
  );

  return (
    <Page scrollEnabled>
      <Page.Header title="Select network" />
      <Page.Body>
        <YStack>
          <ListItem
            title="Multi-networks"
            drillIn
            renderIcon={() => (
              <NetworkAvatarGroup networkIds={[btc, eth, cosmoshub]} />
            )}
            onPress={() =>
              handlePress({
                impl: undefined,
                title: 'Multi-networks',
              })
            }
          />
          <ListItem
            title="EVM"
            drillIn
            renderIcon={() => (
              <NetworkAvatarGroup networkIds={[eth, bsc, avalanche]} />
            )}
            onPress={() =>
              handlePress({
                impl: IMPL_EVM,
                title: 'EVM',
              })
            }
          />
        </YStack>
      </Page.Body>
    </Page>
  );
}

export default ConnectWalletSelectNetworksPage;
