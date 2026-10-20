import type { ReactNode } from 'react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';

import { useFocusEffect, useRoute } from '@react-navigation/core';
import { isEqual } from 'lodash';
import { useIntl } from 'react-intl';

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
  usePageWidth,
} from '@onekeyhq/components';
import type { IPageProps } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { TabPageHeader } from '@onekeyhq/kit/src/components/TabPageHeader';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  getReferralShareCopy,
  showReferralShareDialog,
} from '@onekeyhq/kit/src/views/ReferFriends/components/ReferralShare';
import { useRedirectWhenNotLoggedIn } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useRedirectWhenNotLoggedIn';
import { useInviteLevelDetail } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/CurrentLevelCard/hooks/useCurrentLevelCard';
import { getInviteEarningsState } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/getInviteEarningsState';
import { InviteLevelPill } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/InviteLevelPill';
import { InviteTabContent } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/InviteTabContent';
import { useInviteValueSummary } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/InviteValueLine';
import { LogoutButton } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/LogoutButton';
import { ReferralJobTabs } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/ReferralJobTabs';
import { RulesButton } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/RulesButton';
import { ScrollEdgeFade } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/ScrollEdgeFade';
import type { IScrollEdgeFadeControl } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/ScrollEdgeFade';
import {
  INVITE_CARD_BORDER_COLOR,
  useInviteHomeCardStyle,
  useInvitePageCanvas,
} from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/useInviteCardStyle';
import {
  EReferralPageTab,
  type IReferralPageTab,
  IS_BENEFITS_TAB_ENABLED,
  resolveReferralPageTab,
} from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/referralPageTab';
import { REFERRAL_TAB_COPY } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/referralTabCopy';
import {
  getInviteCodeStepImageHeight,
  getInviteCodeStepImageWidth,
} from '@onekeyhq/kit/src/views/ReferFriends/pages/ReferAFriend/components/InviteCodeStepImage';
import { formatInviteUrlForDisplay } from '@onekeyhq/kit/src/views/ReferFriends/utils/inviteUrlUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IInviteLevelDetail,
  IInviteSummary,
} from '@onekeyhq/shared/src/referralCode/type';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import type { IInviteRewardRouteParams } from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { ReferFriendsLoadError } from '../../components';
import { ReferFriendsTestIDs } from '../../testIDs';
import { MyRewardsContent } from '../MyRewards';
import { useNavigateToRewardHistory } from '../RewardDistributionHistory/hooks/useNavigateToRewardHistory';

import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

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
  const { headerBackgroundColor, headerStyle } = useInvitePageCanvas();
  const renderHeaderTitle = useCallback(
    () => (
      <ReferralJobTabs
        variant="header"
        value={activeTab}
        onChange={onChangeTab}
      />
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
        title={intl.formatMessage({
          id: ETranslations.sidebar_refer_a_friend,
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
  const cardStyle = useInviteHomeCardStyle();
  const pageWidth = usePageWidth();
  const heroHeight = getInviteCodeStepImageHeight(pageWidth);

  if (md) {
    // Compact content, built like the loaded page: the hero, the code card
    // and its links card, then the earnings card and the per-product rows,
    // with the page's 20px and 32px spacing.
    const listRow = (key: number) => (
      <XStack key={key} minHeight={48} ai="center" gap="$3">
        <Skeleton w={20} h={20} radius="round" />
        <YStack flex={1}>
          <Skeleton.BodyMd w={96} />
        </YStack>
        <Skeleton.BodyMd w={72} />
      </XStack>
    );
    return (
      <YStack px="$pagePadding" gap="$8">
        <YStack gap="$5">
          <YStack ai="center" gap="$3">
            <Skeleton
              w="100%"
              maxWidth={getInviteCodeStepImageWidth(pageWidth)}
              h={heroHeight}
              radius={16}
            />
            <YStack ai="center" gap="$2">
              <Skeleton.Heading2Xl w={260} />
              <Skeleton.BodyMd w={220} />
              <XStack pt="$3">
                <Skeleton w={96} h={28} radius="round" />
              </XStack>
            </YStack>
          </YStack>
          <YStack gap="$3">
            <YStack px="$4" py="$1" {...cardStyle}>
              <XStack py="$3" ai="center" jc="space-between">
                <YStack gap="$1.5">
                  <Skeleton.BodyMd w={96} />
                  <Skeleton.HeadingXl w={140} />
                </YStack>
                <Skeleton w={72} h={28} radius="round" />
              </XStack>
              <Divider my="$1" borderColor={INVITE_CARD_BORDER_COLOR} />
              <XStack minHeight={44} ai="center" jc="space-between">
                <Skeleton.BodyMd w={72} />
                <Skeleton.BodyMd w={180} />
              </XStack>
            </YStack>
            <YStack px="$4" py="$1" {...cardStyle}>
              {[0, 1].map((index) => (
                <XStack key={index} minHeight={48} ai="center" gap="$3">
                  <Skeleton w={20} h={20} radius="round" />
                  <Skeleton.BodyMd w={120} />
                </XStack>
              ))}
            </YStack>
          </YStack>
        </YStack>
        <YStack gap="$5">
          <YStack px="$4" pt="$4" pb="$1" {...cardStyle}>
            <XStack ai="flex-start" jc="space-between" pb="$3">
              <YStack gap="$1">
                <Skeleton.BodyMd w={96} />
                <Skeleton.Heading3Xl w={180} />
              </YStack>
              <Skeleton w={20} h={20} radius="round" />
            </XStack>
            <YStack pb="$3">
              {[0, 1].map((index) => (
                <XStack
                  key={index}
                  minHeight={44}
                  ai="center"
                  jc="space-between"
                >
                  <Skeleton.BodyMd w={80} />
                  <Skeleton.BodyMd w={96} />
                </XStack>
              ))}
            </YStack>
            <Divider mb="$1" borderColor={INVITE_CARD_BORDER_COLOR} />
            <XStack minHeight={48} ai="center" jc="space-between">
              <Skeleton.BodyMd w={72} />
              <Skeleton.BodyMd w={160} />
            </XStack>
          </YStack>
          <YStack gap="$2">
            <XStack px="$4">
              <Skeleton.BodyMd w={120} />
            </XStack>
            <YStack px="$4" py="$1" {...cardStyle}>
              {[0, 1, 2].map(listRow)}
            </YStack>
          </YStack>
        </YStack>
      </YStack>
    );
  }

  // Pointer layouts: the earnings card (label and history link, the total
  // with its payout pill beside the coin art, then its parts and the payout
  // address on a hairline; the address keeps its width), the invite card
  // built the same way, and the earnings table with its column labels and
  // product rows.
  const earningsCard = (
    <YStack flex={1} gap="$4" p="$5" {...cardStyle}>
      <YStack gap="$1">
        <XStack jc="space-between" ai="center">
          <Skeleton.BodyLg w={112} />
          <Skeleton.BodyMd w={112} />
        </XStack>
        <XStack ai="flex-start" gap="$4">
          <YStack flex={1} gap="$2">
            <Skeleton.Heading4Xl w={220} />
            <Skeleton w={160} h={28} radius="round" />
          </YStack>
          <Skeleton w={80} h={80} radius={12} />
        </XStack>
      </YStack>
      <Divider mt="auto" borderColor={INVITE_CARD_BORDER_COLOR} />
      <XStack gap="$6">
        {[0, 1].map((index) => (
          <YStack
            key={index}
            flex={1}
            flexBasis={0}
            minWidth={0}
            gap="$1"
            py="$1"
          >
            <Skeleton.BodyMd w={72} />
            <Skeleton.HeadingMd w={96} />
          </YStack>
        ))}
        <YStack flexShrink={0} gap="$1" py="$1">
          <Skeleton.BodyMd w={72} />
          <Skeleton.HeadingMd w={180} />
        </YStack>
      </XStack>
    </YStack>
  );

  const inviteCard = (
    <YStack flex={1} gap="$4" p="$5" {...cardStyle}>
      <YStack gap="$1">
        <XStack jc="space-between" ai="center" gap="$3">
          <Skeleton.HeadingLg w={220} />
          <Skeleton.BodyMd w={96} />
        </XStack>
        <Skeleton.BodyMd w={280} />
      </YStack>
      <Skeleton w="100%" h={48} radius="round" />
      <Divider mt="auto" borderColor={INVITE_CARD_BORDER_COLOR} />
      <XStack jc="space-between" ai="flex-start" gap="$6">
        <YStack gap="$1" py="$1">
          <Skeleton.BodyMd w={72} />
          <Skeleton.BodyLg w={120} />
        </YStack>
        <XStack h={28} ai="center">
          <Skeleton.BodyMd w={96} />
        </XStack>
      </XStack>
    </YStack>
  );

  const productRows = (
    <YStack gap="$3">
      <Skeleton.HeadingLg w={180} />
      <YStack>
        <XStack gap="$4" pb="$2">
          {[1.4, 1, 1, 1].map((flex, index) => (
            <XStack key={index} flex={flex} flexBasis={0}>
              <Skeleton.BodyMd w={88} />
            </XStack>
          ))}
          <XStack w="$5" />
        </XStack>
        {[0, 1, 2, 3].map((index) => (
          <XStack key={index} gap="$4" py="$3" ai="center">
            <XStack flex={1.4} flexBasis={0} gap="$3" ai="center">
              <Skeleton w={40} h={40} radius="round" />
              <Skeleton.BodyLg w={120} />
            </XStack>
            {[0, 1, 2].map((cell) => (
              <XStack key={cell} flex={1} flexBasis={0}>
                <Skeleton.BodyLg w={80} />
              </XStack>
            ))}
            <XStack w="$5" />
          </XStack>
        ))}
      </YStack>
    </YStack>
  );

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
      {productRows}
    </YStack>
  );
}

// Inviting is the main action on native. The button opens the share card
// preview (save, copy link, X, Telegram, system share); copying alone lives
// on the invite card rows. A component of its own so the card's copy can
// read the level's rates through hooks once the summary has loaded.
const INVITE_FOOTER_BUTTON_PROPS = {
  testID: ReferFriendsTestIDs.inviteFriendsFooterBtn,
  icon: 'AddPeopleOutline',
} as const;

const InviteShareFooter = memo(function InviteShareFooter({
  summaryInfo,
  levelDetail,
  backgroundColor,
}: {
  summaryInfo: IInviteSummary;
  levelDetail: IInviteLevelDetail | undefined;
  backgroundColor: IPageProps['backgroundColor'];
}) {
  const { summary } = useInviteValueSummary({
    rebateConfig: summaryInfo.rebateConfig,
    rebateLevels: summaryInfo.rebateLevels,
    levelDetail,
  });
  const intl = useIntl();
  const inviteeRate = summary?.friendRate;
  const handleInvite = useCallback(() => {
    showReferralShareDialog({
      copy: getReferralShareCopy(intl, inviteeRate),
      inviteCode: summaryInfo.inviteCode,
      inviteUrl: summaryInfo.inviteUrl,
      displayUrl: formatInviteUrlForDisplay(summaryInfo.inviteUrl),
    });
  }, [intl, inviteeRate, summaryInfo.inviteCode, summaryInfo.inviteUrl]);

  return (
    <Page.Footer>
      <Page.FooterActions
        bg={backgroundColor}
        onConfirm={handleInvite}
        onConfirmText={intl.formatMessage({
          id: ETranslations.referral_invite_friends__action,
        })}
        confirmButtonProps={INVITE_FOOTER_BUTTON_PROPS}
      />
    </Page.Footer>
  );
});

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
  const switchTab = useCallback(
    (tab: IReferralPageTab, source: 'tabs' | 'cross_link') => {
      if (tab === activeTab) {
        return;
      }
      defaultLogger.referral.page.referralTabSwitched({
        from: activeTab,
        to: tab,
        source,
      });
      navigation.setParams({ tab });
    },
    [activeTab, navigation],
  );
  const setActiveTab = useCallback(
    (tab: IReferralPageTab) => switchTab(tab, 'tabs'),
    [switchTab],
  );
  const openPerks = useCallback(
    () => switchTab(EReferralPageTab.benefits, 'cross_link'),
    [switchTab],
  );
  const openInvite = useCallback(
    () => switchTab(EReferralPageTab.invite, 'cross_link'),
    [switchTab],
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

  // Perks only needs a wallet address, so it stays open without OneKey ID.
  useRedirectWhenNotLoggedIn({ tab: activeTab, enabled: isInviteTab });

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

  const isFetching = isRetrying || (isFirstLoading && !summaryInfo);
  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    try {
      await refreshAll();
    } finally {
      setIsRetrying(false);
    }
  }, [refreshAll]);
  const scrollFadeRef = useRef<IScrollEdgeFadeControl>(null);
  // Drives the fade through a ref: scrolling never re-renders the page.
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      scrollFadeRef.current?.setVisible(offsetY > 0);
    },
    [],
  );

  const showInviteFooter =
    platformEnv.isNative && isInviteTab && Boolean(summaryInfo?.inviteUrl);

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
        onScroll={isCompactHeader ? handleScroll : undefined}
        scrollEventThrottle={16}
        // Short tabs fill the viewport, so the cross-link at their end
        // rests at the bottom.
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <Page.Container padded={false} flex={1}>
          {summaryInfo ? (
            // Keep the invite tab mounted so switching tabs does not
            // refetch its data.
            <YStack display={isInviteTab ? 'flex' : 'none'} flex={1}>
              <InviteTabContent
                summaryInfo={summaryInfo}
                fetchSummaryInfo={fetchSummaryInfo}
                levelDetail={levelDetail}
                onOpenPerks={IS_BENEFITS_TAB_ENABLED ? openPerks : undefined}
              />
            </YStack>
          ) : null}
          {isInviteTab ? null : <MyRewardsContent onOpenInvite={openInvite} />}
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
                <SizableText size="$headingXl">
                  {intl.formatMessage({
                    id: ETranslations.sidebar_refer_a_friend,
                  })}
                </SizableText>
              )}
              {isInviteTab ? (
                <XStack ai="center" gap="$2" flexShrink={1} jc="flex-end">
                  {summaryInfo ? (
                    <InviteLevelPill
                      rebateConfig={summaryInfo.rebateConfig}
                      rebateLevels={summaryInfo.rebateLevels}
                      levelDetail={levelDetail}
                    />
                  ) : null}
                  <XStack gap="$4" ai="center">
                    <RulesButton />
                    {platformEnv.isWeb ? <LogoutButton /> : null}
                  </XStack>
                </XStack>
              ) : (
                // Perks says whose rewards these are where the invite tab
                // keeps its level and rules.
                <SizableText
                  size="$bodyMd"
                  color="$textSubdued"
                  numberOfLines={1}
                  flexShrink={1}
                >
                  {REFERRAL_TAB_COPY.perksIntro}
                </SizableText>
              )}
            </XStack>
          </Page.Container>
        )}
        {body}
        {isCompactHeader ? (
          <ScrollEdgeFade
            color={pageCanvas.headerBackgroundColor}
            controlRef={scrollFadeRef}
          />
        ) : null}
      </Page.Body>
      {showInviteFooter && summaryInfo ? (
        <InviteShareFooter
          summaryInfo={summaryInfo}
          levelDetail={levelDetail}
          backgroundColor={pageCanvas.backgroundColor}
        />
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
