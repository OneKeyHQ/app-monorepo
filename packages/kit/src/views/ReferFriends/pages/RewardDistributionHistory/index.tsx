import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Empty,
  Page,
  RefreshControl,
  SectionList,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IHardwareSalesRecord } from '@onekeyhq/shared/src/referralCode/type';
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

export default function RewardDistributionHistory() {
  const originalData = useRef<IHardwareSalesRecord['items']>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sections, setSections] = useState<
    { title: string; data: IHardwareSalesRecord['items'] }[] | undefined
  >(undefined);
  const fetchSales = useCallback((cursor?: string) => {
    return backgroundApiProxy.serviceReferralCode.getHardwareSales(cursor);
  }, []);

  const onRefresh = useCallback(() => {
    setIsLoading(true);
    void Promise.allSettled([fetchSales()]).then(([salesResult]) => {
      if (salesResult.status === 'fulfilled') {
        const data = salesResult.value;
        setSections(formatSections(data.items));
        originalData.current.push(...data.items);
      }

      setIsLoading(false);
    });
  }, [fetchSales]);

  useEffect(() => {
    onRefresh();
  }, [fetchSales, onRefresh]);
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
      const isPositiveAmount = Number(item.amount) >= 0;
      return (
        <YStack px="$5" py="$2.5">
          <XStack jc="space-between" ai="center" gap="$4">
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
                })} ${item.title}`}
              </SizableText>
            </YStack>
            <XStack>
              <Currency
                sourceCurrency="usd"
                numberOfLines={1}
                formatter="balance"
                formatterOptions={{
                  showPlusMinusSigns: true,
                }}
                color={isPositiveAmount ? '$textSuccess' : '$textCritical'}
                size="$bodyLgMedium"
                pr="$0.5"
              >
                {item.amount}
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
        title="Reward Distribution History"
      />
      <Page.Body>
        {sections === undefined ? (
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
            sections={sections}
            renderSectionHeader={renderSectionHeader}
            estimatedItemSize={44}
            renderItem={renderItem}
            onEndReached={fetchMore}
          />
        )}
      </Page.Body>
    </Page>
  );
}
