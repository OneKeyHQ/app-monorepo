import { useIntl } from 'react-intl';

import { Page, ScrollView, Spinner, Stack } from '@onekeyhq/components';
import type { IPageScreenProps } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import PrivacyNetworkSettings from '@onekeyhq/kit/src/views/Setting/pages/PrivacyNetwork';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EAccountManagerStacksRoutes } from '@onekeyhq/shared/src/routes/accountManagerStacks';
import type { IAccountManagerStacksParamList } from '@onekeyhq/shared/src/routes/accountManagerStacks';

// The settings page always covers one chain. Opened from the wallet menu with
// no chain named, pick one first; a wallet with a single privacy chain skips
// the pick.
export default function PrivacyNetworks({
  route,
}: IPageScreenProps<
  IAccountManagerStacksParamList,
  EAccountManagerStacksRoutes.PrivacyNetworks
>) {
  const { walletId, networkId } = route.params;
  const intl = useIntl();
  const navigation = useAppNavigation();

  const { result: networks } = usePromiseResult(async () => {
    if (networkId) return undefined;
    const accounts =
      await backgroundApiProxy.servicePrivacyChain.listLocalWalletAccounts({
        walletId,
      });
    const networkIds = Array.from(
      new Set(accounts.map((account) => account.networkId)),
    );
    return Promise.all(
      networkIds.map(async (id) => ({
        networkId: id,
        name:
          (
            await backgroundApiProxy.serviceNetwork.getNetworkSafe({
              networkId: id,
            })
          )?.name ?? id,
      })),
    );
  }, [walletId, networkId]);

  if (networkId) {
    return <PrivacyNetworkSettings walletId={walletId} networkId={networkId} />;
  }
  if (networks && networks.length <= 1) {
    return (
      <PrivacyNetworkSettings
        walletId={walletId}
        networkId={networks[0]?.networkId}
      />
    );
  }
  return (
    <Page testID="privacy-networks-picker-page">
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.privacy_sync_menu__title,
        })}
      />
      <Page.Body>
        {networks ? (
          <ScrollView>
            {networks.map((network) => (
              <ListItem
                key={network.networkId}
                testID={`privacy-networks-picker-${network.networkId}`}
                icon="ShieldOutline"
                title={network.name}
                drillIn
                onPress={() =>
                  navigation.push(EAccountManagerStacksRoutes.PrivacyNetworks, {
                    walletId,
                    networkId: network.networkId,
                  })
                }
              />
            ))}
          </ScrollView>
        ) : (
          <Stack flex={1} alignItems="center" justifyContent="center">
            <Spinner />
          </Stack>
        )}
      </Page.Body>
    </Page>
  );
}
