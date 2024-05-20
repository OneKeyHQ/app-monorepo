import type { ReactElement } from 'react';
import { useEffect, useMemo } from 'react';

import { differenceInDays } from 'date-fns';

import {
  Icon,
  IconButton,
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import type { INumberSizeableTextProps } from '@onekeyhq/components';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
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

function TokenAddress({
  tokenName,
  address,
}: {
  tokenName: string;
  address: string;
}) {
  const { copyText } = useClipboard();
  return (
    <XStack space="$1.5" ai="center">
      <XStack space="$2">
        <SizableText size="$bodyMdMedium">{`${tokenName}:`}</SizableText>
        <SizableText size="$bodyMd">{`${address.slice(0, 6)}...${address.slice(
          address.length - 4,
          address.length,
        )}`}</SizableText>
      </XStack>
      <IconButton
        variant="tertiary"
        color="$iconSubdued"
        icon="Copy1Outline"
        size="small"
        onPress={() => copyText(address)}
      />
      <IconButton
        variant="tertiary"
        color="$iconSubdued"
        icon="OpenOutline"
        size="small"
        onPress={() => openUrlExternal(address)}
      />
    </XStack>
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
      <YStack space="$6" pt="$6" pb="$10">
        <TokenAddress tokenName="WETH" address="0x12340x12341234" />
        <TokenAddress tokenName="USDT" address="0x12340x12341234" />
        <TokenAddress tokenName="Pair Contract" address="0x12340x12341234" />
      </YStack>
    </YStack>
  );
}
