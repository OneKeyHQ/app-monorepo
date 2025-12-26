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
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
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
  coinGeckoId,
  token,
  accountId,
}: {
  coinGeckoId: string;
  token: IMarketTokenDetail;
  accountId: string;
}) {
  const intl = useIntl();

  const { onSwap, onStaking, onBuy, onSell, canStaking } =
    useMarketTradeActions(token);
  const network = useMarketTradeNetwork(token);
  const networkId = useMarketTradeNetworkId(network, token.symbol);

  const { tokenAddress: realContractAddress = '' } = network || {};

  const walletId = accountUtils.getWalletIdFromAccountId({
    accountId,
  });

  const actionDisabled = !accountId;

  const sections = useMemo(
    () => [
      {
        items: [
          {
            icon: 'MinusLargeSolid',
            label: intl.formatMessage({ id: ETranslations.global_sell }),
            onPress: async () => {
              if (
                await backgroundApiProxy.serviceAccount.checkIsWalletNotBackedUp(
                  {
                    walletId,
                  },
                )
              ) {
                return;
              }
              defaultLogger.market.token.marketTokenAction({
                tokenName: coinGeckoId,
                action: 'sell',
                from: 'detailsPage',
              });
              onSell();
            },
          },
        ] as IActionListItemProps[],
      },
    ],
    [coinGeckoId, intl, onSell, walletId],
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
    defaultLogger.market.token.marketTokenAction({
      tokenName: coinGeckoId,
      action: 'trade',
      from: 'detailsPage',
    });
    void onSwap();
  }, [coinGeckoId, onSwap]);

  const handleStaking = useCallback(() => {
    defaultLogger.market.token.marketTokenAction({
      tokenName: coinGeckoId,
      action: 'stake',
      from: 'detailsPage',
    });
    void onStaking();
  }, [coinGeckoId, onStaking]);

  const handleBuy = useCallback(async () => {
    if (
      await backgroundApiProxy.serviceAccount.checkIsWalletNotBackedUp({
        walletId,
      })
    ) {
      return;
    }
    defaultLogger.market.token.marketTokenAction({
      tokenName: coinGeckoId,
      action: 'buy',
      from: 'detailsPage',
    });
    onBuy();
  }, [coinGeckoId, onBuy, walletId]);

  return (
    <XStack $gtMd={{ mt: '$6' }} ai="center" gap="$4">
      {isLoading ? (
        <Skeleton width="100%" height={38} />
      ) : (
        <>
          <XStack gap="$2.5">
            <Button
              flex={1}
              variant="primary"
              onPress={handleSwap}
              disabled={actionDisabled}
            >
              {intl.formatMessage({ id: ETranslations.global_trade })}
            </Button>
            {canStaking ? (
              <Button
                flex={1}
                variant="secondary"
                onPress={handleStaking}
                disabled={actionDisabled}
              >
                {intl.formatMessage({ id: ETranslations.global_earn })}
              </Button>
            ) : null}
            {show.buy ? (
              <ReviewControl>
                <Button
                  flex={1}
                  variant="secondary"
                  onPress={handleBuy}
                  disabled={actionDisabled}
                >
                  {intl.formatMessage({ id: ETranslations.global_buy })}
                </Button>
              </ReviewControl>
            ) : null}
          </XStack>
          {show.sell ? (
            <ReviewControl>
              <ActionList
                disabled={actionDisabled}
                title={token.symbol.toUpperCase() || ''}
                renderTrigger={
                  <IconButton
                    title={intl.formatMessage({
                      id: ETranslations.global_more,
                    })}
                    icon="DotVerSolid"
                    variant="tertiary"
                    iconSize="$5"
                    disabled={actionDisabled}
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
