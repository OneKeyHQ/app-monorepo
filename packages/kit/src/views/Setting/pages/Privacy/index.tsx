import { useIntl } from 'react-intl';

import { Page, ScrollView, Spinner, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalSettingRoutes } from '@onekeyhq/shared/src/routes';

// One row per local-wallet network (settings.localWallet). Adding a chain
// registers it here through its vault settings, not through this page.
export default function PrivacySettings() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { result: networks } = usePromiseResult(async () => {
    const networkIds =
      await backgroundApiProxy.servicePrivacyChain.getLocalWalletNetworkIds();
    return Promise.all(
      networkIds.map(async (networkId) => {
        const network = await backgroundApiProxy.serviceNetwork.getNetworkSafe({
          networkId,
        });
        return { networkId, name: network?.name ?? networkId };
      }),
    );
  }, []);
  return (
    <Page testID="settings-privacy-page">
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.trade_privacy_mode })}
      />
      <Page.Body>
        {networks ? (
          <ScrollView>
            {networks.map((network) => (
              <ListItem
                key={network.networkId}
                testID={`settings-privacy-${network.networkId}`}
                icon="ShieldOutline"
                title={network.name}
                drillIn
                onPress={() =>
                  navigation.push(EModalSettingRoutes.SettingPrivacyNetwork, {
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
