import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Button, XStack } from '@onekeyhq/components';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { isSupportStaking } from '@onekeyhq/shared/types/earn/earnProvider.constants';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { ReviewControl } from '../../../components/ReviewControl';

import { useLazyMarketTradeActions } from './tradeHook';

export function MarketListTradeButton({
  coinGeckoId,
  symbol,
  isSupportBuy,
  wallet,
}: {
  coinGeckoId: string;
  symbol: string;
  isSupportBuy: boolean;
  wallet: IDBWallet | undefined;
}) {
  const intl = useIntl();
  const actions = useLazyMarketTradeActions(coinGeckoId);
  const canStaking = useMemo(() => isSupportStaking(symbol), [symbol]);
  const onSwap = useCallback(() => {
    defaultLogger.market.token.marketTokenAction({
      tokenName: coinGeckoId,
      action: 'trade',
      from: 'listPage',
    });
    void actions.onSwapLazyModal();
  }, [actions, coinGeckoId]);

  const onBuy = useCallback(async () => {
    if (
      await backgroundApiProxy.serviceAccount.checkIsWalletNotBackedUp({
        walletId: wallet?.id ?? '',
      })
    ) {
      return;
    }
    defaultLogger.market.token.marketTokenAction({
      tokenName: coinGeckoId,
      action: 'buy',
      from: 'listPage',
    });
    actions.onBuy();
  }, [actions, coinGeckoId, wallet?.id]);

  const onStaking = useCallback(() => {
    defaultLogger.market.token.marketTokenAction({
      tokenName: coinGeckoId,
      action: 'stake',
      from: 'listPage',
    });
    actions.onStaking();
  }, [actions, coinGeckoId]);

  return (
    <XStack gap="$1.5">
      <Button variant="secondary" size="small" onPress={onSwap}>
        {intl.formatMessage({ id: ETranslations.global_trade })}
      </Button>
      {isSupportBuy ? (
        <ReviewControl>
          <Button variant="secondary" size="small" onPress={onBuy}>
            {intl.formatMessage({ id: ETranslations.global_buy })}
          </Button>
        </ReviewControl>
      ) : null}
      {canStaking ? (
        <Button variant="secondary" size="small" onPress={onStaking}>
          {intl.formatMessage({ id: ETranslations.global_earn })}
        </Button>
      ) : null}
    </XStack>
  );
}
