import { useIntl } from 'react-intl';

import { Page, Tabs, YStack, useMedia } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { TabPageHeader } from '@onekeyhq/kit/src/components/TabPageHeader';
import { useRedirectWhenNotLoggedIn } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useRedirectWhenNotLoggedIn';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { BreadcrumbSection, ReferFriendsPageContainer } from '../../components';

import {
  ReferredHardwareOrders,
  ReferredWalletList,
} from './components/ReferredLists';

function YourReferredPageWrapper() {
  // Redirect to ReferAFriend page if user is not logged in
  useRedirectWhenNotLoggedIn();

  const intl = useIntl();
  const { md } = useMedia();
  const title = intl.formatMessage({
    id: ETranslations.referral_your_referred,
  });

  return (
    <Page>
      {platformEnv.isNative || md ? (
        <Page.Header title={title} />
      ) : (
        <TabPageHeader
          sceneName={EAccountSelectorSceneName.home}
          tabRoute={ETabRoutes.ReferFriends}
          hideHeaderLeft={platformEnv.isDesktop}
        />
      )}
      <Page.Body>
        <ReferFriendsPageContainer flex={1}>
          {!md ? (
            <YStack p="$5">
              <BreadcrumbSection secondItemLabel={title} />
            </YStack>
          ) : null}
          <Tabs.Container>
            <Tabs.Tab
              name={intl.formatMessage({
                id: ETranslations.global_wallet,
              })}
            >
              <Tabs.ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 40 }}
              >
                <YStack px="$pagePadding" pt="$5">
                  <ReferredWalletList />
                </YStack>
              </Tabs.ScrollView>
            </Tabs.Tab>
            <Tabs.Tab
              name={intl.formatMessage({
                id: ETranslations.referral_referred_type_3,
              })}
            >
              <Tabs.ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 40 }}
              >
                <YStack px="$pagePadding" pt="$5">
                  <ReferredHardwareOrders />
                </YStack>
              </Tabs.ScrollView>
            </Tabs.Tab>
          </Tabs.Container>
        </ReferFriendsPageContainer>
      </Page.Body>
    </Page>
  );
}

export default function YourReferred() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <YourReferredPageWrapper />
    </AccountSelectorProviderMirror>
  );
}
