import { useCallback, useEffect } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  Icon,
  Image,
  Page,
  SizableText,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { HELP_CENTER_URL } from '@onekeyhq/shared/src/config/appConfig';
import {
  EExchangeId,
  type IExchangeConfig,
} from '@onekeyhq/shared/src/consts/exchangeConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IModalReceiveParamList } from '@onekeyhq/shared/src/routes';
import { EModalReceiveRoutes } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import openUrlUtils, {
  openFiatCryptoUrl,
  openUrlExternal,
  openUrlInDiscovery,
} from '@onekeyhq/shared/src/utils/openUrlUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IToken } from '@onekeyhq/shared/types/token';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { ListItem } from '../../../components/ListItem';
import { useReviewControl } from '../../../components/ReviewControl';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useExchangeAppDetection } from '../../../hooks/useExchangeAppDetection';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { HomeTokenListProviderMirror } from '../../Home/components/HomeTokenListProvider/HomeTokenListProviderMirror';
import { WalletActionBuy } from '../../Home/components/WalletActions/WalletActionBuy';
import { WalletActionReceive } from '../../Home/components/WalletActions/WalletActionReceive';

import type { IListItemProps } from '../../../components/ListItem';
import type { RouteProp } from '@react-navigation/core';
import type { ImageSourcePropType } from 'react-native';

const EXCHANGE_LOGOS: Record<EExchangeId, ImageSourcePropType> = {
  [EExchangeId.Binance]: require('@onekeyhq/shared/src/assets/wallet/external/logo/logo_binance.png'),
  [EExchangeId.OKX]: require('@onekeyhq/shared/src/assets/wallet/external/logo/logo_okx.png'),
  [EExchangeId.Coinbase]: require('@onekeyhq/shared/src/assets/wallet/external/logo/logo_coinbase.png'),
};

function ReceiveOptions({
  icon,
  title,
  subtitle,
  ...props
}: {
  icon: IKeyOfIcons;
  title: string;
  subtitle: IListItemProps['subtitle'];
} & IListItemProps) {
  return (
    <ListItem
      mx="$0"
      p="$5"
      drillIn
      gap="$4"
      userSelect="none"
      bg="$neutral2"
      borderRadius="$4"
      nativePressableStyle={{ flexShrink: 0 }}
      hoverStyle={{
        bg: '$neutral3',
      }}
      pressStyle={{
        bg: '$neutral4',
      }}
      $platform-native={{
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '$neutral3',
      }}
      $platform-web={{
        outlineWidth: 1,
        outlineColor: '$neutral3',
        outlineStyle: 'solid',
      }}
      {...props}
    >
      <YStack bg="$neutral3" p="$2" borderRadius="$full">
        <Icon name={icon} color="$iconActive" />
      </YStack>
      <ListItem.Text gap="$1" flex={1} primary={title} secondary={subtitle} />
    </ListItem>
  );
}

function ReceiveSelectorContent() {
  const intl = useIntl();

  const { sortedExchanges, isExchangeInstalled } = useExchangeAppDetection();

  const showBuyAction = useReviewControl();

  const route =
    useRoute<
      RouteProp<IModalReceiveParamList, EModalReceiveRoutes.ReceiveSelector>
    >();

  // Get active account from context as fallback when route params are not provided
  const {
    activeAccount: { account, network, wallet, indexedAccount },
  } = useActiveAccount({ num: 0 });

  // Use route params if provided, otherwise fallback to active account
  const accountId = route.params?.accountId ?? account?.id;
  const networkId = route.params?.networkId ?? network?.id;
  const walletId = route.params?.walletId ?? wallet?.id;
  const indexedAccountId = route.params?.indexedAccountId ?? indexedAccount?.id;
  const { token, onClose } = route.params ?? {};

  const navigation = useAppNavigation();

  const { result } = usePromiseResult(async () => {
    if (accountId && networkId && token) {
      try {
        const { url, build } =
          await backgroundApiProxy.serviceFiatCrypto.generateWidgetUrl({
            networkId,
            tokenAddress: token.address,
            accountId,
            type: 'buy',
          });
        return {
          isSupported: url && build,
          url,
        };
      } catch (_error) {
        return {
          isSupported: false,
        };
      }
    }
    return {
      isSupported: true,
    };
  }, [accountId, networkId, token]);

  const { isSupported, url } = result ?? {};

  const handleReceiveOnPress = useCallback(
    ({ onPress }: { onPress: () => void }) => {
      if (token) {
        navigation.push(EModalReceiveRoutes.ReceiveToken, {
          networkId,
          accountId,
          walletId,
          token,
          indexedAccountId,
          disableSelector: true,
        });
      } else {
        onPress();
      }
    },
    [token, accountId, networkId, walletId, indexedAccountId, navigation],
  );

  const handleBuyOnPress = useCallback(
    ({ onPress }: { onPress: () => void }) => {
      if (token && isSupported && url) {
        if (platformEnv.isDesktop || platformEnv.isNative) {
          openFiatCryptoUrl(url);
        } else {
          openUrlExternal(url);
        }
      } else {
        onPress();
      }
    },
    [token, isSupported, url],
  );

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
            const tokenNetworkId = selectedToken.networkId ?? networkId ?? '';
            const tokenAccountId = selectedToken.accountId ?? accountId ?? '';
            const accountAddress =
              await backgroundApiProxy.serviceAccount.getAccountAddressForApi({
                accountId: tokenAccountId,
                networkId: tokenNetworkId,
              });

            if (!accountAddress) {
              return;
            }

            const preOrderResult =
              await backgroundApiProxy.serviceToken.createBinancePreOrder({
                networkId: tokenNetworkId,
                address: accountAddress,
                cryptoCurrency: (
                  selectedToken.commonSymbol ??
                  selectedToken.symbol ??
                  ''
                ).toUpperCase(),
              });

            if (
              !preOrderResult.withdrawWalletAddress ||
              preOrderResult.withdrawWalletAddress.toLowerCase() !==
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
                preOrderResult.withdrawWalletAddress,
              );
              return;
            }

            if (platformEnv.isNative) {
              await openUrlUtils.linkingOpenURL(preOrderResult.redirectUrl);
            } else {
              openUrlExternal(preOrderResult.redirectUrl);
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

      if (
        config.id === EExchangeId.Binance &&
        (!platformEnv.isNative || isInstalled)
      ) {
        await handleBinancePress();
        return;
      }

      if (platformEnv.isNative && isInstalled) {
        navigation.push(EModalReceiveRoutes.ReceiveSelectToken, {
          title: intl.formatMessage({
            id: ETranslations.global_select_crypto,
          }),
          networkId,
          accountId,
          indexedAccountId,
          closeAfterSelect: false,
          aggregateTokenSelectorScreen:
            EModalReceiveRoutes.ReceiveSelectAggregateToken,
          onSelect: async (selectedToken: IToken) => {
            const tokenNetworkId = selectedToken.networkId ?? networkId ?? '';
            const tokenAccountId = selectedToken.accountId ?? accountId ?? '';
            const isHardware =
              accountUtils.isHwWallet({ walletId }) ||
              accountUtils.isQrWallet({ walletId });

            if (isHardware) {
              navigation.push(EModalReceiveRoutes.ReceiveToken, {
                networkId: tokenNetworkId,
                accountId: tokenAccountId,
                walletId,
                token: selectedToken,
                indexedAccountId,
                exchangeSource: config.id,
              });
            } else {
              try {
                const address =
                  await backgroundApiProxy.serviceAccount.getAccountAddressForApi(
                    {
                      accountId: tokenAccountId,
                      networkId: tokenNetworkId,
                    },
                  );
                if (!address) return;
                navigation.push(EModalReceiveRoutes.ExchangeOpenRedirect, {
                  exchangeSource: config.id,
                  address,
                });
              } catch (_error) {
                Toast.error({
                  title: intl.formatMessage({
                    id: ETranslations.global_an_error_occurred,
                  }),
                });
              }
            }
          },
        });
        return;
      }

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

  useEffect(() => () => void onClose?.(), [onClose]);

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.global_receive })}
      />
      <Page.Body>
        <YStack gap="$5" px="$5" pt="$px">
          {showBuyAction ? (
            <WalletActionBuy
              sameModal
              onClose={() => {}}
              source="receiveSelector"
              renderTrigger={({ onPress, disabled }) => (
                <ReceiveOptions
                  icon="CurrencyDollarOutline"
                  title={intl.formatMessage({
                    id: ETranslations.global_buy_crypto,
                  })}
                  subtitle={
                    <XStack mt="$1" gap="$1">
                      <YStack
                        h="$5"
                        px="$1.5"
                        borderRadius="$2"
                        borderCurve="continuous"
                        justifyContent="center"
                        alignItems="center"
                        bg="$neutral3"
                      >
                        <Icon
                          name="ApplePayIllus"
                          h="$3"
                          w="$8"
                          color="$icon"
                        />
                      </YStack>
                      <YStack
                        h="$5"
                        px="$1.5"
                        borderRadius="$2"
                        borderCurve="continuous"
                        justifyContent="center"
                        alignItems="center"
                        bg="$neutral3"
                      >
                        <Icon
                          name="GooglePayIllus"
                          h="$3"
                          w="$8"
                          color="$icon"
                        />
                      </YStack>
                      <YStack
                        h="$5"
                        px="$0.5"
                        borderRadius="$2"
                        borderCurve="continuous"
                        justifyContent="center"
                        alignItems="center"
                        bg="$neutral3"
                      >
                        <Icon name="VisaIllus" h="$3" w="$8" color="$icon" />
                      </YStack>
                      <XStack
                        alignItems="center"
                        px="$1"
                        gap="$0.5"
                        bg="$neutral3"
                        borderRadius="$2"
                        borderCurve="continuous"
                      >
                        {Array.from({ length: 3 }).map((_, index) => (
                          <YStack
                            key={index}
                            borderRadius="$full"
                            w={3}
                            h={3}
                            bg="$iconSubdued"
                          />
                        ))}
                      </XStack>
                    </XStack>
                  }
                  onPress={() => handleBuyOnPress({ onPress })}
                  disabled={token ? !isSupported : disabled}
                />
              )}
            />
          ) : null}
          <WalletActionReceive
            sameModal
            source="receiveSelector"
            renderTrigger={({ onPress, disabled }) => (
              <ReceiveOptions
                icon="QrCodeOutline"
                title={intl.formatMessage({
                  id: ETranslations.receive_from_another_wallet,
                })}
                subtitle={intl.formatMessage({
                  id: ETranslations.receive_from_another_wallet_desc,
                })}
                onPress={() =>
                  handleReceiveOnPress({
                    onPress,
                  })
                }
                disabled={disabled}
              />
            )}
          />
          <YStack
            bg="$neutral2"
            borderRadius="$4"
            borderCurve="continuous"
            overflow="hidden"
            $platform-native={{
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: '$neutral3',
            }}
            $platform-web={{
              outlineWidth: 1,
              outlineColor: '$neutral3',
              outlineStyle: 'solid',
            }}
            py="$3"
            gap="$1"
          >
            <SizableText
              size="$bodyMdMedium"
              color="$textSubdued"
              px="$5"
              pt="$2"
              pb="$1"
            >
              {intl.formatMessage({
                id: ETranslations.receive_from_exchange,
              })}
            </SizableText>
            {sortedExchanges.map((config) => (
              <ListItem
                key={config.id}
                drillIn
                onPress={() => handleExchangePress(config)}
                gap="$4"
                nativePressableStyle={{ flexShrink: 0 }}
              >
                <Image
                  w="$10"
                  h="$10"
                  borderRadius="$full"
                  source={EXCHANGE_LOGOS[config.id]}
                />
                <ListItem.Text flex={1} primary={config.name} />
              </ListItem>
            ))}
          </YStack>
        </YStack>
      </Page.Body>
    </Page>
  );
}

function ReceiveSelector() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <HomeTokenListProviderMirror>
        <ReceiveSelectorContent />
      </HomeTokenListProviderMirror>
    </AccountSelectorProviderMirror>
  );
}

export default ReceiveSelector;
