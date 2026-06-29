import type { ComponentProps, ReactNode } from 'react';

import {
  NumberSizeableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { ITableProps } from '@onekeyhq/components';
import { CommunityRecognizedBadge } from '@onekeyhq/kit/src/views/Market/components/CommunityRecognizedBadge';
import {
  StockSourceLogo,
  SubtitleBadge,
} from '@onekeyhq/kit/src/views/Market/components/PerpsBadges';
import { TokenIdentityItem } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/components/TokenIdentityItem';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { getTokenPriceChangeStyle } from '@onekeyhq/shared/src/utils/tokenUtils';

import type { IFavoriteTokenDisplay } from './types';
import type { IntlShape } from 'react-intl';

const POPULAR_TRADING_NAME_COLUMN_MIN_WIDTH = 260;
const EMPTY_MARKET_VALUE = '--';

type ITextSize = ComponentProps<typeof NumberSizeableText>['size'];

// Name cell shared with the Market list so the home widget matches the Market
// page exactly:
// - desktop (table): localized name (stock/perps) prefix + contract address,
//   or just the address; native tokens (e.g. BTC) with no address show nothing.
// - mobile (list): localized name + 24h volume
function renderPopularTradingTokenIdentity(
  record: IFavoriteTokenDisplay,
  { showVolume }: { showVolume: boolean },
) {
  return (
    <TokenIdentityItem
      tokenLogoURI={record.logoUrl}
      tokenLogoURIs={record.logoUrls}
      networkId={record.perpsCoin ? undefined : record.chainId}
      symbol={record.symbol}
      address={record.contractAddress}
      showVolume={showVolume}
      volume={record.volume24h}
      showCopyButton={!showVolume}
      communityRecognized={record.communityRecognized}
      stock={record.stock}
      maxLeverage={record.maxLeverage}
      perpsSubtitle={record.perpsSubtitle}
    />
  );
}

function renderPopularTradingStockBadges(record: IFavoriteTokenDisplay) {
  if (!record.stock) {
    return null;
  }

  return (
    <>
      <StockSourceLogo stock={record.stock} />
      {record.stock.subtitle ? (
        <SubtitleBadge subtitle={record.stock.subtitle} />
      ) : null}
    </>
  );
}

function renderPopularTradingCommunityBadge(record: IFavoriteTokenDisplay) {
  return record.communityRecognized ? <CommunityRecognizedBadge /> : null;
}

// 24h change as colored text, shared by the mobile price cell and the desktop
// 24H 涨跌 column (they only differ in font size).
function renderPopularTradingChangeText(
  record: IFavoriteTokenDisplay,
  size: ITextSize,
) {
  const { changeColor, showPlusMinusSigns } = getTokenPriceChangeStyle({
    priceChange: record.priceChange24h ?? 0,
  });
  return (
    <NumberSizeableText
      size={size}
      formatter="priceChange"
      color={changeColor}
      formatterOptions={{ showPlusMinusSigns }}
    >
      {record.priceChange24h ?? '-'}
    </NumberSizeableText>
  );
}

// Mobile right cell: price stacked over the 24h change (colored text, no badge).
function renderPopularTradingPriceWithChange(record: IFavoriteTokenDisplay) {
  return (
    <YStack alignItems="flex-end">
      <NumberSizeableText
        size="$bodyLgMedium"
        formatter="price"
        formatterOptions={{ currency: '$' }}
      >
        {record.price ?? '-'}
      </NumberSizeableText>
      {renderPopularTradingChangeText(record, '$bodyMd')}
    </YStack>
  );
}

// Desktop metric columns: price | 24h change | 24h volume. No stock-specific
// switching — every tab shows the same fields, consistent with the Market page.
function getPopularTradingDesktopMetricColumns(
  intl: IntlShape,
): NonNullable<ITableProps<IFavoriteTokenDisplay>['columns']> {
  return [
    {
      dataIndex: 'price',
      title: intl.formatMessage({ id: ETranslations.global_price }),
      render: (_: unknown, record: IFavoriteTokenDisplay) => (
        <NumberSizeableText
          size="$bodyLgMedium"
          formatter="price"
          formatterOptions={{ currency: '$' }}
        >
          {record.price ?? '-'}
        </NumberSizeableText>
      ),
    },
    {
      dataIndex: 'priceChange24h',
      title: intl.formatMessage({ id: ETranslations.market_change_24h }),
      render: (_: unknown, record: IFavoriteTokenDisplay) =>
        renderPopularTradingChangeText(record, '$bodyLgMedium'),
    },
    {
      dataIndex: 'volume24h',
      title: intl.formatMessage({ id: ETranslations.market_24h_turnover }),
      render: (_: unknown, record: IFavoriteTokenDisplay) => (
        <NumberSizeableText
          size="$bodyLgMedium"
          formatter="marketCap"
          formatterOptions={{ currency: '$' }}
        >
          {record.volume24h ? record.volume24h : EMPTY_MARKET_VALUE}
        </NumberSizeableText>
      ),
    },
  ];
}

// Full home market column set, shared by the favorites list (PopularTrading)
// and the category list (MarketCategoryTokenList). Callers only supply their
// own star-button renderer; everything else stays identical between the two.
function getPopularTradingColumns({
  intl,
  shouldUseTableLayout,
  renderStarButton,
}: {
  intl: IntlShape;
  shouldUseTableLayout: boolean;
  renderStarButton: (record: IFavoriteTokenDisplay) => ReactNode;
}): NonNullable<ITableProps<IFavoriteTokenDisplay>['columns']> {
  const nameColumn = {
    dataIndex: 'symbol',
    title: intl.formatMessage({ id: ETranslations.global_name }),
    columnProps: shouldUseTableLayout
      ? { minWidth: POPULAR_TRADING_NAME_COLUMN_MIN_WIDTH }
      : { flex: 1.35, flexBasis: 0, minWidth: 0 },
    render: (_: unknown, record: IFavoriteTokenDisplay) => (
      <XStack alignItems="center" gap="$2" minWidth={0} width="100%">
        {renderStarButton(record)}
        <Stack flex={1} minWidth={0}>
          {renderPopularTradingTokenIdentity(record, {
            showVolume: !shouldUseTableLayout,
          })}
        </Stack>
      </XStack>
    ),
  };

  if (shouldUseTableLayout) {
    return [nameColumn, ...getPopularTradingDesktopMetricColumns(intl)];
  }

  return [
    nameColumn,
    {
      dataIndex: 'price',
      title: intl.formatMessage({ id: ETranslations.global_price }),
      columnProps: { flex: 0.85, flexBasis: 0, minWidth: 0 },
      render: (_: unknown, record: IFavoriteTokenDisplay) =>
        renderPopularTradingPriceWithChange(record),
    },
  ];
}

export {
  getPopularTradingColumns,
  renderPopularTradingCommunityBadge,
  renderPopularTradingStockBadges,
};
