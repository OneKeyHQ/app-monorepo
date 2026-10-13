import { useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Page,
  ScrollView,
  SegmentControl,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { TabPageHeader } from '@onekeyhq/kit/src/components/TabPageHeader';
import { useRedirectWhenNotLoggedIn } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useRedirectWhenNotLoggedIn';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { BreadcrumbSection, ReferFriendsPageContainer } from '../../components';
import { ReferFriendsTestIDs } from '../../testIDs';

import {
  ReferredHardwareOrders,
  ReferredWalletList,
} from './components/ReferredLists';

function YourReferredPageWrapper() {
  // Redirect to ReferAFriend page if user is not logged in
  useRedirectWhenNotLoggedIn();

  const intl = useIntl();
  const { md } = useMedia();
  // Named like the invite page's entry that opens it.
  const title = intl.formatMessage({
    id: ETranslations.referral_referral_list,
  });
  const [activeList, setActiveList] = useState<string | number>('wallet');
  // Built once, so switching tabs does not re-render the hidden list.
  const lists = useMemo(
    () => [
      {
        value: 'wallet',
        label: intl.formatMessage({ id: ETranslations.global_wallet }),
        testID: ReferFriendsTestIDs.referralListWalletTab,
        content: <ReferredWalletList />,
      },
      {
        value: 'hardware',
        label: intl.formatMessage({
          id: ETranslations.referral_referred_type_3,
        }),
        testID: ReferFriendsTestIDs.referralListHardwareTab,
        content: <ReferredHardwareOrders />,
      },
    ],
    [intl],
  );

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
          {/* A plain switch: two short lists have no header to collapse, so
              they need no swipeable pager. Compact layouts fill the row;
              wider layouts hug the two labels and stay left-aligned. */}
          <YStack px="$pagePadding" pt="$3">
            <SegmentControl
              fullWidth={md}
              value={activeList}
              options={lists.map(({ value, label, testID }) => ({
                value,
                label,
                testID,
              }))}
              onChange={setActiveList}
            />
          </YStack>
          {/* Both lists stay mounted, so switching back keeps their data and
              scroll position instead of loading again. */}
          {lists.map((list) => (
            <ScrollView
              key={list.value}
              flex={1}
              display={list.value === activeList ? 'flex' : 'none'}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 40 }}
            >
              <YStack px="$pagePadding" pt="$5">
                {list.content}
              </YStack>
            </ScrollView>
          ))}
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
