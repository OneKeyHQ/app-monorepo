import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  SizableText,
  Skeleton,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useFormatDate from '@onekeyhq/kit/src/hooks/useFormatDate';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IMarketStockNewsResponse } from '@onekeyhq/shared/types/marketV2';

import { useStockDetail } from '../../hooks/StockDetailContext';
import { STAT_FALLBACK_VALUE } from '../../utils/statValue';
import { STOCK_DETAIL_HORIZONTAL_GUTTER } from '../stockDesktopLayoutConstants';

type IStockNewsRequestState = {
  data?: IMarketStockNewsResponse;
  status: 'pending' | 'success' | 'error';
};

export function StockNewsSection() {
  const { stockId } = useStockDetail();
  const intl = useIntl();
  const { formatDate } = useFormatDate();
  const {
    result,
    isLoading,
    run: retry,
  } = usePromiseResult<IStockNewsRequestState>(
    async () => {
      if (!stockId) return { status: 'success' };
      try {
        const data =
          await backgroundApiProxy.serviceMarketV2.fetchMarketStockNews({
            stockId,
            limit: 20,
          });
        return { data, status: 'success' };
      } catch (_error) {
        return { status: 'error' };
      }
    },
    [stockId],
    {
      initResult: { status: 'pending' },
      watchLoading: true,
      checkIsFocused: false,
    },
  );
  const newsResponse = result.data;
  const news = useMemo(() => {
    if (!newsResponse || newsResponse.stockId.toUpperCase() !== stockId) {
      return [];
    }
    return newsResponse.items.slice(0, 3);
  }, [newsResponse, stockId]);

  return (
    <YStack
      testID="stock-detail-news"
      height={476}
      px={STOCK_DETAIL_HORIZONTAL_GUTTER}
    >
      <YStack height={476} py="$8" gap="$4">
        <SizableText size="$headingXl">News</SizableText>
        {isLoading && news.length === 0
          ? Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} width="100%" height={96} />
            ))
          : null}
        {!isLoading && result.status === 'error' ? (
          <YStack
            height={336}
            alignItems="center"
            justifyContent="center"
            gap="$2"
          >
            <SizableText color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.global_unknown_error_retry_message,
              })}
            </SizableText>
            <Button
              testID="stock-news-retry"
              size="small"
              variant="tertiary"
              onPress={() => void retry()}
            >
              {intl.formatMessage({ id: ETranslations.global_retry })}
            </Button>
          </YStack>
        ) : null}
        {!isLoading && result.status === 'success' && news.length === 0 ? (
          <YStack height={336} alignItems="center" justifyContent="center">
            <SizableText color="$textSubdued">
              {intl.formatMessage({ id: ETranslations.global_no_data })}
            </SizableText>
          </YStack>
        ) : null}
        {news.map((item) => (
          <XStack
            key={item.id}
            height={112}
            alignItems="center"
            justifyContent="space-between"
            gap="$4"
            py="$2"
            cursor="pointer"
            hoverStyle={{ opacity: 0.8 }}
            pressStyle={{ opacity: 0.8 }}
            onPress={() => openUrlExternal(item.url)}
          >
            <YStack flex={1} height={96} gap="$2">
              <XStack gap="$2">
                <SizableText size="$bodySm" color="$textSubdued">
                  {item.source}
                </SizableText>
                <SizableText size="$bodySm" color="$textSubdued">
                  {formatDate(item.publishedAt, { hideTimeForever: true })}
                </SizableText>
              </XStack>
              <SizableText size="$bodyLgMedium">{item.title}</SizableText>
              <SizableText
                size="$bodyMd"
                color="$textSubdued"
                numberOfLines={2}
              >
                {item.summary ?? STAT_FALLBACK_VALUE}
              </SizableText>
            </YStack>
            <Icon
              name="ChevronRightSmallOutline"
              size="$5"
              color="$iconSubdued"
            />
          </XStack>
        ))}
      </YStack>
    </YStack>
  );
}
