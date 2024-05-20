import type { ReactElement } from 'react';
import { useEffect, useMemo } from 'react';

import { differenceInDays } from 'date-fns';

import {
  Icon,
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { INumberSizeableTextProps } from '@onekeyhq/components';
import type {
  IMarketDetailPool,
  IMarketTokenDetail,
} from '@onekeyhq/shared/types/market';

function PoolDetailsItem({
  title,
  children,
  currency,
  isNumeric = false,
}: {
  title: string;
  rank?: number;
  currency?: boolean;
  children: ReactElement | string;
  isNumeric?: boolean;
}) {
  const renderChildren = useMemo(() => {
    if (isNumeric) {
      return (
        <NumberSizeableText
          size="$bodyMdMedium"
          formatter="marketCap"
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
    relationships: {
      dex: {
        data: { id },
      },
    },
  },
}: {
  item: IMarketDetailPool;
}) {
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
        <PoolDetailsItem title="Price" currency isNumeric>
          {attributes.base_token_price_usd}
        </PoolDetailsItem>
        <PoolDetailsItem title="24H Txns" currency isNumeric>
          {String(
            attributes.transactions.h24.buys +
              attributes.transactions.h24.sells,
          )}
        </PoolDetailsItem>
      </XStack>
      <XStack space="$4">
        <PoolDetailsItem title="24H Volume" currency isNumeric>
          {attributes.volume_usd.h24}
        </PoolDetailsItem>
        <PoolDetailsItem title="Liquidity" currency isNumeric>
          {attributes.reserve_in_usd}
        </PoolDetailsItem>
      </XStack>
      <XStack space="$4">
        <PoolDetailsItem title="FDV" currency isNumeric>
          {attributes.fdv_usd}
        </PoolDetailsItem>
        <PoolDetailsItem title="Age" currency isNumeric>
          {`${differenceInDays(
            new Date(),
            new Date(attributes.pool_created_at),
          )} days`}
        </PoolDetailsItem>
      </XStack>
    </YStack>
  );
}
