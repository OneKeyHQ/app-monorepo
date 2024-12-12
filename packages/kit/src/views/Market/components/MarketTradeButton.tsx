import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IActionListItemProps } from '@onekeyhq/components';
import { ActionList, Button, IconButton, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/market';
import { getImportFromToken } from '@onekeyhq/shared/types/market/marketProvider.constants';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { ReviewControl } from '../../../components/ReviewControl';

import {
  useMarketTradeActions,
  useMarketTradeNetwork,
  useMarketTradeNetworkId,
} from './tradeHook';

export function MarketTradeButton({
  token,
}: {
  coinGeckoId: string;
  token: IMarketTokenDetail;
}) {
  const intl = useIntl();

  const { onSwap, onStaking, onBuy, onSell, canStaking } =
    useMarketTradeActions(token);
  const network = useMarketTradeNetwork(token);
  const networkId = useMarketTradeNetworkId(network, token.symbol);
  const [disabled, setDisabled] = useState({
    trade: true,
    buy: true,
    sell: true,
  });
  const sections = useMemo(
    () => [
      {
        items: [
          {
            icon: 'MinusLargeSolid',
            label: intl.formatMessage({ id: ETranslations.global_sell }),
            onPress: onSell,
            disabled: disabled.sell,
          },
        ] as IActionListItemProps[],
      },
    ],
    [disabled.sell, intl, onSell],
  );

  const checkDisabled = useCallback(async () => {
    if (networkId) {
      const { isNative, realContractAddress = '' } =
        getImportFromToken({
          networkId,
          tokenSymbol: token.symbol,
          contractAddress: network?.contract_address || '',
        }) || {};
      const contractAddress = isNative ? '' : network?.contract_address || '';

      const [swapResult, buyResult, sellResult] = await Promise.all([
        backgroundApiProxy.serviceSwap.checkSupportSwap({
          networkId,
          contractAddress: isNative ? realContractAddress : contractAddress,
        }),
        backgroundApiProxy.serviceFiatCrypto.isTokenSupported({
          networkId,
          tokenAddress: contractAddress,
          type: 'buy',
        }),
        backgroundApiProxy.serviceFiatCrypto.isTokenSupported({
          networkId,
          tokenAddress: contractAddress,
          type: 'sell',
        }),
      ]);
      setDisabled({
        trade: !swapResult.isSupportCrossChain && !swapResult.isSupportSwap,
        buy: !buyResult,
        sell: !sellResult,
      });
    }
  }, [network, networkId, token.symbol]);

  useEffect(() => {
    void checkDisabled();
  }, [checkDisabled]);

  const handleSwap = useCallback(() => {
    void onSwap();
  }, [onSwap]);

  return (
    <XStack $gtMd={{ mt: '$6' }} ai="center" gap="$4">
      <XStack gap="$2.5" flex={1}>
        <Button
          flex={1}
          variant="primary"
          onPress={handleSwap}
          disabled={disabled.trade}
        >
          {intl.formatMessage({ id: ETranslations.global_trade })}
        </Button>
        {canStaking ? (
          <Button flex={1} variant="secondary" onPress={onStaking}>
            {intl.formatMessage({ id: ETranslations.earn_stake })}
          </Button>
        ) : null}
        <ReviewControl>
          <Button
            flex={1}
            variant="secondary"
            onPress={onBuy}
            disabled={disabled.buy}
          >
            {intl.formatMessage({ id: ETranslations.global_buy })}
          </Button>
        </ReviewControl>
      </XStack>
      <ReviewControl>
        <ActionList
          title={token.symbol.toUpperCase() || ''}
          renderTrigger={
            <IconButton
              title={intl.formatMessage({ id: ETranslations.global_more })}
              icon="DotVerSolid"
              variant="tertiary"
              iconSize="$5"
            />
          }
          sections={sections}
        />
      </ReviewControl>
    </XStack>
  );
}
