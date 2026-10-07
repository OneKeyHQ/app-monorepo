import { memo, useCallback, useEffect, useRef, useState } from 'react';

import { useFocusEffect, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Page,
  RefreshControl,
  ScrollView,
  Spinner,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { TabPageHeader } from '@onekeyhq/kit/src/components/TabPageHeader';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useRedirectWhenNotLoggedIn } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useRedirectWhenNotLoggedIn';
import { BenefitsTabPlaceholder } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/BenefitsTabPlaceholder';
import { useInviteLevelDetail } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/CurrentLevelCard/hooks/useCurrentLevelCard';
import { getInviteEarningsState } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/getInviteEarningsState';
import { InviteLevelPill } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/InviteLevelPill';
import { InviteTabContent } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/InviteTabContent';
import { LogoutButton } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/LogoutButton';
import { useReferralCodeCard } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/ReferralCodeCard/hooks/useReferralCodeCard';
import { ReferralJobTabs } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/ReferralJobTabs';
import { RulesButton } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/RulesButton';
import {
  EReferralPageTab,
  type IReferralPageTab,
  resolveReferralPageTab,
} from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/referralPageTab';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import type { IInviteRewardRouteParams } from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { ReferFriendsTestIDs } from '../../testIDs';
import { useNavigateToRewardHistory } from '../RewardDistributionHistory/hooks/useNavigateToRewardHistory';

const ReferralPageHeader = memo(function ReferralPageHeader({
  activeTab,
  onChangeTab,
  isCompactHeader,
}: {
  activeTab: IReferralPageTab;
  onChangeTab: (tab: IReferralPageTab) => void;
  isCompactHeader: boolean;
}) {
  const intl = useIntl();
  const renderHeaderTitle = useCallback(
    () => (
      <ReferralJobTabs segmented value={activeTab} onChange={onChangeTab} />
    ),
    [activeTab, onChangeTab],
  );
  const renderHeaderRight = useCallback(() => {
    if (activeTab !== EReferralPageTab.invite) {
      return null;
    }
    return <RulesButton />;
  }, [activeTab]);

  if (isCompactHeader) {
    return (
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.referral_title,
        })}
        headerTitle={renderHeaderTitle}
        headerRight={renderHeaderRight}
      />
    );
  }

  return (
    <TabPageHeader
      sceneName={EAccountSelectorSceneName.home}
      tabRoute={ETabRoutes.ReferFriends}
      hideHeaderLeft={platformEnv.isDesktop}
    />
  );
});

function InviteRewardPage() {
  const intl = useIntl();
  const { md } = useMedia();
  const navigation = useAppNavigation();
  const navigateToRewardHistory = useNavigateToRewardHistory();
  const route = useRoute<{
    key: string;
    name: string;
    params?: IInviteRewardRouteParams;
  }>();
  const isCompactHeader = platformEnv.isNative || md;
  const activeTab = resolveReferralPageTab(route.params?.tab);
  const isInviteTab = activeTab === EReferralPageTab.invite;
  const setActiveTab = useCallback(
    (tab: IReferralPageTab) => {
      navigation.setParams({ tab });
    },
    [navigation],
  );

  useFocusEffect(
    useCallback(() => {
      if (!route.params?.showRewardDistributionHistory) {
        return;
      }
      navigation.setParams({ showRewardDistributionHistory: undefined });
      navigateToRewardHistory();
    }, [
      navigation,
      navigateToRewardHistory,
      route.params?.showRewardDistributionHistory,
    ]),
  );

  useRedirectWhenNotLoggedIn();

  const [isFirstLoading, setIsFirstLoading] = useState(true);

  const {
    result: summaryInfo,
    run: fetchSummaryInfo,
    isLoading,
  } = usePromiseResult(
    async () => {
      return backgroundApiProxy.serviceReferralCode.getSummaryInfo();
    },
    [],
    {
      initResult: undefined,
      pollingInterval: timerUtils.getTimeDurationMs({ minute: 1 }),
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      undefinedResultIfError: true,
      watchLoading: false,
      // Pause polling while the benefits tab is showing.
      overrideIsFocused: (isPageFocused) => isPageFocused && isInviteTab,
      onIsLoadingChange: (loading) => {
        if (!loading && isFirstLoading) {
          setIsFirstLoading(false);
        }
      },
    },
  );

  const { levelDetail, refreshLevelDetail } = useInviteLevelDetail({
    isActive: isInviteTab,
  });

  const [isRefreshing, setIsRefreshing] = useState(false);
  // Both tabs take the pull gesture so pull-down behaves the same everywhere
  // on the sheet; the benefits tab gets its own data with the Benefits PR.
  const handleRefresh = useCallback(async () => {
    if (!isInviteTab) {
      return;
    }
    setIsRefreshing(true);
    try {
      await Promise.all([fetchSummaryInfo(), refreshLevelDetail()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchSummaryInfo, isInviteTab, refreshLevelDetail]);

  // Exposure fires on first load and on every return to the invite tab, not
  // on the one-minute summary polling.
  const hasSummary = summaryInfo !== undefined;
  const hasEarnings = !getInviteEarningsState(summaryInfo?.cumulativeRewards)
    .isZero;
  // TODO: switch to useEffectEvent once @types/react is on 19.2.
  const hasEarningsRef = useRef(hasEarnings);
  hasEarningsRef.current = hasEarnings;
  useEffect(() => {
    if (isInviteTab && hasSummary) {
      defaultLogger.referral.page.inviteHomeShown({
        hasEarnings: hasEarningsRef.current,
      });
    }
  }, [isInviteTab, hasSummary]);

  const { copyLink } = useReferralCodeCard({
    inviteUrl: summaryInfo?.inviteUrl ?? '',
    inviteCode: summaryInfo?.inviteCode ?? '',
  });

  const isFetching = isFirstLoading && (isLoading ?? summaryInfo === undefined);
  const showInviteFooter =
    platformEnv.isNative && isInviteTab && Boolean(summaryInfo?.inviteUrl);

  const levelPill =
    isInviteTab && summaryInfo ? (
      <InviteLevelPill
        rebateConfig={summaryInfo.rebateConfig}
        rebateLevels={summaryInfo.rebateLevels}
        levelDetail={levelDetail}
      />
    ) : null;
  // Compact layouts show the tabs in the navigation bar, so only the level
  // status stays above the content.
  const compactLevelRow = levelPill ? (
    <XStack px="$pagePadding" pt="$3" pb="$1">
      {levelPill}
    </XStack>
  ) : null;

  return (
    <Page>
      <ReferralPageHeader
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        isCompactHeader={isCompactHeader}
      />
      <Page.Body>
        {isCompactHeader ? (
          compactLevelRow
        ) : (
          <XStack
            px="$pagePadding"
            pt="$4"
            pb="$2"
            ai="center"
            jc="space-between"
          >
            <ReferralJobTabs value={activeTab} onChange={setActiveTab} />
            {isInviteTab ? (
              <XStack ai="center" gap="$2" flexShrink={1} jc="flex-end">
                {levelPill}
                <XStack gap="$4" ai="center">
                  <RulesButton />
                  {platformEnv.isWeb ? <LogoutButton /> : null}
                </XStack>
              </XStack>
            ) : null}
          </XStack>
        )}
        {isFetching && isInviteTab ? (
          <Stack flex={1} ai="center" jc="center">
            <Spinner size="large" />
          </Stack>
        ) : (
          <ScrollView
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
              />
            }
          >
            <Page.Container padded={false}>
              {summaryInfo ? (
                // Keep the invite tab mounted so switching tabs does not
                // refetch its data or replay the illustration.
                <YStack display={isInviteTab ? 'flex' : 'none'}>
                  <InviteTabContent
                    summaryInfo={summaryInfo}
                    fetchSummaryInfo={fetchSummaryInfo}
                    levelDetail={levelDetail}
                  />
                </YStack>
              ) : null}
              {isInviteTab ? null : <BenefitsTabPlaceholder />}
            </Page.Container>
          </ScrollView>
        )}
      </Page.Body>
      {showInviteFooter ? (
        <Page.Footer>
          <Page.FooterActions
            onConfirm={copyLink}
            onConfirmText={intl.formatMessage({
              id: ETranslations.browser_copy_link,
            })}
            confirmButtonProps={{
              testID: ReferFriendsTestIDs.copyLinkFooterBtn,
            }}
          />
        </Page.Footer>
      ) : null}
    </Page>
  );
}

export default function InviteReward() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <InviteRewardPage />
    </AccountSelectorProviderMirror>
  );
}
