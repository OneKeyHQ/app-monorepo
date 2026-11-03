import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Icon,
  ScrollView,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useFormatDate from '@onekeyhq/kit/src/hooks/useFormatDate';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type {
  IMarketStockNewsItem,
  IMarketStockNewsResponse,
} from '@onekeyhq/shared/types/marketV2';

import { useStockDetail } from '../../hooks/StockDetailContext';
import { STAT_FALLBACK_VALUE } from '../../utils/statValue';
import { STOCK_DETAIL_HORIZONTAL_GUTTER } from '../stockDesktopLayoutConstants';

type IStockNewsRequestState = {
  data?: IMarketStockNewsResponse;
  status: 'pending' | 'success' | 'error';
};

const NEWS_VISIBLE_COUNT = 3;
const NEWS_DIALOG_LIST_MAX_HEIGHT = 480;
const NEWS_META_DIVIDER_HEIGHT = 10;
// Mobile rows drop the summary: 16pt meta + 8pt gap + two 24pt title lines.
const NEWS_MOBILE_SKELETON_HEIGHT = 72;
const NEWS_DESKTOP_SKELETON_HEIGHT = 96;

type IStockNewsSectionVariant = 'desktop' | 'mobile';
// Dialog defaults to MAX_CONTENT_WIDTH (400) on desktop, which truncates the
// single-line headlines. Reuse the wide panel width already used by the stock
// token selector popover on this page (MarketTokenSelector.tsx).
const NEWS_DIALOG_WIDTH = 800;
const NEWS_DIALOG_FLOATING_PANEL_PROPS = {
  width: NEWS_DIALOG_WIDTH,
  maxWidth: '90%',
} as const;

function StockNewsRow({
  item,
  variant,
}: {
  item: IMarketStockNewsItem;
  variant: IStockNewsSectionVariant;
}) {
  const { formatDate } = useFormatDate();
  const isMobile = variant === 'mobile';
  return (
    <XStack
      height={isMobile ? undefined : 112}
      minHeight={isMobile ? 48 : undefined}
      alignItems="center"
      justifyContent="space-between"
      gap="$4"
      py="$2"
      cursor="pointer"
      hoverStyle={{ opacity: 0.8 }}
      pressStyle={{ opacity: 0.8 }}
      onPress={() => openUrlExternal(item.url)}
    >
      <YStack flex={1} minWidth={0} height={isMobile ? undefined : 96} gap="$2">
        <XStack gap="$2" alignItems="center">
          <SizableText size="$bodySm" color="$textSubdued">
            {item.source}
          </SizableText>
          <Stack
            width={1}
            height={NEWS_META_DIVIDER_HEIGHT}
            bg="$borderSubdued"
            flexShrink={0}
          />
          <SizableText size="$bodySm" color="$textSubdued">
            {formatDate(item.publishedAt, { hideTimeForever: true })}
          </SizableText>
        </XStack>
        <SizableText size="$bodyLgMedium" numberOfLines={isMobile ? 2 : 1}>
          {item.title}
        </SizableText>
        {isMobile ? null : (
          <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={2}>
            {item.summary ?? STAT_FALLBACK_VALUE}
          </SizableText>
        )}
      </YStack>
      <Icon
        name="ChevronRightSmallOutline"
        size="$5"
        color="$iconSubdued"
        flexShrink={0}
      />
    </XStack>
  );
}

function StockNewsListDialogContent({
  items,
  variant,
}: {
  items: IMarketStockNewsItem[];
  variant: IStockNewsSectionVariant;
}) {
  return (
    <ScrollView
      testID="stock-news-dialog-list"
      maxHeight={NEWS_DIALOG_LIST_MAX_HEIGHT}
    >
      <YStack>
        {items.map((item) => (
          <StockNewsRow key={item.id} item={item} variant={variant} />
        ))}
      </YStack>
    </ScrollView>
  );
}

export function StockNewsSection({
  variant = 'desktop',
}: {
  variant?: IStockNewsSectionVariant;
} = {}) {
  const { stockId } = useStockDetail();
  const intl = useIntl();
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
  const allNews = useMemo(() => {
    if (!newsResponse || newsResponse.stockId.toUpperCase() !== stockId) {
      return [];
    }
    return newsResponse.items;
  }, [newsResponse, stockId]);
  const news = useMemo(() => allNews.slice(0, NEWS_VISIBLE_COUNT), [allNews]);

  const handleShowMore = useCallback(() => {
    Dialog.show({
      title: intl.formatMessage({ id: ETranslations.market_stock_news }),
      renderContent: (
        <StockNewsListDialogContent items={allNews} variant={variant} />
      ),
      showFooter: false,
      disableDrag: true,
      floatingPanelProps: NEWS_DIALOG_FLOATING_PANEL_PROPS,
    });
  }, [allNews, intl, variant]);

  // A stock with no headlines hides the section; a failed request keeps it so
  // the reader can retry.
  if (!isLoading && result.status === 'success' && allNews.length === 0) {
    return null;
  }

  return (
    <YStack testID="stock-detail-news" px={STOCK_DETAIL_HORIZONTAL_GUTTER}>
      <YStack py="$8" gap="$4">
        <SizableText size="$headingXl">
          {intl.formatMessage({ id: ETranslations.market_stock_news })}
        </SizableText>
        {isLoading && news.length === 0
          ? Array.from({ length: 3 }).map((_, index) => (
              <Skeleton
                key={index}
                width="100%"
                height={
                  variant === 'mobile'
                    ? NEWS_MOBILE_SKELETON_HEIGHT
                    : NEWS_DESKTOP_SKELETON_HEIGHT
                }
              />
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
        {news.map((item) => (
          <StockNewsRow key={item.id} item={item} variant={variant} />
        ))}
        {allNews.length > NEWS_VISIBLE_COUNT ? (
          <Button
            testID="stock-news-more"
            size="small"
            variant="tertiary"
            alignSelf="flex-start"
            onPress={handleShowMore}
          >
            {intl.formatMessage({ id: ETranslations.global_show_more })}
          </Button>
        ) : null}
      </YStack>
    </YStack>
  );
}
