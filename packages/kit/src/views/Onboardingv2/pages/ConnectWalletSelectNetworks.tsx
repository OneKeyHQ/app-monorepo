import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Page, YStack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IOnboardingParamListV2 } from '@onekeyhq/shared/src/routes';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes';

import { NetworkAvatarGroup } from '../../../components/NetworkAvatar';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { OnboardingLayout } from '../components/OnboardingLayout';

export function ConnectWalletSelectNetworksPage() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { btc, eth, cosmoshub, bsc, polygon, avalanche, sol } =
    getNetworkIdsMap();
  const intl = useIntl();

  const navigation = useAppNavigation();

  const handlePress = useCallback(
    (
      params: IOnboardingParamListV2[EOnboardingPagesV2.ConnectWalletSelectNetworks],
    ) => {
      console.log('handleAddExternalAccount');
      navigation.push(EOnboardingPagesV2.ConnectExternalWallet, params);
    },
    [navigation],
  );

  return (
    <Page>
      <OnboardingLayout>
        <OnboardingLayout.Header title="Select network" />
        <OnboardingLayout.Body constrained={false}>
          <OnboardingLayout.ConstrainedContent>
            <YStack>
              {/* <ListItem
            title={intl.formatMessage({
              id: ETranslations.global_multi_networks,
            })}
            drillIn
            renderIcon={() => (
              <NetworkAvatarGroup networkIds={[btc, eth, sol]} />
            )}
            onPress={() =>
              handlePress({
                impl: undefined,
                title: 'Multi-networks',
              })
            }
          /> */}
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
          </OnboardingLayout.ConstrainedContent>
        </OnboardingLayout.Body>
      </OnboardingLayout>
    </Page>
  );
}

export default ConnectWalletSelectNetworksPage;
