import { memo } from 'react';

import {
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
import type { IMarketAccountPortfolioDisplayItem } from '@onekeyhq/shared/types/marketV2';

import { PnlCell } from '../components/PnlCell';

import { PORTFOLIO_TOKEN_COLUMN_WIDTH } from './portfolioColumnConstants';

interface IPortfolioItemNormalProps {
  item: IMarketAccountPortfolioDisplayItem;
  tokenLogoUrl?: string;
}

function PortfolioItemNormalBase({
  item,
  tokenLogoUrl,
}: IPortfolioItemNormalProps) {
  const pnl = item.pnl;
  const isPnlSupported = pnl?.isPnlSupported ?? false;

  return (
    <XStack
      flex={1}
      gap="$6"
      alignItems="center"
      mx="$2"
      px="$3"
      py="$2.5"
      borderRadius="$3"
      cursor="default"
      hoverStyle={{ backgroundColor: '$bgHover' }}
    >
      <XStack gap="$2.5" alignItems="center" w={PORTFOLIO_TOKEN_COLUMN_WIDTH}>
        <Token
          size="md"
          tokenImageUri={item.tokenLogoUrl ?? tokenLogoUrl}
          networkImageUri={item.networkLogoUrl}
          networkId={item.networkId}
          showNetworkIcon={Boolean(item.networkId)}
        />
        <SizableText size="$bodyLgMedium" color="$text" numberOfLines={1}>
          {item.symbol}
        </SizableText>
      </XStack>

      <YStack
        flex={1}
        flexBasis={0}
        minWidth={0}
        gap="$0.5"
        alignItems="flex-end"
      >
        <Currency
          size="$bodyMd"
          color="$text"
          autoFormatter="price-marketCap"
          autoFormatterThreshold={1000}
          sourceCurrency={USD_CURRENCY_ID}
        >
          {item.totalPrice}
        </Currency>
        <NumberSizeableText
          size="$bodySm"
          color="$textSubdued"
          autoFormatter="price-marketCap"
          autoFormatterThreshold={1000}
        >
          {item.amount}
        </NumberSizeableText>
      </YStack>

      <PnlCell
        usdValue={pnl?.unrealizedPnlUsd ?? '0'}
        percent={pnl?.unrealizedPnlPercent ?? '0'}
        isSupported={isPnlSupported}
        flex={1}
        emphasizedText
      />

      <PnlCell
        usdValue={pnl?.totalPnlUsd ?? '0'}
        percent={pnl?.totalPnlPercent ?? '0'}
        isSupported={isPnlSupported}
        flex={1}
        emphasizedText
      />
    </XStack>
  );
}

const PortfolioItemNormal = memo(PortfolioItemNormalBase);

export { PortfolioItemNormal };
