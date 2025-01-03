import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IActionListItemProps } from '@onekeyhq/components';
import {
  ActionList,
  Button,
  IconButton,
  Skeleton,
  XStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/market';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { ReviewControl } from '../../../components/ReviewControl';
import { usePromiseResult } from '../../../hooks/usePromiseResult';

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

  const { tokenAddress: realContractAddress = '' } = network || {};

  const sections = useMemo(
    () => [
      {
        items: [
          {
            icon: 'MinusLargeSolid',
            label: intl.formatMessage({ id: ETranslations.global_sell }),
            onPress: onSell,
          },
        ] as IActionListItemProps[],
      },
    ],
    [intl, onSell],
  );

  const { result: show, isLoading } = usePromiseResult(
    async () => {
      if (networkId) {
        const contractAddress = realContractAddress;
        const [buyResult, sellResult] = await Promise.all([
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
        return {
          buy: !!buyResult,
          sell: !!sellResult,
        };
      }
      return {
        buy: false,
        sell: false,
      };
    },
    [networkId, realContractAddress],
    {
      watchLoading: true,
      initResult: {
        buy: false,
        sell: false,
      },
    },
  );

  const handleSwap = useCallback(() => {
    void onSwap();
  }, [onSwap]);

  return (
    <XStack $gtMd={{ mt: '$6' }} ai="center" gap="$4">
      {isLoading ? (
        <Skeleton width="100%" height={38} />
      ) : (
        <>
          <XStack gap="$2.5" flex={1}>
            <Button flex={1} variant="primary" onPress={handleSwap}>
              {intl.formatMessage({ id: ETranslations.global_trade })}
            </Button>
            {canStaking ? (
              <Button flex={1} variant="secondary" onPress={onStaking}>
                {intl.formatMessage({ id: ETranslations.earn_stake })}
              </Button>
            ) : null}
            {show.buy ? (
              <ReviewControl>
                <Button flex={1} variant="secondary" onPress={onBuy}>
                  {intl.formatMessage({ id: ETranslations.global_buy })}
                </Button>
              </ReviewControl>
            ) : null}
          </XStack>
          {show.sell ? (
            <ReviewControl>
              <ActionList
                title={token.symbol.toUpperCase() || ''}
                renderTrigger={
                  <IconButton
                    title={intl.formatMessage({
                      id: ETranslations.global_more,
                    })}
                    icon="DotVerSolid"
                    variant="tertiary"
                    iconSize="$5"
                  />
                }
                sections={sections}
              />
            </ReviewControl>
          ) : null}
        </>
      )}
    </XStack>
  );
}
