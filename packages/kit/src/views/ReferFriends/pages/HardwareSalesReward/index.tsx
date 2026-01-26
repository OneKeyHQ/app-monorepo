import { useCallback, useEffect, useMemo, useState } from 'react';

import { useFocusEffect, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Page,
  RefreshControl,
  ScrollView,
  Spinner,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { TabPageHeader } from '@onekeyhq/kit/src/components/TabPageHeader';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useRedirectWhenNotLoggedIn } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useRedirectWhenNotLoggedIn';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IHardwareCumulativeRewards,
  IHardwareRecordItem,
} from '@onekeyhq/shared/src/referralCode/type';
import {
  EModalReferFriendsRoutes,
  EModalRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  BreadcrumbSection,
  ExportButton,
  FilterButton,
  ReferFriendsPageContainer,
} from '../../components';
import { useRewardFilter } from '../../hooks/useRewardFilter';

import { HardwareRecordsList } from './components/HardwareRecordsList';
import { HardwareSalesRewardHeader } from './components/HardwareSalesRewardHeader';

function HardwareSalesRewardPageWrapper() {
  // Redirect to ReferAFriend page if user is not logged in
  useRedirectWhenNotLoggedIn();

  const intl = useIntl();
  const { md } = useMedia();
  const navigation = useAppNavigation();
  const route = useRoute<{
    key: string;
    name: string;
    params?: { showOrderDetail?: boolean; orderId?: string };
  }>();

  // Handle showOrderDetail param - fetch data first, then open modal
  useFocusEffect(
    useCallback(() => {
      if (!route.params?.showOrderDetail || !route.params?.orderId) {
        return;
      }
      const orderId = route.params.orderId;
      navigation.setParams({ showOrderDetail: undefined, orderId: undefined });

      // Fetch order detail and open modal if successful
      void (async () => {
        try {
          const data =
            await backgroundApiProxy.serviceReferralCode.getHardwareRecordDetail(
              orderId,
            );
          if (data) {
            navigation.pushModal(EModalRoutes.ReferFriendsModal, {
              screen: EModalReferFriendsRoutes.HardwareSalesOrderDetail,
              params: { data },
            });
          }
        } catch (error) {
          // Silently fail - user is already on HardwareSalesReward page
          console.error(
            'Failed to fetch hardware order detail for modal:',
            error,
          );
        }
      })();
    }, [navigation, route.params?.showOrderDetail, route.params?.orderId]),
  );

  const [isLoading, setIsLoading] = useState(false);
  const [cumulativeRewards, setCumulativeRewards] = useState<
    IHardwareCumulativeRewards | undefined
  >();

  // Hardware Records state
  const [hardwareRecords, setHardwareRecords] = useState<IHardwareRecordItem[]>(
    [],
  );
  const [cursor, setCursor] = useState<string | undefined>();
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Filter state
  const { filterState, updateFilter } = useRewardFilter();

  const headerRight = useMemo(
    () => (
      <XStack gap="$2">
        <FilterButton filterState={filterState} onFilterChange={updateFilter} />
        <ExportButton
          timeRange={filterState.timeRange}
          inviteCode={filterState.inviteCode}
        />
      </XStack>
    ),
    [filterState, updateFilter],
  );

  const onRefresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const [cumulativeRewardsResult, recordsResult] = await Promise.allSettled(
        [
          backgroundApiProxy.serviceReferralCode.getHardwareCumulativeRewards(
            filterState.inviteCode,
            filterState.timeRange,
          ),
          backgroundApiProxy.serviceReferralCode.getHardwareRecords(
            undefined,
            filterState.timeRange,
            filterState.inviteCode,
          ),
        ],
      );

      if (cumulativeRewardsResult.status === 'fulfilled') {
        setCumulativeRewards(cumulativeRewardsResult.value);
      }

      if (recordsResult.status === 'fulfilled') {
        const items = recordsResult.value.items || [];
        setHardwareRecords(items);
        // Use last item's _id as cursor, undefined if no more data (items < limit)
        const hasMore = items.length >= 10;
        setCursor(hasMore ? items[items.length - 1]?._id : undefined);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [filterState.inviteCode, filterState.timeRange]);

  const onLoadMore = useCallback(async () => {
    if (!cursor || isLoadingMore) {
      return;
    }
    setIsLoadingMore(true);
    try {
      const result =
        await backgroundApiProxy.serviceReferralCode.getHardwareRecords(
          cursor,
          filterState.timeRange,
          filterState.inviteCode,
        );
      const items = result.items || [];
      setHardwareRecords((prev) => [...prev, ...items]);
      // Use last item's _id as cursor, undefined if no more data (items < limit)
      const hasMore = items.length >= 10;
      setCursor(hasMore ? items[items.length - 1]?._id : undefined);
    } catch (error) {
      console.error('Failed to load more:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [cursor, isLoadingMore, filterState.timeRange, filterState.inviteCode]);

  const handleScroll = useCallback(
    (event: {
      nativeEvent: {
        contentOffset: { y: number };
        contentSize: { height: number };
        layoutMeasurement: { height: number };
      };
    }) => {
      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      const paddingToBottom = 100;
      const isCloseToBottom =
        contentOffset.y + layoutMeasurement.height >=
        contentSize.height - paddingToBottom;

      if (isCloseToBottom && cursor && !isLoadingMore) {
        void onLoadMore();
      }
    },
    [cursor, isLoadingMore, onLoadMore],
  );

  useEffect(() => {
    void onRefresh();
  }, [onRefresh]);

  return (
    <Page>
      {platformEnv.isNative || md ? (
        <Page.Header
          title={intl.formatMessage({
            id: ETranslations.referral_referred_type_3,
          })}
          headerRight={() => headerRight}
        />
      ) : (
        <TabPageHeader
          sceneName={EAccountSelectorSceneName.home}
          tabRoute={ETabRoutes.ReferFriends}
          hideHeaderLeft={platformEnv.isDesktop}
        />
      )}
      <Page.Body>
        <ReferFriendsPageContainer flex={1} position="relative">
          {cumulativeRewards === undefined ? (
            <YStack
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
            </YStack>
          ) : (
            <ScrollView
              flex={1}
              refreshControl={
                <RefreshControl refreshing={isLoading} onRefresh={onRefresh} />
              }
              contentContainerStyle={{ pb: '$5' }}
              onScroll={handleScroll}
              scrollEventThrottle={16}
            >
              {/* Breadcrumb for desktop */}
              {!platformEnv.isNative && !md ? (
                <XStack px="$5" py="$5" jc="space-between" ai="center">
                  <BreadcrumbSection
                    secondItemLabel={intl.formatMessage({
                      id: ETranslations.referral_referred_type_3,
                    })}
                  />
                  {headerRight}
                </XStack>
              ) : null}

              {/* Hardware Sales Reward Header */}
              <HardwareSalesRewardHeader
                cumulativeRewards={cumulativeRewards}
                isLoading={isLoading}
                onRefresh={onRefresh}
              />

              {/* Hardware Records List */}
              <HardwareRecordsList
                isLoading={isLoading}
                records={hardwareRecords}
                isMobile={md}
                isLoadingMore={isLoadingMore}
              />
            </ScrollView>
          )}
        </ReferFriendsPageContainer>
      </Page.Body>
    </Page>
  );
}

export default function HardwareSalesReward() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <HardwareSalesRewardPageWrapper />
    </AccountSelectorProviderMirror>
  );
}
