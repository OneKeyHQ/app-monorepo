import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import type { ColorTokens } from '@onekeyhq/components';
import {
  Button,
  Icon,
  SizableText,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useExchangeAppDetection } from '@onekeyhq/kit/src/hooks/useExchangeAppDetection';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { HELP_CENTER_URL } from '@onekeyhq/shared/src/config/appConfig';
import {
  EExchangeId,
  type IExchangeConfig,
} from '@onekeyhq/shared/src/consts/exchangeConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalReceiveRoutes } from '@onekeyhq/shared/src/routes';
import openUrlUtils, {
  openUrlExternal,
  openUrlInDiscovery,
} from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IToken } from '@onekeyhq/shared/types/token';

function WalletActionExchange(props?: {
  accountId?: string;
  networkId?: string;
  walletId?: string;
  indexedAccountId?: string;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();

  const {
    activeAccount: { account, network, wallet, indexedAccount },
  } = useActiveAccount({ num: 0 });

  const { sortedExchanges, isExchangeInstalled } = useExchangeAppDetection();

  const accountId = props?.accountId || account?.id || '';
  const networkId = props?.networkId || network?.id || '';
  const walletId = props?.walletId || wallet?.id || '';
  const indexedAccountId = props?.indexedAccountId || indexedAccount?.id || '';

  const handleBinancePress = useCallback(async () => {
    try {
      const supportedAssets =
        await backgroundApiProxy.serviceToken.getBinanceSupportedAssets();

      navigation.push(EModalReceiveRoutes.ReceiveSelectToken, {
        title: intl.formatMessage({ id: ETranslations.global_select_crypto }),
        networkId,
        accountId,
        indexedAccountId,
        closeAfterSelect: false,
        aggregateTokenSelectorScreen:
          EModalReceiveRoutes.ReceiveSelectAggregateToken,
        exchangeFilter: {
          exchangeId: EExchangeId.Binance,
          supportedAssets,
        },
        onSelect: async (selectedToken: IToken) => {
          try {
            const tokenNetworkId = selectedToken.networkId ?? networkId;
            const tokenAccountId = selectedToken.accountId ?? accountId;
            const accountAddress =
              await backgroundApiProxy.serviceAccount.getAccountAddressForApi({
                accountId: tokenAccountId,
                networkId: tokenNetworkId,
              });

            if (!accountAddress) {
              return;
            }

            const result =
              await backgroundApiProxy.serviceToken.createBinancePreOrder({
                networkId: tokenNetworkId,
                address: accountAddress,
                cryptoCurrency: (
                  selectedToken.commonSymbol ??
                  selectedToken.symbol ??
                  ''
                ).toUpperCase(),
              });

            // Verify the address returned by Binance matches our local address
            if (
              !result.withdrawWalletAddress ||
              result.withdrawWalletAddress.toLowerCase() !==
                accountAddress.toLowerCase()
            ) {
              Toast.error({
                title: intl.formatMessage({
                  id: ETranslations.global_an_error_occurred,
                }),
              });
              console.error(
                '[BinanceConnect] Address mismatch detected — expected:',
                accountAddress,
                'got:',
                result.withdrawWalletAddress,
              );
              return;
            }

            if (platformEnv.isNative) {
              await openUrlUtils.linkingOpenURL(result.redirectUrl);
            } else {
              openUrlExternal(result.redirectUrl);
            }

            navigation.popToTop();
          } catch (error) {
            console.error('[BinanceConnect] Pre-order error:', error);
          }
        },
      });
    } catch (error) {
      console.error('[BinanceConnect] Error fetching supported assets:', error);
    }
  }, [navigation, intl, networkId, accountId, indexedAccountId]);

  const handleExchangePress = useCallback(
    async (config: IExchangeConfig) => {
      const isInstalled = isExchangeInstalled(config.id);

      // Binance Connect: available on all platforms, or native when app is installed
      if (
        config.id === EExchangeId.Binance &&
        (!platformEnv.isNative || isInstalled)
      ) {
        await handleBinancePress();
        return;
      }

      // Other exchanges with app installed: show receive address
      if (platformEnv.isNative && isInstalled) {
        navigation.push(EModalReceiveRoutes.ReceiveSelectToken, {
          title: intl.formatMessage({ id: ETranslations.global_select_crypto }),
          networkId,
          accountId,
          indexedAccountId,
          closeAfterSelect: false,
          aggregateTokenSelectorScreen:
            EModalReceiveRoutes.ReceiveSelectAggregateToken,
          onSelect: async (selectedToken: IToken) => {
            navigation.push(EModalReceiveRoutes.ReceiveToken, {
              networkId: selectedToken.networkId ?? networkId,
              accountId: selectedToken.accountId ?? accountId,
              walletId,
              token: selectedToken,
              indexedAccountId,
              exchangeSource: config.id,
            });
          },
        });
        return;
      }

      // Fallback: Open help article
      const helpLink = `${HELP_CENTER_URL}/articles/${config.helpArticleId}`;
      if (platformEnv.isDesktop || platformEnv.isNative) {
        openUrlInDiscovery({ url: helpLink });
      } else {
        openUrlExternal(helpLink);
      }
    },
    [
      isExchangeInstalled,
      handleBinancePress,
      navigation,
      intl,
      networkId,
      accountId,
      indexedAccountId,
      walletId,
    ],
  );

  return (
    <XStack gap="$5" flexWrap="wrap">
      {sortedExchanges.map((config) => (
        <Button
          key={config.id}
          size="small"
          variant="tertiary"
          childrenAsText={false}
          onPress={() => handleExchangePress(config)}
        >
          <XStack alignItems="center" gap="$2">
            <YStack
              p={2}
              borderRadius="$1"
              borderCurve="continuous"
              bg={config.iconBgColor as ColorTokens}
            >
              <Icon
                size="$3"
                name={config.iconName}
                color={config.iconColor as ColorTokens}
              />
            </YStack>
            <SizableText>{config.name}</SizableText>
          </XStack>
        </Button>
      ))}
    </XStack>
  );
}

export { WalletActionExchange };
