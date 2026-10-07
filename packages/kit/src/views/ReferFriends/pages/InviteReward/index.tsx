import type { ReactNode } from 'react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';

import { useFocusEffect, useRoute } from '@react-navigation/core';
import { isEqual } from 'lodash';
import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import {
  Divider,
  Page,
  RefreshControl,
  ScrollView,
  SizableText,
  Skeleton,
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
import { getInviteIllustrationSize } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/getInviteIllustrationSize';
import { InviteLevelPill } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/InviteLevelPill';
import { InviteTabContent } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/InviteTabContent';
import { LogoutButton } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/LogoutButton';
import { useReferralCodeCard } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/ReferralCodeCard/hooks/useReferralCodeCard';
import { ReferralJobTabs } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/ReferralJobTabs';
import { RulesButton } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/RulesButton';
import { useInviteCardStyle } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/useInviteCardStyle';
import {
  EReferralPageTab,
  type IReferralPageTab,
  IS_BENEFITS_TAB_ENABLED,
  resolveReferralPageTab,
} from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/referralPageTab';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IInviteSummary } from '@onekeyhq/shared/src/referralCode/type';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import type { IInviteRewardRouteParams } from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { ReferFriendsLoadError } from '../../components';
import { ReferFriendsTestIDs } from '../../testIDs';
import { useNavigateToRewardHistory } from '../RewardDistributionHistory/hooks/useNavigateToRewardHistory';

import { INVITE_COPY } from './inviteCopy';

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
        headerTitle={IS_BENEFITS_TAB_ENABLED ? renderHeaderTitle : undefined}
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

// Mirrors the loaded layout (earnings card, invite card, rewards section) so
// the first paint does not jump when data arrives.
function InviteOverviewSkeleton() {
  const { md } = useMedia();
  const { height: windowHeight } = useWindowDimensions();
  const cardStyle = useInviteCardStyle();

  const earningsCard = (
    <YStack flex={1} gap="$4" p="$5" {...cardStyle}>
      <YStack gap="$2">
        <Skeleton.BodyMd />
        <Skeleton.Heading3Xl />
        <Skeleton.BodyMd w={120} />
      </YStack>
      <Divider borderColor="$neutral4" />
      <XStack gap="$6">
        {[0, 1, 2].map((index) => (
          <YStack key={index} gap="$1">
            <Skeleton.BodyMd />
            <Skeleton.HeadingMd />
          </YStack>
        ))}
      </XStack>
    </YStack>
  );

  const inviteCard = (
    <YStack flex={1} gap="$4" p="$5" {...cardStyle}>
      <YStack gap="$2">
        <Skeleton.HeadingMd w={200} />
        <Skeleton.BodyMd w={260} />
      </YStack>
      <Skeleton w="100%" h={48} radius="round" />
      <Skeleton.BodyMd w={160} />
      <Divider borderColor="$neutral4" />
      <Skeleton.BodyMd w={220} />
    </YStack>
  );

  if (md) {
    // Compact content leads with the invite block (illustration, headline,
    // link, code) and puts the earnings card after it.
    const illustration = getInviteIllustrationSize(windowHeight);
    return (
      <YStack px="$pagePadding" pt="$3" gap="$5">
        <YStack gap="$3">
          <Skeleton
            alignSelf="center"
            w={illustration.width}
            maxWidth="100%"
            h={illustration.height}
            radius={12}
          />
          <Skeleton.HeadingLg w={220} />
          <Skeleton.BodyMd w={260} />
          <Skeleton w="100%" h={44} radius={8} />
          <Skeleton.BodyMd w={160} />
        </YStack>
        {/* Compact earnings card: amount, two totals, three entry rows. */}
        <YStack gap="$4" p="$4" {...cardStyle}>
          <YStack gap="$1">
            <Skeleton.BodyMd />
            <Skeleton.Heading3Xl />
          </YStack>
          <XStack gap="$4">
            {[0, 1].map((index) => (
              <YStack key={index} flex={1} gap="$1">
                <Skeleton.BodyMd />
                <Skeleton.HeadingMd />
              </YStack>
            ))}
          </XStack>
          <Divider borderColor="$neutral4" />
          {[0, 1, 2].map((index) => (
            <Skeleton.BodyLg key={index} w={140} />
          ))}
        </YStack>
      </YStack>
    );
  }

  return (
    <YStack px="$pagePadding" gap="$10">
      <XStack gap="$4" ai="stretch">
        <XStack flex={1} flexBasis={0} minWidth={0}>
          {earningsCard}
        </XStack>
        <XStack flex={1} flexBasis={0} minWidth={0}>
          {inviteCard}
        </XStack>
      </XStack>
      <YStack gap="$4">
        <Skeleton.HeadingXl w={200} />
        <Skeleton w="100%" h={88} radius={12} />
      </YStack>
    </YStack>
  );
}

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
  const [isRetrying, setIsRetrying] = useState(false);
  // Last good summary. A failed poll returns it, so the page keeps its data;
  // only a failed first load reaches `undefinedResultIfError` and shows the
  // error view. An unchanged poll also returns it, so the one-minute polling
  // does not re-render the whole tab.
  const lastSummaryRef = useRef<IInviteSummary | undefined>(undefined);

  const { result: summaryInfo, run: fetchSummaryInfo } = usePromiseResult(
    async () => {
      try {
        const summary =
          await backgroundApiProxy.serviceReferralCode.getSummaryInfo();
        if (
          lastSummaryRef.current &&
          isEqual(summary, lastSummaryRef.current)
        ) {
          return lastSummaryRef.current;
        }
        lastSummaryRef.current = summary;
        return summary;
      } catch (error) {
        if (lastSummaryRef.current) {
          return lastSummaryRef.current;
        }
        throw error;
      }
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

  const refreshAll = useCallback(
    () => Promise.all([fetchSummaryInfo(), refreshLevelDetail()]),
    [fetchSummaryInfo, refreshLevelDetail],
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Both tabs take the pull gesture so pull-down behaves the same everywhere
  // on the sheet; the benefits tab gets its own data with the Benefits PR.
  const handleRefresh = useCallback(async () => {
    if (!isInviteTab) {
      return;
    }
    setIsRefreshing(true);
    try {
      await refreshAll();
    } finally {
      setIsRefreshing(false);
    }
  }, [isInviteTab, refreshAll]);

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

  const isFetching = isRetrying || (isFirstLoading && !summaryInfo);
  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    try {
      await refreshAll();
    } finally {
      setIsRetrying(false);
    }
  }, [refreshAll]);
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

  let body: ReactNode;
  if (isInviteTab && isFetching) {
    body = (
      <ScrollView>
        <Page.Container padded={false}>
          <InviteOverviewSkeleton />
        </Page.Container>
      </ScrollView>
    );
  } else if (isInviteTab && !summaryInfo) {
    body = (
      // Later polling failures keep the last loaded data instead.
      <ReferFriendsLoadError
        testID={ReferFriendsTestIDs.inviteRetryBtn}
        onRetry={() => {
          void handleRetry();
        }}
      />
    );
  } else {
    body = (
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
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
    );
  }

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
          // Same container as the content so the header lines up with the cards.
          <Page.Container padded={false}>
            <XStack
              px="$pagePadding"
              pt="$5"
              pb="$4"
              ai="center"
              jc="space-between"
              gap="$3"
            >
              {IS_BENEFITS_TAB_ENABLED ? (
                <ReferralJobTabs value={activeTab} onChange={setActiveTab} />
              ) : (
                <SizableText size="$heading2xl">
                  {intl.formatMessage({ id: ETranslations.global_overview })}
                </SizableText>
              )}
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
          </Page.Container>
        )}
        {body}
      </Page.Body>
      {showInviteFooter ? (
        <Page.Footer>
          <Page.FooterActions
            onConfirm={copyLink}
            onConfirmText={INVITE_COPY.copyLink}
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
