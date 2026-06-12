import { NumberSizeableText, SizableText, YStack } from '@onekeyhq/components';
import type { ITableProps } from '@onekeyhq/components';
import { CommunityRecognizedBadge } from '@onekeyhq/kit/src/views/Market/components/CommunityRecognizedBadge';
import {
  StockSourceLogo,
  SubtitleBadge,
} from '@onekeyhq/kit/src/views/Market/components/PerpsBadges';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { getTokenPriceChangeStyle } from '@onekeyhq/shared/src/utils/tokenUtils';

import { getMarketCapValue, getPeRatioValue, getVolume24hValue } from './utils';

import type { IFavoriteTokenDisplay } from './types';
import type { IntlShape } from 'react-intl';

const POPULAR_TRADING_NAME_COLUMN_MIN_WIDTH = 260;

function renderMarketCapColumnValue(
  record: IFavoriteTokenDisplay,
  useStockMetadataColumns: boolean,
) {
  return (
    <NumberSizeableText
      size="$bodyLgMedium"
      formatter={useStockMetadataColumns ? 'marketCap' : 'price'}
      formatterOptions={{
        currency: '$',
        ...(useStockMetadataColumns ? { capAtMaxT: true } : undefined),
      }}
    >
      {useStockMetadataColumns
        ? getMarketCapValue(record, useStockMetadataColumns)
        : (record.price ?? '-')}
    </NumberSizeableText>
  );
}

function renderVolumeOrChangeColumnValue(
  record: IFavoriteTokenDisplay,
  useStockMetadataColumns: boolean,
) {
  if (useStockMetadataColumns) {
    return (
      <NumberSizeableText
        size="$bodyLgMedium"
        formatter="marketCap"
        formatterOptions={{
          currency: '$',
        }}
      >
        {getVolume24hValue(record, useStockMetadataColumns)}
      </NumberSizeableText>
    );
  }

  const { changeColor, showPlusMinusSigns } = getTokenPriceChangeStyle({
    priceChange: record.priceChange24h ?? 0,
  });
  return (
    <NumberSizeableText
      formatter="priceChange"
      formatterOptions={{ showPlusMinusSigns }}
      color={changeColor}
      size="$bodyLgMedium"
    >
      {record.priceChange24h ?? '-'}
    </NumberSizeableText>
  );
}

function renderPeOrVolumeColumnValue(
  record: IFavoriteTokenDisplay,
  useStockMetadataColumns: boolean,
) {
  return (
    <NumberSizeableText
      size="$bodyLgMedium"
      formatter={useStockMetadataColumns ? 'value' : 'marketCap'}
      formatterOptions={useStockMetadataColumns ? undefined : { currency: '$' }}
    >
      {useStockMetadataColumns
        ? getPeRatioValue(record)
        : getVolume24hValue(record, useStockMetadataColumns)}
    </NumberSizeableText>
  );
}

function getPopularTradingMetricColumns({
  intl,
  useStockMetadataColumns,
}: {
  intl: IntlShape;
  useStockMetadataColumns: boolean;
}): NonNullable<ITableProps<IFavoriteTokenDisplay>['columns']> {
  return [
    {
      dataIndex: useStockMetadataColumns ? 'marketCap' : 'price',
      title: useStockMetadataColumns
        ? intl.formatMessage({ id: ETranslations.global_market_cap })
        : intl.formatMessage({ id: ETranslations.global_price }),
      render: (_: unknown, record: IFavoriteTokenDisplay) =>
        renderMarketCapColumnValue(record, useStockMetadataColumns),
    },
    {
      dataIndex: useStockMetadataColumns ? 'volume24h' : 'priceChange24h',
      title: useStockMetadataColumns
        ? intl.formatMessage({
            id: ETranslations.dexmarket_stock_24h_volume,
          })
        : intl.formatMessage({ id: ETranslations.market_change_24h }),
      render: (_: unknown, record: IFavoriteTokenDisplay) =>
        renderVolumeOrChangeColumnValue(record, useStockMetadataColumns),
    },
    {
      dataIndex: useStockMetadataColumns ? 'stock' : 'volume24h',
      title: useStockMetadataColumns
        ? intl.formatMessage({
            id: ETranslations.dexmarket_stock_pe_ttm,
          })
        : intl.formatMessage({ id: ETranslations.market_24h_turnover }),
      render: (_: unknown, record: IFavoriteTokenDisplay) =>
        renderPeOrVolumeColumnValue(record, useStockMetadataColumns),
    },
  ];
}

function renderPopularTradingTokenSubtitle(record: IFavoriteTokenDisplay) {
  if (record.stock) {
    return (
      <SizableText
        size="$bodyMd"
        color="$textSubdued"
        numberOfLines={1}
        ellipsizeMode="tail"
        maxWidth={200}
      >
        {record.name}
      </SizableText>
    );
  }

  return (
    <NumberSizeableText
      size="$bodyMd"
      formatter="marketCap"
      formatterOptions={{
        currency: '$',
      }}
    >
      {getVolume24hValue(record)}
    </NumberSizeableText>
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

function renderPopularTradingRightMetrics(
  record: IFavoriteTokenDisplay,
  useStockMetadataColumns: boolean,
) {
  if (useStockMetadataColumns) {
    return (
      <YStack alignItems="flex-end">
        <NumberSizeableText
          size="$bodyLgMedium"
          formatter="marketCap"
          formatterOptions={{
            currency: '$',
          }}
        >
          {getVolume24hValue(record, useStockMetadataColumns)}
        </NumberSizeableText>
        <NumberSizeableText size="$bodyMd" formatter="value">
          {getPeRatioValue(record)}
        </NumberSizeableText>
      </YStack>
    );
  }

  const { changeColor, showPlusMinusSigns } = getTokenPriceChangeStyle({
    priceChange: record.priceChange24h ?? 0,
  });
  return (
    <YStack alignItems="flex-end">
      <NumberSizeableText
        size="$bodyLgMedium"
        formatter="price"
        formatterOptions={{
          currency: '$',
        }}
      >
        {record.price ?? '-'}
      </NumberSizeableText>
      <NumberSizeableText
        formatter="priceChange"
        formatterOptions={{ showPlusMinusSigns }}
        color={changeColor}
        size="$bodyMd"
      >
        {record.priceChange24h ?? '-'}
      </NumberSizeableText>
    </YStack>
  );
}

export {
  POPULAR_TRADING_NAME_COLUMN_MIN_WIDTH,
  getPopularTradingMetricColumns,
  renderPopularTradingCommunityBadge,
  renderPopularTradingRightMetrics,
  renderPopularTradingStockBadges,
  renderPopularTradingTokenSubtitle,
};
