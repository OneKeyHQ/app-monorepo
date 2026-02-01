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
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
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

function WalletActionExchange() {
  const intl = useIntl();
  const navigation = useAppNavigation();

  const {
    activeAccount: { account, network, wallet, indexedAccount },
  } = useActiveAccount({ num: 0 });

  const { sortedExchanges, isExchangeInstalled } = useExchangeAppDetection();
  const [devSettings] = useDevSettingsPersistAtom();
  const enableBinanceConnect =
    devSettings.enabled && devSettings.settings?.enableBinanceConnect;

  const accountId = account?.id ?? '';
  const networkId = network?.id ?? '';
  const walletId = wallet?.id ?? '';
  const indexedAccountId = indexedAccount?.id ?? '';

  const handleBinancePress = useCallback(async () => {
    try {
      // 1. Get Binance supported assets
      const supportedAssets =
        await backgroundApiProxy.serviceToken.getBinanceSupportedAssets();

      // 2. Navigate to token selector with exchange filter
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
            // 3. Get account address
            const tokenNetworkId = selectedToken.networkId ?? networkId;
            const tokenAccountId = selectedToken.accountId ?? accountId;
            const accountAddress =
              await backgroundApiProxy.serviceAccount.getAccountAddressForApi({
                accountId: tokenAccountId,
                networkId: tokenNetworkId,
              });

            if (!accountAddress) {
              Toast.error({ title: 'Failed to get account address' });
              return;
            }

            // 4. Create pre-order
            const result =
              await backgroundApiProxy.serviceToken.createBinancePreOrder({
                networkId: tokenNetworkId,
                address: accountAddress,
                cryptoCurrency: (selectedToken.symbol ?? '').toUpperCase(),
                requestedAmount: '1', // Default amount for MVP
              });

            // 5. Redirect to Binance
            // Native: use linkingOpenURL to potentially open Binance app
            // Other platforms: use system browser
            if (platformEnv.isNative) {
              await openUrlUtils.linkingOpenURL(result.redirectUrl);
            } else {
              openUrlExternal(result.redirectUrl);
            }

            // 6. Close the modal
            navigation.popToTop();
          } catch (error) {
            console.error('[BinanceConnect] Error creating pre-order:', error);
            Toast.error({
              title: intl.formatMessage({
                id: ETranslations.feedback_request_failed,
              }),
            });
          }
        },
      });
    } catch (error) {
      console.error('[BinanceConnect] Error fetching supported assets:', error);
      Toast.error({
        title: intl.formatMessage({
          id: ETranslations.feedback_request_failed,
        }),
      });
    }
  }, [navigation, intl, networkId, accountId, indexedAccountId]);

  const handleExchangePress = useCallback(
    async (config: IExchangeConfig) => {
      const isInstalled = isExchangeInstalled(config.id);

      // Binance Connect flow:
      // - When enableBinanceConnect flag is ON: available on all platforms
      // - When flag is OFF: only available on native with Binance app installed (original behavior)
      if (config.id === EExchangeId.Binance) {
        const shouldUseBinanceConnect = enableBinanceConnect
          ? true // Flag ON: all platforms use Binance Connect
          : platformEnv.isNative && isInstalled; // Flag OFF: original behavior

        if (shouldUseBinanceConnect) {
          await handleBinancePress();
          return;
        }
      }

      // Other exchanges with app installed -> Original flow (show receive address)
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
      enableBinanceConnect,
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
