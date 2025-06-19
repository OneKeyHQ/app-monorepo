import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

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
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { useSpotlight } from '@onekeyhq/kit/src/components/Spotlight';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IHardwareSalesRecord } from '@onekeyhq/shared/src/referralCode/type';
import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';
import { formatDate, formatTime } from '@onekeyhq/shared/src/utils/dateUtils';

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

export default function HardwareSalesReward() {
  const [settings] = useSettingsPersistAtom();
  const originalData = useRef<IHardwareSalesRecord['items']>([]);
  const { tourTimes, tourVisited } = useSpotlight(
    ESpotlightTour.hardwareSalesRewardAlert,
  );

  const [isLoading, setIsLoading] = useState(false);
  const [sections, setSections] = useState<
    { title: string; data: IHardwareSalesRecord['items'] }[]
  >([]);
  const [amount, setAmount] = useState<
    | {
        available: string;
        pending: string;
      }
    | undefined
  >();
  const fetchSales = useCallback((cursor?: string) => {
    return backgroundApiProxy.serviceReferralCode.getHardwareSales(cursor);
  }, []);

  const fetchSummaryInfo = useCallback(() => {
    return backgroundApiProxy.serviceReferralCode.getSummaryInfo();
  }, []);

  const onRefresh = useCallback(() => {
    setIsLoading(true);
    void Promise.allSettled([fetchSales(), fetchSummaryInfo()]).then(
      ([salesResult, summaryResult]) => {
        if (salesResult.status === 'fulfilled') {
          const data = salesResult.value;
          setSections(formatSections(data.items));
          originalData.current.push(...data.items);
        }

        if (summaryResult.status === 'fulfilled') {
          const data = summaryResult.value;
          setAmount({
            available: data.HardwareSales.available?.[0]?.fiatValue || '0',
            pending: data.HardwareSales.pending?.[0]?.fiatValue || '0',
          });
        }
        setIsLoading(false);
      },
    );
  }, [fetchSales, fetchSummaryInfo]);

  useEffect(() => {
    onRefresh();
  }, [fetchSales, fetchSummaryInfo, onRefresh]);
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
    const data = await fetchSales(
      originalData.current[originalData.current.length - 1]._id,
    );
    if (data.items.length > 0) {
      originalData.current.push(...data.items);
      setSections(formatSections(originalData.current));
    }
  }, [fetchSales]);

  const intl = useIntl();
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
  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.referral_referred_type_3,
        })}
      />
      <Page.Body>
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
                    {Number(amount.available) > 0 ? (
                      <Currency formatter="value" size="$heading5xl" pr="$0.5">
                        {amount.available}
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
            onEndReached={fetchMore}
          />
        )}
      </Page.Body>
    </Page>
  );
}
