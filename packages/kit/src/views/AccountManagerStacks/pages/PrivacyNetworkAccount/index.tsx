import { useIntl } from 'react-intl';

import type { IPageScreenProps } from '@onekeyhq/components';
import { Page, ScrollView, SizableText, YStack } from '@onekeyhq/components';
import { withPrivacyChainPoolProvider } from '@onekeyhq/kit/src/states/jotai/contexts/privacyChainPool';
import { LocalWalletAccountPanel } from '@onekeyhq/kit/src/views/AssetDetails/pages/TokenDetails/LocalWalletAccountPanel';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EAccountManagerStacksRoutes,
  IAccountManagerStacksParamList,
} from '@onekeyhq/shared/src/routes/accountManagerStacks';

import { AccountManagerTestIDs } from '../../testIDs';

function PrivacyNetworkAccount({
  route,
}: IPageScreenProps<
  IAccountManagerStacksParamList,
  EAccountManagerStacksRoutes.PrivacyNetworkAccount
>) {
  const intl = useIntl();
  const { accountId, accountName, networkId } = route.params;

  return (
    <Page testID={AccountManagerTestIDs.privacyNetworkSettings}>
      <Page.Header title={accountName} />
      <Page.Body>
        <ScrollView>
          <YStack px="$5" pt="$4" gap="$1">
            <SizableText size="$headingSm">
              {intl.formatMessage({ id: ETranslations.trade_privacy_mode })}
            </SizableText>
            <SizableText size="$bodySm" color="$textSubdued">
              Local scanning lets this account receive, view, and spend private
              funds. Pausing it stops scanning and avoids loading the privacy
              runtime on the next app start.
            </SizableText>
          </YStack>
          <LocalWalletAccountPanel
            networkId={networkId}
            accountId={accountId}
          />
        </ScrollView>
      </Page.Body>
    </Page>
  );
}

// Modal routes do not inherit the Token Details header's pool store.
export default withPrivacyChainPoolProvider(PrivacyNetworkAccount);
