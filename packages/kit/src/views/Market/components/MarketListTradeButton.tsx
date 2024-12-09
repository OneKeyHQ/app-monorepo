import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Button, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { isSupportStaking } from '@onekeyhq/shared/types/earn/earnProvider.constants';

import { useLazyMarketTradeActions } from './tradeHook';

export function MarketListTradeButton({
  coinGeckoId,
  symbol,
}: {
  coinGeckoId: string;
  symbol: string;
}) {
  const intl = useIntl();

  const { onStaking, onSwap, onBuy, loadingIndicators } =
    useLazyMarketTradeActions(coinGeckoId);
  const canStaking = useMemo(() => isSupportStaking(symbol), [symbol]);
  return (
    <XStack gap="$1.5">
      <Button
        loading={loadingIndicators.onSwap}
        variant="secondary"
        size="small"
        onPress={onSwap}
      >
        {intl.formatMessage({ id: ETranslations.global_trade })}
      </Button>
      {canStaking ? (
        <Button
          loading={loadingIndicators.onStaking}
          variant="secondary"
          size="small"
          onPress={onStaking}
        >
          {intl.formatMessage({ id: ETranslations.earn_stake })}
        </Button>
      ) : null}
      <Button
        loading={loadingIndicators.onBuy}
        variant="secondary"
        size="small"
        onPress={onBuy}
      >
        {intl.formatMessage({ id: ETranslations.global_buy })}
      </Button>
    </XStack>
  );
}
