import { useEffect, useState } from 'react';

import type {
  INumberSizeableTextProps,
  ISizableTextProps,
} from '@onekeyhq/components';
import {
  Button,
  NumberSizeableText,
  Progress,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type {
  IMarketDetailPool,
  IMarketTokenDetail,
} from '@onekeyhq/shared/types/market';

import { MarketTokenAddress } from './MarketTokenAddress';

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
      <NumberSizeableText
        size="$bodyMdMedium"
        formatter="priceChange"
        formatterOptions={{ showPlusMinusSigns: true }}
        color={Number(children) > 0 ? '$textCritical' : '$textSuccess'}
      >
        {children}
      </NumberSizeableText>
    </YStack>
  );
}

export function Overview24PriceChange({
  low,
  high,
}: {
  low: number;
  high: number;
}) {
  return (
    <YStack space="$2.5">
      <SizableText size="$bodyMd" color="$textSubdued">
        24H price range
      </SizableText>
      <Progress value={(low / high) * 100} height="$1" />
      <XStack jc="space-between">
        <XStack space="$1">
          <SizableText color="$textSubdued" size="$bodyMd">
            Low
          </SizableText>
          <NumberSizeableText
            size="$bodyMdMedium"
            formatter="price"
            formatterOptions={{ currency: '$' }}
          >
            {low}
          </NumberSizeableText>
        </XStack>
        <XStack space="$1">
          <SizableText color="$textSubdued" size="$bodyMd">
            High
          </SizableText>
          <NumberSizeableText
            size="$bodyMdMedium"
            formatter="price"
            formatterOptions={{ currency: '$' }}
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
      <XStack space="$1" ai="center" pt="$0.5" pb="$3">
        <NumberSizeableText
          size="$bodyMdMedium"
          formatter="marketCap"
          formatterOptions={currency ? { currency: '$' } : undefined}
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
  pools,
}: {
  fdv: number;
  volume24h: number;
  marketCap: number;
  marketCapRank: number;
  maxSupply: number;
  totalSupply: number;
  circulatingSupply: number;
  pools: IMarketDetailPool[];
}) {
  return (
    <YStack py="$10">
      <YStack space="$3">
        <XStack space="$4">
          <OverviewMarketVOLItem currency title="24H VOL(USD)">
            {volume24h}
          </OverviewMarketVOLItem>
          <OverviewMarketVOLItem
            currency
            title="Market Cap"
            rank={marketCapRank}
          >
            {marketCap}
          </OverviewMarketVOLItem>
        </XStack>
        <XStack space="$4">
          <OverviewMarketVOLItem currency title="FDV">
            {fdv}
          </OverviewMarketVOLItem>
          <OverviewMarketVOLItem
            title="Circulating Supply"
            rank={marketCapRank}
          >
            {circulatingSupply}
          </OverviewMarketVOLItem>
        </XStack>
        <XStack space="$4">
          <OverviewMarketVOLItem title="Total Supply">
            {totalSupply}
          </OverviewMarketVOLItem>
          <OverviewMarketVOLItem title="Max Supply">
            {maxSupply}
          </OverviewMarketVOLItem>
        </XStack>
      </YStack>
      <YStack pt="$3">
        <SizableText color="$textSubdued" size="$bodySm">
          Contract
        </SizableText>
        <YStack space="$1" pt="$1">
          {pools.map((pool) => {
            const [tokeName, address] =
              pool.relationships.base_token.data.id.split('_');
            return (
              <MarketTokenAddress
                key={address}
                networkId={pool.onekeyNetworkId}
                tokenName={tokeName}
                address={address}
                url={pool.baseTokenUrl}
              />
            );
          })}
        </YStack>
      </YStack>
    </YStack>
  );
}

// function GoPlus() {
//   return (
//     <XStack jc="space-between" ai="center">
//       <YStack space="$1">
//         <SizableText size="$headingMd">GoPlus</SizableText>
//         <SizableText size="$bodyMd" color="$textSubdued">
//           No risk detected
//         </SizableText>
//       </YStack>
//       <Button h={38}>View</Button>
//     </XStack>
//   );
// }

function About({ children }: { children: ISizableTextProps['children'] }) {
  return (
    <YStack space="$3" pt="$10">
      <SizableText size="$headingSm">About</SizableText>
      <SizableText size="$bodyMd" color="$textSubdued">
        {children}
      </SizableText>
    </YStack>
  );
}

export function MarketDetailOverview({
  token: {
    stats: {
      maxSupply,
      totalSupply,
      circulatingSupply,
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
  pools,
}: {
  token: IMarketTokenDetail;
  pools: IMarketDetailPool[];
}) {
  return (
    <YStack>
      <XStack
        borderWidth="$px"
        borderRadius="$2"
        borderColor="$borderSubdued"
        py="$3"
        my="$6"
      >
        <OverviewPriceChange title="1H">
          {performance.priceChangePercentage1h}
        </OverviewPriceChange>
        <OverviewPriceChange title="24H">
          {performance.priceChangePercentage24h}
        </OverviewPriceChange>
        <OverviewPriceChange title="7D">
          {performance.priceChangePercentage7d}
        </OverviewPriceChange>
        <OverviewPriceChange title="30D">
          {performance.priceChangePercentage30d}
        </OverviewPriceChange>
      </XStack>
      <Overview24PriceChange low={low24h} high={high24h} />
      <OverviewMarketVOL
        volume24h={volume24h}
        fdv={fdv}
        marketCap={marketCap}
        marketCapRank={marketCapRank}
        maxSupply={maxSupply}
        totalSupply={totalSupply}
        circulatingSupply={circulatingSupply}
        pools={pools}
      />
      {/* <GoPlus /> */}
      <About>{about}</About>
    </YStack>
  );
}
