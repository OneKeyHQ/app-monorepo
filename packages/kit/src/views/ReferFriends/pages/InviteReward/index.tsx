import type { ReactNode } from 'react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';

import { useFocusEffect, useRoute } from '@react-navigation/core';
import { isEqual } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Divider,
  LinearGradient,
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
import { getChartColorWithAlpha } from '@onekeyhq/kit/src/components/LightweightChart/utils/chartColor';
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
  useInviteHomeCardStyle,
  useInvitePageCanvas,
} from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/useInviteCardStyle';
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

import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

const ReferralPageHeader = memo(function ReferralPageHeader({
  activeTab,
  onChangeTab,
  isCompactHeader,
  isTitleHidden,
}: {
  activeTab: IReferralPageTab;
  onChangeTab: (tab: IReferralPageTab) => void;
  isCompactHeader: boolean;
  // The content shows the large title, so the bar leaves its own empty.
  isTitleHidden: boolean;
}) {
  const intl = useIntl();
  const { headerBackgroundColor, headerStyle } = useInvitePageCanvas();
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
        // Native iOS ignores the container color; headerStyle covers it.
        headerContainerBackgroundColor={headerBackgroundColor}
        headerStyle={headerStyle}
        title={
          isTitleHidden
            ? ''
            : intl.formatMessage({
                id: ETranslations.sidebar_refer_a_friend,
              })
        }
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
  const cardStyle = useInviteHomeCardStyle();

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
    // Compact content: title with level, invite card, earnings card,
    // then entries card.
    return (
      <YStack px="$pagePadding" pt="$2" gap="$5">
        <XStack jc="space-between" ai="center">
          <Skeleton.Heading2Xl w={120} />
          <Skeleton w={88} h={28} radius="round" />
        </XStack>
        <YStack gap="$4" p="$4" {...cardStyle}>
          <YStack gap="$1">
            <XStack jc="space-between" ai="center">
              <Skeleton.BodyMd w={96} />
              <Skeleton w={72} h={24} radius="round" />
            </XStack>
            <Skeleton.HeadingXl w={120} />
          </YStack>
          <Divider borderColor="$neutral4" />
          {[0, 1].map((index) => (
            <XStack key={index} jc="space-between">
              <Skeleton.BodyMd w={96} />
              <Skeleton.BodyMd w={120} />
            </XStack>
          ))}
        </YStack>
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
        </YStack>
        <YStack gap="$4" p="$4" {...cardStyle}>
          <Skeleton.BodyMd w={120} />
          <Skeleton.BodyMd w={100} />
        </YStack>
      </YStack>
    );
  }

  return (
    <YStack px="$pagePadding" gap="$10">
      <XStack gap="$5" ai="stretch">
        <XStack flex={1} flexBasis={0} minWidth={0}>
          {earningsCard}
        </XStack>
        <XStack flex={1} flexBasis={0} minWidth={0}>
          {inviteCard}
        </XStack>
      </XStack>
      <YStack gap="$4">
        <Skeleton.HeadingXl w={200} />
        <Skeleton w="100%" h={88} radius={16} />
      </YStack>
    </YStack>
  );
}

function InviteRewardPage() {
  const intl = useIntl();
  const { md } = useMedia();
  const pageCanvas = useInvitePageCanvas();
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

  // Failures are already reflected on the page (error view, or the last
  // loaded data), so pull-to-refresh and Retry must not reject: the level
  // detail request re-throws, and these run as fire-and-forget handlers.
  const refreshAll = useCallback(async () => {
    await Promise.allSettled([fetchSummaryInfo(), refreshLevelDetail()]);
  }, [fetchSummaryInfo, refreshLevelDetail]);
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

  const { handleShare } = useReferralCodeCard({
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
  // Compact layouts title the page in the content (with the level beside
  // it); the bar title returns once that title scrolls under the bar, and a
  // short fade under the bar softens content scrolling beneath it.
  // The skeleton holds the title's place too, so the bar title does not
  // flash in and out while the first load runs.
  const hasLargeTitle = md && isInviteTab && (isFetching || !!summaryInfo);
  const largeTitleBottomRef = useRef(0);
  const [isPastLargeTitle, setIsPastLargeTitle] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const handleLargeTitleLayout = useCallback((bottom: number) => {
    largeTitleBottomRef.current = bottom;
  }, []);
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      // Same-value updates bail out, so this only re-renders on a crossing.
      setIsScrolled(offsetY > 0);
      setIsPastLargeTitle(
        largeTitleBottomRef.current > 0 &&
          offsetY >= largeTitleBottomRef.current,
      );
    },
    [],
  );
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
        onScroll={hasLargeTitle ? handleScroll : undefined}
        scrollEventThrottle={16}
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
                onLargeTitleLayout={handleLargeTitleLayout}
              />
            </YStack>
          ) : null}
          {isInviteTab ? null : <BenefitsTabPlaceholder />}
        </Page.Container>
      </ScrollView>
    );
  }

  return (
    <Page backgroundColor={pageCanvas.backgroundColor}>
      <ReferralPageHeader
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        isCompactHeader={isCompactHeader}
        isTitleHidden={hasLargeTitle && !isPastLargeTitle}
      />
      <Page.Body>
        {/* Compact layouts show the level inside the scrolling content. */}
        {isCompactHeader ? null : (
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
                  {intl.formatMessage({
                    id: ETranslations.sidebar_refer_a_friend,
                  })}
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
        {hasLargeTitle && isScrolled ? (
          <LinearGradient
            position="absolute"
            top={0}
            left={0}
            right={0}
            height={24}
            pointerEvents="none"
            colors={[
              pageCanvas.headerBackgroundColor,
              getChartColorWithAlpha(pageCanvas.headerBackgroundColor, 0),
            ]}
          />
        ) : null}
      </Page.Body>
      {showInviteFooter ? (
        <Page.Footer>
          {/* Inviting is the main action on native: it opens the share
              sheet. Copying lives on the invite card rows. */}
          <Page.FooterActions
            bg={pageCanvas.backgroundColor}
            onConfirm={handleShare}
            onConfirmText={INVITE_COPY.inviteFriends}
            confirmButtonProps={{
              testID: ReferFriendsTestIDs.inviteFriendsFooterBtn,
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
