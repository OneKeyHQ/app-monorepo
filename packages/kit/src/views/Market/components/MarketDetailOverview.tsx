import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import type {
  INumberSizeableTextProps,
  ITabPageProps,
} from '@onekeyhq/components';
import {
  NestedScrollView,
  NumberSizeableText,
  Popover,
  Progress,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatLocaleDate } from '@onekeyhq/shared/src/utils/dateUtils';
import type {
  IMarketDetailAthOrAtl,
  IMarketDetailPlatform,
  IMarketTokenDetail,
} from '@onekeyhq/shared/types/market';

import { MarketAbout } from './MarketAbout';
import { MarketDetailOverviewContract } from './MarketDetailOverviewContract';
import { useTokenPrice } from './MarketTokenPrice';
import { PriceChangePercentage } from './PriceChangePercentage';

function OverviewPriceChange({
  title,
  children,
}: {
  title: string;
  children: INumberSizeableTextProps['children'];
}) {
  return (
    <YStack alignItems="center" flexBasis={0} flexGrow={1}>
      <SizableText color="$textSubdued" size="$bodySm">
        {title}
      </SizableText>
      <PriceChangePercentage
        size="$bodyMdMedium"
        width="100%"
        textAlign="center"
      >
        {children}
      </PriceChangePercentage>
    </YStack>
  );
}

export function Overview24PriceChange({
  name,
  symbol,
  currentPrice,
  low,
  high,
  lastUpdated,
}: {
  name: string;
  symbol: string;
  currentPrice: string;
  low: number;
  high: number;
  lastUpdated: string;
}) {
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();
  const currency = settings.currencyInfo.symbol;
  const price = useTokenPrice({
    name,
    symbol,
    price: currentPrice,
    lastUpdated: new Date(lastUpdated).getTime(),
  });
  const lowPrice = Math.min(Number(low), Number(price));
  const highPrice = Math.max(Number(high), Number(price));
  const priceChange = useMemo(() => {
    const priceBN = new BigNumber(price);
    if (priceBN.isNaN()) {
      return undefined;
    }
    const lowBN = new BigNumber(lowPrice);
    const highBN = new BigNumber(highPrice);
    return Number(
      priceBN.minus(lowBN).div(highBN.minus(lowBN)).shiftedBy(2).toFixed(2),
    );
  }, [price, lowPrice, highPrice]);
  return (
    <YStack gap="$2.5">
      <SizableText size="$bodyMd" color="$textSubdued">
        {intl.formatMessage({ id: ETranslations.market_24h_price_range })}
      </SizableText>
      {priceChange !== undefined ? (
        <Progress value={priceChange} height="$1" />
      ) : null}
      <XStack jc="space-between">
        <XStack gap="$1">
          <SizableText color="$textSubdued" size="$bodyMd">
            {intl.formatMessage({ id: ETranslations.market_low })}
          </SizableText>
          <NumberSizeableText
            size="$bodyMdMedium"
            formatter="price"
            formatterOptions={{ currency }}
          >
            {lowPrice}
          </NumberSizeableText>
        </XStack>
        <XStack gap="$1">
          <SizableText color="$textSubdued" size="$bodyMd">
            {intl.formatMessage({ id: ETranslations.market_high })}
          </SizableText>
          <NumberSizeableText
            size="$bodyMdMedium"
            formatter="price"
            formatterOptions={{ currency }}
          >
            {highPrice}
          </NumberSizeableText>
        </XStack>
      </XStack>
    </YStack>
  );
}

function OverviewMarketVOLItem({
  title,
  rank,
  children,
  currency,
  tooltip,
}: {
  title: string;
  rank?: number;
  currency?: boolean;
  tooltip?: string;
  children: INumberSizeableTextProps['children'];
}) {
  const [settings] = useSettingsPersistAtom();
  return (
    <YStack
      pb="$3"
      flexBasis={0}
      flexGrow={1}
      borderColor="$borderSubdued"
      borderBottomWidth="$px"
    >
      <SizableText color="$textSubdued" size="$bodySm">
        {title}
      </SizableText>
      <XStack gap="$1" ai="center" pt="$0.5">
        <NumberSizeableText
          size="$bodyMdMedium"
          formatter="marketCap"
          formatterOptions={
            currency ? { currency: settings.currencyInfo.symbol } : undefined
          }
        >
          {children}
        </NumberSizeableText>
        {rank ? (
          <SizableText
            size="$bodySm"
            bg="$bgStrong"
            color="$textSubdued"
            borderRadius="$1"
            px="$1"
          >
            {`#${rank}`}
          </SizableText>
        ) : null}
        {tooltip ? <Popover.Tooltip title={title} tooltip={tooltip} /> : null}
      </XStack>
    </YStack>
  );
}

function OverviewMarketVOL({
  symbol,
  currentPrice,
  fdv,
  volume24h,
  marketCap,
  marketCapRank,
  maxSupply,
  totalSupply,
  circulatingSupply,
  detailPlatforms,
  atl,
  ath,
}: {
  currentPrice: string;
  symbol: string;
  fdv: number;
  volume24h: number;
  marketCap: number;
  marketCapRank: number;
  maxSupply: number;
  totalSupply: number;
  circulatingSupply: number;
  atl: IMarketDetailAthOrAtl;
  ath: IMarketDetailAthOrAtl;
  detailPlatforms: IMarketDetailPlatform;
}) {
  const intl = useIntl();
  const athPercent = useMemo(
    () =>
      BigNumber(ath.value)
        .minus(currentPrice)
        .dividedBy(ath.value)
        .multipliedBy(100)
        .toFixed(4),
    [ath.value, currentPrice],
  );
  const atlPercent = useMemo(
    () =>
      BigNumber(currentPrice)
        .minus(atl.value)
        .dividedBy(atl.value)
        .multipliedBy(100)
        .toFixed(4),
    [atl.value, currentPrice],
  );
  const upperCaseSymbol = useMemo(() => symbol.toUpperCase(), [symbol]);
  return (
    <YStack pt="$10">
      <YStack gap="$3">
        <XStack gap="$4">
          <OverviewMarketVOLItem
            currency
            title={intl.formatMessage({ id: ETranslations.market_24h_vol_usd })}
          >
            {volume24h || '-'}
          </OverviewMarketVOLItem>
          <OverviewMarketVOLItem
            currency
            title={intl.formatMessage({ id: ETranslations.global_market_cap })}
            rank={marketCapRank}
          >
            {marketCap || '-'}
          </OverviewMarketVOLItem>
        </XStack>
        <XStack gap="$4">
          <OverviewMarketVOLItem
            currency
            title={intl.formatMessage({ id: ETranslations.global_fdv })}
          >
            {fdv || '-'}
          </OverviewMarketVOLItem>
          <OverviewMarketVOLItem
            title={intl.formatMessage({
              id: ETranslations.global_circulating_supply,
            })}
          >
            {circulatingSupply || '-'}
          </OverviewMarketVOLItem>
        </XStack>
        <XStack gap="$4">
          <OverviewMarketVOLItem
            title={intl.formatMessage({
              id: ETranslations.global_total_supply,
            })}
          >
            {totalSupply || '-'}
          </OverviewMarketVOLItem>
          <OverviewMarketVOLItem
            title={intl.formatMessage({
              id: ETranslations.global_max_supply,
            })}
          >
            {maxSupply || '∞'}
          </OverviewMarketVOLItem>
        </XStack>
        <XStack gap="$4">
          <OverviewMarketVOLItem
            title={intl.formatMessage({
              id: ETranslations.market_all_time_high,
            })}
            currency
            tooltip={intl.formatMessage(
              { id: ETranslations.market_ath_desc },
              {
                token: upperCaseSymbol,
                time: formatLocaleDate(new Date(ath.time)),
                price: (
                  <NumberSizeableText
                    formatter="price"
                    formatterOptions={{ currency: '$' }}
                  >
                    {ath.value}
                  </NumberSizeableText>
                ) as unknown as string,
                percent: (
                  <NumberSizeableText formatter="priceChange">
                    {athPercent}
                  </NumberSizeableText>
                ) as unknown as string,
              },
            )}
          >
            {ath.value}
          </OverviewMarketVOLItem>
          <OverviewMarketVOLItem
            title={intl.formatMessage({
              id: ETranslations.market_all_time_low,
            })}
            currency
            tooltip={intl.formatMessage(
              { id: ETranslations.market_atl_desc },
              {
                token: upperCaseSymbol,
                time: formatLocaleDate(new Date(atl.time)),
                price: (
                  <NumberSizeableText
                    formatter="price"
                    formatterOptions={{ currency: '$' }}
                  >
                    {atl.value}
                  </NumberSizeableText>
                ) as unknown as string,
                percent: (
                  <NumberSizeableText formatter="priceChange">
                    {atlPercent}
                  </NumberSizeableText>
                ) as unknown as string,
              },
            )}
          >
            {atl.value}
          </OverviewMarketVOLItem>
        </XStack>
      </YStack>
      <MarketDetailOverviewContract detailPlatforms={detailPlatforms} />
    </YStack>
  );
}

export function MarketDetailOverview({
  token: {
    name,
    symbol,
    detailPlatforms,
    stats: {
      atl,
      ath,
      maxSupply,
      totalSupply,
      circulatingSupply,
      currentPrice,
      lastUpdated,
      performance,
      volume24h,
      marketCap,
      marketCapRank,
      fdv,
      low24h,
      high24h,
    },
    about,
  },
}: ITabPageProps & {
  token: IMarketTokenDetail;
}) {
  const intl = useIntl();
  return (
    <NestedScrollView>
      <YStack pb="$10" $md={{ px: '$5' }}>
        <XStack
          borderWidth="$px"
          borderRadius="$2"
          borderColor="$borderSubdued"
          py="$3"
          my="$6"
        >
          <OverviewPriceChange
            title={intl.formatMessage({ id: ETranslations.market_1d })}
          >
            {performance.priceChangePercentage24h}
          </OverviewPriceChange>
          <OverviewPriceChange
            title={intl.formatMessage({ id: ETranslations.market_1w })}
          >
            {performance.priceChangePercentage7d}
          </OverviewPriceChange>
          <OverviewPriceChange
            title={intl.formatMessage({ id: ETranslations.market_1m })}
          >
            {performance.priceChangePercentage30d}
          </OverviewPriceChange>
          <OverviewPriceChange
            title={intl.formatMessage({ id: ETranslations.market_1y })}
          >
            {performance.priceChangePercentage1y}
          </OverviewPriceChange>
        </XStack>
        <Overview24PriceChange
          name={name}
          symbol={symbol}
          currentPrice={currentPrice}
          low={low24h}
          high={high24h}
          lastUpdated={lastUpdated}
        />
        <OverviewMarketVOL
          symbol={symbol}
          volume24h={volume24h}
          currentPrice={currentPrice}
          fdv={fdv}
          marketCap={marketCap}
          ath={ath}
          atl={atl}
          marketCapRank={marketCapRank}
          maxSupply={maxSupply}
          totalSupply={totalSupply}
          circulatingSupply={circulatingSupply}
          detailPlatforms={detailPlatforms}
        />
        {/* <GoPlus /> */}
        <MarketAbout>{about}</MarketAbout>
      </YStack>
    </NestedScrollView>
  );
}
