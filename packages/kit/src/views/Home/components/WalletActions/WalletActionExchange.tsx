import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import type { ColorTokens } from '@onekeyhq/components';
import {
  Button,
  Icon,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IExchangeConfig } from '@onekeyhq/shared/src/consts/exchangeConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalReceiveRoutes } from '@onekeyhq/shared/src/routes';
import {
  openUrlExternal,
  openUrlInDiscovery,
} from '@onekeyhq/shared/src/utils/openUrlUtils';
import { HELP_CENTER_URL } from '@onekeyhq/shared/src/config/appConfig';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useExchangeAppDetection } from '@onekeyhq/kit/src/hooks/useExchangeAppDetection';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IToken } from '@onekeyhq/shared/types/token';

function WalletActionExchange() {
  const intl = useIntl();
  const navigation = useAppNavigation();

  const {
    activeAccount: { account, network, wallet, indexedAccount },
  } = useActiveAccount({ num: 0 });

  const { sortedExchanges, isExchangeInstalled } = useExchangeAppDetection();

  const accountId = account?.id ?? '';
  const networkId = network?.id ?? '';
  const walletId = wallet?.id ?? '';
  const indexedAccountId = indexedAccount?.id ?? '';

  const handleExchangePress = useCallback(
    (config: IExchangeConfig) => {
      console.log('[ExchangeDebug] handleExchangePress', JSON.stringify({
        configId: config.id,
        configName: config.name,
      }));
      const isInstalled = isExchangeInstalled(config.id);
      console.log('[ExchangeDebug] isInstalled', JSON.stringify(isInstalled));

      // Mobile with app installed -> Navigate to token selection flow
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
            console.log('[ExchangeDebug] onSelect called', JSON.stringify({
              exchangeSource: config.id,
              selectedToken,
              networkId: selectedToken.networkId ?? networkId,
              accountId: selectedToken.accountId ?? accountId,
            }));
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
