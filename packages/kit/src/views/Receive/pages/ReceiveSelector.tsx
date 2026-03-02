import { useCallback, useEffect } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  Accordion,
  Icon,
  Page,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IModalReceiveParamList } from '@onekeyhq/shared/src/routes';
import { EModalReceiveRoutes } from '@onekeyhq/shared/src/routes';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  openUrlExternal,
  openUrlInDiscovery,
} from '@onekeyhq/shared/src/utils/openUrlUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

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
import { WalletActionExchange } from '../../Home/components/WalletActions/WalletActionExchange';
import { WalletActionReceive } from '../../Home/components/WalletActions/WalletActionReceive';

import type { IListItemProps } from '../../../components/ListItem';
import type { RouteProp } from '@react-navigation/core';

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
      borderWidth={1}
      borderColor="$borderSubdued"
      drillIn
      gap="$4"
      userSelect="none"
      bg="$bg"
      {...props}
    >
      <YStack bg="$neutral3" p="$2" borderRadius="$full">
        <Icon name={icon} color="$iconActive" />
      </YStack>
      <ListItem.Text flex={1} primary={title} secondary={subtitle} />
    </ListItem>
  );
}

function ReceiveSelectorContent() {
  const intl = useIntl();

  // Pre-trigger exchange app detection to avoid UI flash when accordion expands
  useExchangeAppDetection();

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
          openUrlInDiscovery({ url });
        } else {
          openUrlExternal(url);
        }
      } else {
        onPress();
      }
    },
    [token, isSupported, url],
  );

  useEffect(() => () => void onClose?.(), [onClose]);

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.global_receive })}
      />
      <Page.Body>
        <YStack gap="$5" px="$5">
          {showBuyAction ? (
            <WalletActionBuy
              sameModal
              onClose={() => {}}
              source="receiveSelector"
              renderTrigger={({ onPress, disabled }) => (
                <ReceiveOptions
                  icon="CreditCardOutline"
                  title={intl.formatMessage({
                    id: ETranslations.global_buy_crypto,
                  })}
                  subtitle={
                    <XStack mt="$1" gap="$1">
                      <YStack
                        h="$5"
                        px="$1.5"
                        borderRadius="$1"
                        borderCurve="continuous"
                        justifyContent="center"
                        alignItems="center"
                        borderWidth={1}
                        borderColor="$borderSubdued"
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
                        borderRadius="$1"
                        borderCurve="continuous"
                        justifyContent="center"
                        alignItems="center"
                        borderWidth={1}
                        borderColor="$borderSubdued"
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
                        borderRadius="$1"
                        borderCurve="continuous"
                        justifyContent="center"
                        alignItems="center"
                        borderWidth={1}
                        borderColor="$borderSubdued"
                      >
                        <Icon name="VisaIllus" h="$3" w="$8" color="$icon" />
                      </YStack>
                      <XStack
                        alignItems="center"
                        px="$1"
                        gap="$0.5"
                        borderWidth={1}
                        borderColor="$borderSubdued"
                        borderRadius="$1"
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
            borderRadius="$3"
            borderColor="$borderSubdued"
            borderCurve="continuous"
          >
            <Accordion type="single" collapsible>
              <Accordion.Item value="exchange">
                <Accordion.Trigger
                  unstyled
                  borderWidth={1}
                  borderColor="$borderSubdued"
                  borderRadius="$3"
                  borderCurve="continuous"
                  p="$5"
                  bg="$bg"
                  gap="$4"
                  alignItems="center"
                  flexDirection="row"
                  hoverStyle={{
                    bg: '$neutral2',
                  }}
                >
                  {({ open }: { open: boolean }) => (
                    <>
                      <YStack bg="$neutral3" p="$2" borderRadius="$full">
                        <Icon name="SwitchHorOutline" color="$iconActive" />
                      </YStack>
                      <ListItem.Text
                        flex={1}
                        primary={intl.formatMessage({
                          id: ETranslations.receive_from_exchange,
                        })}
                        gap="$1"
                        secondary={
                          <XStack gap="$1">
                            <YStack
                              w="$5"
                              h="$5"
                              justifyContent="center"
                              alignItems="center"
                              borderRadius="$1"
                              borderCurve="continuous"
                              bg="$yellow6"
                            >
                              <Icon
                                size="$3"
                                name="BinanceBrand"
                                color="$yellow11"
                              />
                            </YStack>
                            <YStack
                              w="$5"
                              h="$5"
                              justifyContent="center"
                              alignItems="center"
                              borderRadius="$1"
                              borderCurve="continuous"
                              bg="$neutral6"
                            >
                              <Icon
                                size="$3"
                                name="OkxBrand"
                                color="$neutral11"
                              />
                            </YStack>
                            <YStack
                              w="$5"
                              h="$5"
                              justifyContent="center"
                              alignItems="center"
                              borderRadius="$1"
                              borderCurve="continuous"
                              bg="$blue6"
                            >
                              <Icon
                                size="$3"
                                name="CoinbaseBrand"
                                color="$blue11"
                              />
                            </YStack>
                            <XStack
                              alignItems="center"
                              px="$1"
                              gap="$0.5"
                              borderWidth={1}
                              borderColor="$borderSubdued"
                              borderRadius="$1"
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
                      />
                      <YStack
                        animation="quick"
                        rotate={open ? '90deg' : '0deg'}
                      >
                        <ListItem.DrillIn />
                      </YStack>
                    </>
                  )}
                </Accordion.Trigger>
                <Accordion.HeightAnimator animation="quick">
                  <Accordion.Content
                    unstyled
                    p="$5"
                    animation="quick"
                    enterStyle={{ opacity: 0, filter: 'blur(4px)' }}
                    exitStyle={{ opacity: 0, filter: 'blur(4px)' }}
                  >
                    <SizableText mb="$2" color="$textSubdued">
                      {intl.formatMessage({
                        id: ETranslations.learn_how_to_withdraw_crypto_from_exchange,
                      })}
                    </SizableText>
                    <WalletActionExchange
                      accountId={accountId}
                      networkId={networkId}
                      walletId={walletId}
                      indexedAccountId={indexedAccountId}
                    />
                  </Accordion.Content>
                </Accordion.HeightAnimator>
              </Accordion.Item>
            </Accordion>
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
