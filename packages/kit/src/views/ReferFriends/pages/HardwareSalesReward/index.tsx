import { useCallback, useEffect, useMemo, useState } from 'react';

import { useFocusEffect, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  DatePicker,
  Page,
  ScrollView,
  Spinner,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import type { IDateRange } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useRedirectWhenNotLoggedIn } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useRedirectWhenNotLoggedIn';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IHardwareCumulativeRewards,
  IHardwareRecordItem,
} from '@onekeyhq/shared/src/referralCode/type';
import {
  EModalReferFriendsRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  ExportButton,
  FilterButton,
  ReferFriendsDetailHeader,
  ReferFriendsPageContainer,
} from '../../components';
import { useDatePresets } from '../../hooks/useDatePresets';
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
  const {
    filterState,
    updateFilter,
    setCustomDateRange,
    clearCustomDateRange,
    datePickerValue,
  } = useRewardFilter({
    startTime: new Date('2024-01-01T00:00:00.000').getTime(),
    endTime: (() => {
      const d = new Date();
      d.setHours(23, 59, 59, 999);
      return d.getTime();
    })(),
  });

  // DatePicker intermediate state
  const [intermediateDateRange, setIntermediateDateRange] =
    useState<IDateRange | null>(null);

  const handleDateRangeChange = useCallback(
    (range: IDateRange) => {
      if (range.start && range.end) {
        const start = new Date(range.start);
        start.setHours(0, 0, 0, 0);
        const end = new Date(range.end);
        end.setHours(23, 59, 59, 999);
        setCustomDateRange(start.getTime(), end.getTime());
        setIntermediateDateRange(null);
      } else if (range.start) {
        setIntermediateDateRange(range);
      } else {
        setIntermediateDateRange(null);
        clearCustomDateRange();
      }
    },
    [setCustomDateRange, clearCustomDateRange],
  );

  const currentDatePickerValue = intermediateDateRange ?? datePickerValue;
  const maxDate = useMemo(() => new Date(), []);

  const presets = useDatePresets();

  const effectiveTimeRange =
    filterState.startTime && filterState.endTime
      ? undefined
      : filterState.timeRange;

  const toolbar = useMemo(
    () => (
      <>
        <YStack width={240}>
          <DatePicker.Range
            value={currentDatePickerValue}
            onChange={handleDateRangeChange}
            maxDate={maxDate}
            showPreviousMonth
            presets={presets}
          />
        </YStack>
        <XStack gap="$3">
          <FilterButton
            filterState={filterState}
            onFilterChange={updateFilter}
          />
          <ExportButton
            timeRange={effectiveTimeRange}
            inviteCode={filterState.inviteCode}
            startTime={filterState.startTime}
            endTime={filterState.endTime}
          />
        </XStack>
      </>
    ),
    [
      currentDatePickerValue,
      handleDateRangeChange,
      maxDate,
      presets,
      filterState,
      updateFilter,
      effectiveTimeRange,
    ],
  );

  const onRefresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const [cumulativeRewardsResult, recordsResult] = await Promise.allSettled(
        [
          backgroundApiProxy.serviceReferralCode.getHardwareCumulativeRewards(
            filterState.inviteCode,
            effectiveTimeRange,
            filterState.startTime,
            filterState.endTime,
          ),
          backgroundApiProxy.serviceReferralCode.getHardwareRecords(
            undefined,
            effectiveTimeRange,
            filterState.inviteCode,
            filterState.startTime,
            filterState.endTime,
          ),
        ],
      );

      if (cumulativeRewardsResult.status === 'fulfilled') {
        setCumulativeRewards(cumulativeRewardsResult.value);
      }

      if (recordsResult.status === 'fulfilled') {
        const items = recordsResult.value.items || [];
        setHardwareRecords(items);
        const hasMore = items.length >= 10;
        setCursor(hasMore ? items[items.length - 1]?._id : undefined);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [
    filterState.inviteCode,
    effectiveTimeRange,
    filterState.startTime,
    filterState.endTime,
  ]);

  const onLoadMore = useCallback(async () => {
    if (!cursor || isLoadingMore) {
      return;
    }
    setIsLoadingMore(true);
    try {
      const result =
        await backgroundApiProxy.serviceReferralCode.getHardwareRecords(
          cursor,
          effectiveTimeRange,
          filterState.inviteCode,
          filterState.startTime,
          filterState.endTime,
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
  }, [
    cursor,
    isLoadingMore,
    effectiveTimeRange,
    filterState.inviteCode,
    filterState.startTime,
    filterState.endTime,
  ]);

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
      <ReferFriendsDetailHeader
        title={intl.formatMessage({
          id: ETranslations.referral_referred_type_3,
        })}
        toolbar={toolbar}
      />
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
              contentContainerStyle={{ pb: '$5' }}
              onScroll={handleScroll}
              scrollEventThrottle={16}
            >
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
