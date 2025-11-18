import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { useDebouncedCallback } from 'use-debounce';

import {
  Alert,
  Divider,
  Empty,
  IconButton,
  Page,
  RefreshControl,
  SectionList,
  SizableText,
  Spinner,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { useSpotlight } from '@onekeyhq/kit/src/components/Spotlight';
import { TabPageHeader } from '@onekeyhq/kit/src/components/TabPageHeader';
import { useRedirectWhenNotLoggedIn } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useRedirectWhenNotLoggedIn';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IHardwareSalesRecord } from '@onekeyhq/shared/src/referralCode/type';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';
import { formatDate, formatTime } from '@onekeyhq/shared/src/utils/dateUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  BreadcrumbSection,
  ExportButton,
  FilterButton,
  ReferFriendsPageContainer,
} from '../../components';
import { useRewardFilter } from '../../hooks/useRewardFilter';

type ISectionListItem = {
  title?: string;
  data: number[];
};

const formatSections = (items: IHardwareSalesRecord['items']) => {
  const groupedData: Record<string, IHardwareSalesRecord['items']> =
    items.reduce<Record<string, any[]>>((acc, item) => {
      const date = new Date(item.createdAt);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const dateKey = `${year}-${month.toString().padStart(2, '0')}-${day
        .toString()
        .padStart(2, '0')}`;

      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }

      acc[dateKey].push(item);
      return acc;
    }, {} as Record<string, IHardwareSalesRecord['items']>);

  return Object.keys(groupedData).map((dateKey) => {
    const date = new Date(groupedData[dateKey][0].createdAt);
    return {
      title: formatDate(date, {
        hideTimeForever: true,
      }),
      data: groupedData[dateKey],
    };
  });
};

function HardwareSalesRewardPageWrapper() {
  // Redirect to ReferAFriend page if user is not logged in
  useRedirectWhenNotLoggedIn();

  const [settings] = useSettingsPersistAtom();
  const originalData = useRef<IHardwareSalesRecord['items']>([]);
  const { tourTimes, tourVisited } = useSpotlight(
    ESpotlightTour.hardwareSalesRewardAlert,
  );
  const intl = useIntl();
  const { md } = useMedia();

  const [isLoading, setIsLoading] = useState(false);
  const [sections, setSections] = useState<
    { title: string; data: IHardwareSalesRecord['items'] }[]
  >([]);
  const [amount, setAmount] = useState<
    | {
        undistributed: string;
        pending: string;
      }
    | undefined
  >();

  // Use the filter hook for state management only
  const { filterState, updateFilter } = useRewardFilter();

  const renderHeaderRight = useCallback(() => {
    return (
      <XStack gap="$2">
        <FilterButton filterState={filterState} onFilterChange={updateFilter} />
        <ExportButton
          timeRange={filterState.timeRange}
          inviteCode={filterState.inviteCode}
        />
      </XStack>
    );
  }, [filterState, updateFilter]);

  const onRefresh = useCallback(async () => {
    setIsLoading(true);
    const [salesResult, cumulativeRewardsResult] = await Promise.allSettled([
      backgroundApiProxy.serviceReferralCode.getHardwareSales(
        undefined,
        filterState.timeRange,
        filterState.inviteCode,
      ),
      backgroundApiProxy.serviceReferralCode.getHardwareCumulativeRewards(
        filterState.inviteCode,
        filterState.timeRange,
      ),
    ]);

    if (salesResult.status === 'fulfilled') {
      const data = salesResult.value;
      originalData.current = data.items;
      setSections(formatSections(data.items));
    }

    if (cumulativeRewardsResult.status === 'fulfilled') {
      const data = cumulativeRewardsResult.value;
      setAmount({
        undistributed: data.undistributed || '0',
        pending: data.pending || '0',
      });
    }
    setIsLoading(false);
  }, [filterState.timeRange, filterState.inviteCode]);

  useEffect(() => {
    void onRefresh();
  }, [onRefresh]);

  const renderSectionHeader = useCallback(
    (item: { section: ISectionListItem }) => {
      if (item.section.title) {
        return <SectionList.SectionHeader title={item.section.title} />;
      }
    },
    [],
  );

  const fetchMore = useCallback(async () => {
    if (originalData.current.length < 1) {
      return;
    }
    const data = await backgroundApiProxy.serviceReferralCode.getHardwareSales(
      originalData.current[originalData.current.length - 1]._id,
      filterState.timeRange,
      filterState.inviteCode,
    );
    if (data.items.length > 0) {
      const uniqueItems = data.items.filter(
        (item) =>
          !originalData.current.some(
            (existingItem) => existingItem._id === item._id,
          ),
      );
      originalData.current.push(...uniqueItems);
      setSections(formatSections(originalData.current));
    }
  }, [filterState.timeRange, filterState.inviteCode]);

  const debounceFetchMore = useDebouncedCallback(fetchMore, 250);

  const renderItem = useCallback(
    ({
      item,
    }: {
      item: IHardwareSalesRecord['items'][0];
      section: ISectionListItem;
    }) => {
      const isPositiveAmount = Number(item.fiatValue) >= 0;
      return (
        <YStack px="$5" py="$2.5">
          <XStack jc="space-between" gap="$4">
            <YStack flexShrink={1}>
              <XStack flexShrink={1}>
                <SizableText size="$bodyLgMedium" flexShrink={1}>
                  {item.heading || '-'}
                </SizableText>
              </XStack>
              <SizableText
                color="$textSubdued"
                size="$bodyMd"
                numberOfLines={1}
                flexShrink={1}
              >
                {`${formatTime(new Date(item.createdAt), {
                  hideSeconds: true,
                  hideMilliseconds: true,
                })} ${item.orderName || item.title || ''}`}
              </SizableText>
            </YStack>
            <XStack>
              <Currency
                numberOfLines={1}
                formatter="balance"
                formatterOptions={{
                  showPlusMinusSigns: true,
                }}
                color={isPositiveAmount ? '$textSuccess' : '$textCritical'}
                size="$bodyLgMedium"
                pr="$0.5"
              >
                {item.fiatValue}
              </Currency>
            </XStack>
          </XStack>
        </YStack>
      );
    },
    [],
  );

  const keyExtractor = useCallback(
    (item: IHardwareSalesRecord['items'][0]) => item._id,
    [],
  );

  return (
    <Page>
      {platformEnv.isNative || md ? (
        <Page.Header
          title={intl.formatMessage({
            id: ETranslations.referral_referred_type_3,
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
        <ReferFriendsPageContainer flex={1} position="relative">
          {amount === undefined ? (
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
            <SectionList
              flex={1}
              refreshControl={
                <RefreshControl refreshing={isLoading} onRefresh={onRefresh} />
              }
              contentContainerStyle={{ pb: '$5' }}
              ListEmptyComponent={
                <Empty
                  icon="GiftOutline"
                  title={intl.formatMessage({
                    id: ETranslations.referral_referred_empty,
                  })}
                  description={intl.formatMessage({
                    id: ETranslations.referral_referred_empty_desc,
                  })}
                />
              }
              ListHeaderComponent={
                <>
                  {!platformEnv.isNative && !md ? (
                    <XStack px="$5" py="$5" jc="space-between" ai="center">
                      <BreadcrumbSection
                        secondItemLabel={intl.formatMessage({
                          id: ETranslations.referral_referred_type_3,
                        })}
                      />
                      {renderHeaderRight()}
                    </XStack>
                  ) : null}
                  {tourTimes === 0 ? (
                    <Alert
                      closable
                      description={intl.formatMessage({
                        id: ETranslations.referral_sales_reward_tips,
                      })}
                      type="info"
                      mx="$5"
                      mb="$2.5"
                      onClose={tourVisited}
                    />
                  ) : null}
                  <YStack px="$5">
                    <SizableText size="$bodyLg">
                      {intl.formatMessage({
                        id: ETranslations.referral_reward_undistributed,
                      })}
                    </SizableText>
                    <XStack gap="$2" ai="center">
                      {Number(amount.undistributed) > 0 ? (
                        <Currency
                          formatter="value"
                          size="$heading5xl"
                          pr="$0.5"
                        >
                          {amount.undistributed}
                        </Currency>
                      ) : (
                        <SizableText size="$heading5xl">0</SizableText>
                      )}
                      <YStack>
                        {platformEnv.isNative ? null : (
                          <IconButton
                            icon="RefreshCcwOutline"
                            variant="tertiary"
                            loading={isLoading}
                            onPress={onRefresh}
                          />
                        )}
                      </YStack>
                    </XStack>

                    {Number(amount.pending) > 0 ? (
                      <XStack gap="$1">
                        <Currency
                          formatter="value"
                          formatterOptions={{
                            currency: settings.currencyInfo.symbol,
                            showPlusMinusSigns: true,
                          }}
                          size="$bodyMdMedium"
                        >
                          {amount.pending}
                        </Currency>
                        <SizableText size="$bodyMd" color="t$extSubdued">
                          {intl.formatMessage({
                            id: ETranslations.referral_reward_undistributed_pending,
                          })}
                        </SizableText>
                      </XStack>
                    ) : null}
                    <Divider mt="$5" />
                    {sections.length ? (
                      <XStack jc="space-between" h={38} ai="center">
                        <SizableText size="$bodyMd" color="$textSubdued">
                          {intl.formatMessage({
                            id: ETranslations.referral_order_info,
                          })}
                        </SizableText>
                        <SizableText size="$bodyMd" color="$textSubdued">
                          {intl.formatMessage({
                            id: ETranslations.earn_rewards,
                          })}
                        </SizableText>
                      </XStack>
                    ) : null}
                  </YStack>
                </>
              }
              sections={sections}
              renderSectionHeader={renderSectionHeader}
              estimatedItemSize={60}
              renderItem={renderItem}
              onEndReached={debounceFetchMore}
              keyExtractor={keyExtractor}
            />
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
