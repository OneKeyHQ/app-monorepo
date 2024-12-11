import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Button, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { isSupportStaking } from '@onekeyhq/shared/types/earn/earnProvider.constants';

import { ReviewControl } from '../../../components/ReviewControl';

import { useLazyMarketTradeActions } from './tradeHook';

export function MarketListTradeButton({
  coinGeckoId,
  symbol,
}: {
  coinGeckoId: string;
  symbol: string;
}) {
  const intl = useIntl();

  const { onStaking, onSwapLazyModal, onBuy } =
    useLazyMarketTradeActions(coinGeckoId);
  const canStaking = useMemo(() => isSupportStaking(symbol), [symbol]);
  return (
    <XStack gap="$1.5">
      <Button variant="secondary" size="small" onPress={onSwapLazyModal}>
        {intl.formatMessage({ id: ETranslations.global_trade })}
      </Button>
      <ReviewControl>
        <Button variant="secondary" size="small" onPress={onBuy}>
          {intl.formatMessage({ id: ETranslations.global_buy })}
        </Button>
      </ReviewControl>
      {canStaking ? (
        <Button variant="secondary" size="small" onPress={onStaking}>
          {intl.formatMessage({ id: ETranslations.earn_stake })}
        </Button>
      ) : null}
    </XStack>
  );
}
