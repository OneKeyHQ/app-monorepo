import type { ReactElement } from 'react';
import { useEffect, useMemo } from 'react';

import { differenceInDays } from 'date-fns';

import type { INumberSizeableTextProps } from '@onekeyhq/components';
import {
  Icon,
  IconButton,
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IMarketDetailPool } from '@onekeyhq/shared/types/market';

import { MarketTokenAddress } from './MarketTokenAddress';

function PoolDetailsItem({
  title,
  children,
  currency,
  isNumeric = false,
  formatter = 'marketCap',
}: {
  title: string;
  rank?: number;
  currency?: boolean;
  children: ReactElement | string;
  isNumeric?: boolean;
  formatter?: INumberSizeableTextProps['formatter'];
}) {
  const renderChildren = useMemo(() => {
    if (isNumeric) {
      return (
        <NumberSizeableText
          size="$bodyMdMedium"
          formatter={formatter}
          formatterOptions={currency ? { currency: '$' } : undefined}
        >
          {children as string}
        </NumberSizeableText>
      );
    }
    return typeof children === 'string' ? (
      <SizableText size="$bodyMdMedium">{children}</SizableText>
    ) : (
      children
    );
  }, [children, currency, isNumeric]);
  return (
    <YStack
      pb="$3"
      flexBasis={0}
      flexGrow={1}
      space="$0.5"
      borderColor="$borderSubdued"
      borderBottomWidth="$px"
    >
      <SizableText color="$textSubdued" size="$bodySm">
        {title}
      </SizableText>
      {renderChildren}
    </YStack>
  );
}

export function PoolDetails({
  item: {
    attributes,
    id: pairAddress,
    baseTokenUrl,
    quoteTokenUrl,
    relationships: {
      base_token: baseToken,
      quote_token: quoteToken,
      dex: {
        data: { id },
      },
    },
  },
}: {
  item: IMarketDetailPool;
}) {
  const [baseTokenName, quoteTokenName] = attributes.name.split('/');
  return (
    <YStack space="$3">
      <XStack space="$4">
        <PoolDetailsItem title="Pair">{attributes.name}</PoolDetailsItem>
        <PoolDetailsItem title="DEX">
          <XStack space="$1.5">
            <Icon size={5} name="TelegramBrand" />
            <SizableText size="$bodyMdMedium">{id}</SizableText>
          </XStack>
        </PoolDetailsItem>
      </XStack>
      <XStack space="$4">
        <PoolDetailsItem title="Price" currency isNumeric formatter="price">
          {attributes.base_token_price_usd}
        </PoolDetailsItem>
        <PoolDetailsItem title="24H Txns" isNumeric>
          {String(
            attributes.transactions.h24.buys +
              attributes.transactions.h24.sells,
          )}
        </PoolDetailsItem>
      </XStack>
      <XStack space="$4">
        <PoolDetailsItem title="24H Volume" isNumeric>
          {attributes.volume_usd.h24}
        </PoolDetailsItem>
        <PoolDetailsItem title="Liquidity" isNumeric>
          {attributes.reserve_in_usd}
        </PoolDetailsItem>
      </XStack>
      <XStack space="$4">
        <PoolDetailsItem title="FDV" isNumeric>
          {attributes.fdv_usd}
        </PoolDetailsItem>
        <PoolDetailsItem title="Age">
          {`${differenceInDays(
            new Date(),
            new Date(attributes.pool_created_at),
          )} days`}
        </PoolDetailsItem>
      </XStack>
      <YStack space="$6" pt="$6" pb="$10">
        <MarketTokenAddress
          tokenName={baseTokenName.trim()}
          address={baseToken.data.id.split('_').pop() as string}
          url={baseTokenUrl}
        />
        <MarketTokenAddress
          tokenName={quoteTokenName.trim()}
          address={quoteToken.data.id.split('_').pop() as string}
          url={quoteTokenUrl}
        />
        <MarketTokenAddress
          tokenName="Pair Contract"
          address={pairAddress.split('_').pop() as string}
          url={baseTokenUrl}
        />
      </YStack>
    </YStack>
  );
}
