import { useIntl } from 'react-intl';

import {
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { MarketTokenPrice } from '@onekeyhq/kit/src/views/Market/components/MarketTokenPrice';
import { PriceChangePercentage } from '@onekeyhq/kit/src/views/Market/components/PriceChangePercentage';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/market/scenes/token';
import { clampPercentage } from '@onekeyhq/shared/src/utils/numberUtils';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';

import { MarketStarV2 } from '../../../components/MarketStarV2';

import { ShareButton } from './ShareButton';

interface IStatItemProps {
  label: string;
  value: React.ReactNode;
}

function StatItem({ label, value }: IStatItemProps) {
  return (
    <YStack gap="$1">
      <SizableText size="$bodySm" color="$textSubdued">
        {label}
      </SizableText>
      <SizableText size="$bodySmMedium" color="$text">
        {value}
      </SizableText>
    </YStack>
  );
}

interface ITokenDetailHeaderRightProps {
  tokenDetail?: IMarketTokenDetail;
  networkId?: string;
  showStats: boolean;
}

export function TokenDetailHeaderRight({
  tokenDetail,
  networkId,
  showStats,
}: ITokenDetailHeaderRightProps) {
  const intl = useIntl();
  const [settingsPersistAtom] = useSettingsPersistAtom();
  const {
    name = '',
    symbol = '',
    price: currentPrice = '--',
    priceChange24hPercent = '--',
    marketCap = '0',
    liquidity = '0',
    holders = 0,
    address = '',
  } = tokenDetail || {};

  const marketStar = networkId ? (
    <MarketStarV2
      chainId={networkId}
      contractAddress={address}
      size="medium"
      from={EWatchlistFrom.details}
    />
  ) : null;

  const shareButton = networkId ? (
    <ShareButton networkId={networkId} address={address} />
  ) : null;

  if (!showStats) {
    return (
      <XStack gap="$3" ai="center">
        {marketStar}
        {shareButton}
      </XStack>
    );
  }

  return (
    <XStack gap="$6" ai="center">
      {/* Price and Price Change */}
      <YStack ai="flex-end" jc="space-between" mt="$-0.5">
        <MarketTokenPrice
          size="$bodyLgMedium"
          price={currentPrice}
          tokenName={name}
          tokenSymbol={symbol}
        />
        <PriceChangePercentage size="$bodySm">
          {clampPercentage(priceChange24hPercent)}
        </PriceChangePercentage>
      </YStack>

      <StatItem
        label={intl.formatMessage({ id: ETranslations.dexmarket_market_cap })}
        value={
          <NumberSizeableText
            size="$bodySmMedium"
            color="$text"
            formatter="marketCap"
            formatterOptions={{
              capAtMaxT: true,
              currency: settingsPersistAtom.currencyInfo.symbol,
            }}
          >
            {marketCap === '0' ? '--' : marketCap}
          </NumberSizeableText>
        }
      />

      <StatItem
        label={intl.formatMessage({ id: ETranslations.dexmarket_liquidity })}
        value={
          <NumberSizeableText
            size="$bodySmMedium"
            color="$text"
            formatter="marketCap"
            formatterOptions={{
              currency: settingsPersistAtom.currencyInfo.symbol,
            }}
          >
            {liquidity === '0' ? '--' : liquidity}
          </NumberSizeableText>
        }
      />

      <StatItem
        label={intl.formatMessage({ id: ETranslations.dexmarket_holders })}
        value={
          <NumberSizeableText
            size="$bodySmMedium"
            color="$text"
            formatter="marketCap"
          >
            {holders === 0 ? '--' : holders}
          </NumberSizeableText>
        }
      />

      {marketStar}
      {shareButton}
    </XStack>
  );
}
