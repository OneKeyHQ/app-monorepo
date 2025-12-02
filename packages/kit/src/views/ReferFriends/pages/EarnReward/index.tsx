import { useCallback, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Alert, Page, XStack, YStack, useMedia } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useSpotlight } from '@onekeyhq/kit/src/components/Spotlight';
import { TabPageHeader } from '@onekeyhq/kit/src/components/TabPageHeader';
import { useRedirectWhenNotLoggedIn } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useRedirectWhenNotLoggedIn';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EExportSubject,
  EExportTab,
} from '@onekeyhq/shared/src/referralCode/type';
import type {
  ETabReferFriendsRoutes,
  ITabReferFriendsParamList,
} from '@onekeyhq/shared/src/routes';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  BreadcrumbSection,
  ExportButton,
  FilterButton,
} from '../../components';
import { useRewardFilter } from '../../hooks/useRewardFilter';

import { EarnRewardsTab, PerpsRecordsTab, RewardTypeTabs } from './components';

import type { RouteProp } from '@react-navigation/core';

function EarnRewardPageWrapper() {
  // Redirect to ReferAFriend page if user is not logged in
  useRedirectWhenNotLoggedIn();

  const route =
    useRoute<
      RouteProp<ITabReferFriendsParamList, ETabReferFriendsRoutes.TabEarnReward>
    >();

  const intl = useIntl();
  const title =
    route.params?.title ||
    intl.formatMessage({ id: ETranslations.referral_referred_type_2 });
  const { md } = useMedia();

  const { tourTimes, tourVisited } = useSpotlight(
    ESpotlightTour.earnRewardAlert,
  );

  // Use the filter hook for state management only
  const { filterState, updateFilter } = useRewardFilter();
  const [activeRewardTab, setActiveRewardTab] = useState<EExportTab>(
    EExportTab.Earn,
  );

  const tools = useCallback(() => {
    const exportSubject =
      activeRewardTab === EExportTab.Earn
        ? EExportSubject.Onchain
        : EExportSubject.Perp;
    return (
      <XStack gap="$2">
        <FilterButton filterState={filterState} onFilterChange={updateFilter} />
        <ExportButton
          subject={exportSubject}
          timeRange={filterState.timeRange}
          inviteCode={filterState.inviteCode}
          tab={activeRewardTab}
        />
      </XStack>
    );
  }, [activeRewardTab, filterState, updateFilter]);

  const handleRewardTabChange = useCallback((tab: EExportTab) => {
    setActiveRewardTab(tab);
  }, []);

  return (
    <Page>
      {platformEnv.isNative || md ? (
        <Page.Header title={title} headerRight={tools} />
      ) : (
        <TabPageHeader
          sceneName={EAccountSelectorSceneName.home}
          tabRoute={ETabRoutes.ReferFriends}
          hideHeaderLeft={platformEnv.isDesktop}
        />
      )}
      <Page.Body $gt2xl={{ width: 1280, mx: 'auto' }}>
        {!md ? (
          <YStack p="$5">
            <BreadcrumbSection secondItemLabel={title} />
          </YStack>
        ) : null}
        {tourTimes === 0 ? (
          <Alert
            closable
            description={intl.formatMessage({
              id: ETranslations.referral_earn_reward_tips,
            })}
            type="info"
            mx="$5"
            mb="$2.5"
            onClose={tourVisited}
          />
        ) : null}
        <YStack position="relative">
          {!platformEnv.isNative && !md ? (
            <XStack
              position="absolute"
              right="$5"
              top="$2"
              gap="$2"
              zIndex={9999}
              ai="center"
              jc="center"
            >
              {tools()}
            </XStack>
          ) : null}
        </YStack>

        <RewardTypeTabs
          earnLabel={intl.formatMessage({
            id: ETranslations.referral_referred_type_2,
          })}
          perpsLabel={intl.formatMessage({
            id: ETranslations.global_perp,
          })}
          earnContent={<EarnRewardsTab filterState={filterState} />}
          perpsContent={<PerpsRecordsTab filterState={filterState} />}
          onTabChange={handleRewardTabChange}
        />
      </Page.Body>
    </Page>
  );
}

export default function EarnReward() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <EarnRewardPageWrapper />
    </AccountSelectorProviderMirror>
  );
}
