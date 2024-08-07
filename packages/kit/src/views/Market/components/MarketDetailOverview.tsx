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
  Progress,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IMarketDetailPlatform,
  IMarketTokenDetail,
} from '@onekeyhq/shared/types/market';

import { MarketAbout } from './MarketAbout';
import { MarketDetailOverviewContract } from './MarketDetailOverviewContract';
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
      <PriceChangePercentage size="$bodyMdMedium">
        {children}
      </PriceChangePercentage>
    </YStack>
  );
}

export function Overview24PriceChange({
  currentPrice,
  low,
  high,
}: {
  currentPrice: string;
  low: number;
  high: number;
}) {
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();
  const currency = settings.currencyInfo.symbol;
  const priceChange = useMemo(() => {
    const lowBN = new BigNumber(low);
    const highBN = new BigNumber(high);
    const priceBN = new BigNumber(currentPrice);
    return priceBN
      .minus(lowBN)
      .div(highBN.minus(lowBN))
      .shiftedBy(2)
      .toNumber();
  }, [currentPrice, high, low]);
  return (
    <YStack gap="$2.5">
      <SizableText size="$bodyMd" color="$textSubdued">
        {intl.formatMessage({ id: ETranslations.market_24h_price_range })}
      </SizableText>
      <Progress value={priceChange} height="$1" />
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
            {low}
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
            {high}
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
}: {
  title: string;
  rank?: number;
  currency?: boolean;
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
      </XStack>
    </YStack>
  );
}

function OverviewMarketVOL({
  fdv,
  volume24h,
  marketCap,
  marketCapRank,
  maxSupply,
  totalSupply,
  circulatingSupply,
  detailPlatforms,
}: {
  fdv: number;
  volume24h: number;
  marketCap: number;
  marketCapRank: number;
  maxSupply: number;
  totalSupply: number;
  circulatingSupply: number;
  detailPlatforms: IMarketDetailPlatform;
}) {
  const intl = useIntl();
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
      </YStack>
      <MarketDetailOverviewContract detailPlatforms={detailPlatforms} />
    </YStack>
  );
}

// function GoPlus() {
//   return (
//     <XStack jc="space-between" ai="center">
//       <YStack gap="$1">
//         <SizableText size="$headingMd">GoPlus</SizableText>
//         <SizableText size="$bodyMd" color="$textSubdued">
//           No risk detected
//         </SizableText>
//       </YStack>
//       <Button h={38}>View</Button>
//     </XStack>
//   );
// }

export function MarketDetailOverview({
  token: {
    detailPlatforms,
    stats: {
      maxSupply,
      totalSupply,
      circulatingSupply,
      currentPrice,
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
      <YStack pb="$10" px="$5">
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
          currentPrice={currentPrice}
          low={low24h}
          high={high24h}
        />
        <OverviewMarketVOL
          volume24h={volume24h}
          fdv={fdv}
          marketCap={marketCap}
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
