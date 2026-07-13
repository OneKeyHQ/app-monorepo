import { useCallback, useMemo, useRef, useState } from 'react';

import { useFocusEffect, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Page,
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
import { CumulativeRewards } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/CumulativeRewards';
import { CurrentLevelCard } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/CurrentLevelCard';
import { InvitationDetailsSection } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/InvitationDetailsSection';
import { LogoutButton } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/LogoutButton';
import { ReferralCodeCard } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/ReferralCodeCard';
import { RulesButton } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/RulesButton';
import { SectionHeader } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/SectionHeader';
import { ResponsiveTwoColumnLayout } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/shared';
import { SuspensionAlert } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/SuspensionAlert';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IInviteSummary } from '@onekeyhq/shared/src/referralCode/type';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { useNavigateToRewardHistory } from '../RewardDistributionHistory/hooks/useNavigateToRewardHistory';

import {
  CreatorProgramBanner,
  formatCreatorProgramLocale,
} from './components/CreatorProgramBanner';
import { ReferralListButton } from './components/ReferralListButton';

import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';

function InviteRewardContent({
  summaryInfo,
  fetchSummaryInfo,
  onCreatorProgramBannerLayout,
}: {
  summaryInfo: IInviteSummary;
  fetchSummaryInfo: () => void;
  onCreatorProgramBannerLayout: (event: LayoutChangeEvent) => void;
}) {
  const {
    inviteUrl,
    inviteCode,
    enabledNetworks,
    cumulativeRewards,
    rebateLevels,
    rebateConfig,
    withdrawAddresses,
    suspensionNotice,
    suspensionContactLabel,
  } = summaryInfo;

  return (
    <>
      <SuspensionAlert
        suspensionNotice={suspensionNotice}
        suspensionContactLabel={suspensionContactLabel}
      />

      <XStack px="$pagePadding" pt="$5" pb="$4" jc="space-between" ai="center">
        <SectionHeader translationId={ETranslations.global_overview} />

        <XStack $md={{ display: 'none' }} gap="$4">
          <RulesButton />
          {platformEnv.isWeb ? <LogoutButton /> : null}
        </XStack>

        <XStack $gtMd={{ display: 'none' }} $md={{ display: 'flex' }}>
          <ReferralListButton />
        </XStack>
      </XStack>

      <ResponsiveTwoColumnLayout
        reverseOnMobile
        leftColumn={
          <CumulativeRewards
            cumulativeRewards={cumulativeRewards}
            withdrawAddresses={withdrawAddresses}
            enabledNetworks={enabledNetworks}
            fetchSummaryInfo={fetchSummaryInfo}
          />
        }
        rightColumn={
          <ReferralCodeCard inviteUrl={inviteUrl} inviteCode={inviteCode} />
        }
      />

      <YStack py="$5">
        <CurrentLevelCard
          rebateConfig={rebateConfig}
          rebateLevels={rebateLevels}
        />
      </YStack>

      <InvitationDetailsSection
        summaryInfo={summaryInfo}
        fetchSummaryInfo={fetchSummaryInfo}
      />

      <CreatorProgramBanner onLayout={onCreatorProgramBannerLayout} />
    </>
  );
}

function InviteRewardPage() {
  const intl = useIntl();
  const { md } = useMedia();
  const navigation = useAppNavigation();
  const navigateToRewardHistory = useNavigateToRewardHistory();
  const creatorProgramBannerLayoutRef = useRef<
    { y: number; height: number } | undefined
  >(undefined);
  const scrollViewportHeightRef = useRef(0);
  const scrollYRef = useRef(0);
  const didTrackCreatorProgramBannerViewRef = useRef(false);
  const route = useRoute<{
    key: string;
    name: string;
    params?: { showRewardDistributionHistory?: boolean };
  }>();
  const creatorProgramLocale = useMemo(
    () => formatCreatorProgramLocale(intl.locale),
    [intl.locale],
  );
  const trackCreatorProgramBannerViewIfVisible = useCallback(() => {
    const layout = creatorProgramBannerLayoutRef.current;
    const viewportHeight = scrollViewportHeightRef.current;

    if (
      didTrackCreatorProgramBannerViewRef.current ||
      !layout ||
      !viewportHeight
    ) {
      return;
    }

    const viewportTop = scrollYRef.current;
    const viewportBottom = viewportTop + viewportHeight;
    const bannerTop = layout.y;
    const bannerBottom = bannerTop + layout.height;

    if (bannerTop < viewportBottom && bannerBottom > viewportTop) {
      didTrackCreatorProgramBannerViewRef.current = true;
      defaultLogger.referral.page.viewCreatorProgramBanner({
        locale: creatorProgramLocale,
      });
    }
  }, [creatorProgramLocale]);

  const handleScrollViewLayout = useCallback(
    (event: LayoutChangeEvent) => {
      scrollViewportHeightRef.current = event.nativeEvent.layout.height;
      trackCreatorProgramBannerViewIfVisible();
    },
    [trackCreatorProgramBannerViewIfVisible],
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollYRef.current = event.nativeEvent.contentOffset.y;
      scrollViewportHeightRef.current =
        event.nativeEvent.layoutMeasurement.height;
      trackCreatorProgramBannerViewIfVisible();
    },
    [trackCreatorProgramBannerViewIfVisible],
  );

  const handleCreatorProgramBannerLayout = useCallback(
    (event: LayoutChangeEvent) => {
      creatorProgramBannerLayoutRef.current = {
        y: event.nativeEvent.layout.y,
        height: event.nativeEvent.layout.height,
      };
      trackCreatorProgramBannerViewIfVisible();
    },
    [trackCreatorProgramBannerViewIfVisible],
  );

  // Handle showRewardDistributionHistory param - open modal once when param is set
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

  // Redirect to ReferAFriend page if user is not logged in
  useRedirectWhenNotLoggedIn();

  const [isFirstLoading, setIsFirstLoading] = useState(true);

  const renderHeaderRight = useCallback(() => <RulesButton />, []);

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
      pollingInterval: timerUtils.getTimeDurationMs({ minute: 1 }), // Auto refresh every 1 minute
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      undefinedResultIfError: true,
      watchLoading: false, // Disable auto loading state for silent refresh
      onIsLoadingChange: (loading) => {
        // Only show loading on first fetch
        if (!loading && isFirstLoading) {
          setIsFirstLoading(false);
        }
      },
    },
  );

  const isFetching = isFirstLoading && (isLoading ?? summaryInfo === undefined);

  return (
    <Page>
      {platformEnv.isNative || md ? (
        <Page.Header
          title={intl.formatMessage({
            id: ETranslations.referral_title,
          })}
          headerRight={renderHeaderRight}
        />
      ) : (
        <TabPageHeader
          sceneName={EAccountSelectorSceneName.home}
          tabRoute={ETabRoutes.ReferFriends}
          hideHeaderLeft={platformEnv.isDesktop}
        />
      )}
      <Page.Body>
        {(() => {
          if (isFetching) {
            return (
              <Stack
                position="absolute"
                top={0}
                left={0}
                right={0}
                bottom={0}
                ai="center"
                jc="center"
                flex={1}
              >
                <Spinner size="large" />
              </Stack>
            );
          }

          if (summaryInfo) {
            return (
              <ScrollView
                onLayout={handleScrollViewLayout}
                onScroll={handleScroll}
              >
                <Page.Container padded={false}>
                  <InviteRewardContent
                    summaryInfo={summaryInfo}
                    fetchSummaryInfo={fetchSummaryInfo}
                    onCreatorProgramBannerLayout={
                      handleCreatorProgramBannerLayout
                    }
                  />
                </Page.Container>
              </ScrollView>
            );
          }

          return null;
        })()}
      </Page.Body>
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
