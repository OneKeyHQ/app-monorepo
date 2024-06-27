import { useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { isEmpty } from 'lodash';
import { useIntl } from 'react-intl';

import type { IActionListSection } from '@onekeyhq/components';
import {
  ActionList,
  Alert,
  Divider,
  NumberSizeableText,
  Page,
  Skeleton,
  Stack,
  XStack,
  YStack,
  getFontToken,
  useClipboard,
} from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import type { IPageHeaderProps } from '@onekeyhq/components/src/layouts/Page/PageHeader';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ReviewControl } from '@onekeyhq/kit/src/components/ReviewControl';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { TxHistoryListView } from '@onekeyhq/kit/src/components/TxHistoryListView';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ProviderJotaiContextHistoryList } from '@onekeyhq/kit/src/states/jotai/contexts/historyList';
import { openUrl } from '@onekeyhq/kit/src/utils/openUrl';
import { RawActions } from '@onekeyhq/kit/src/views/Home/components/WalletActions/RawActions';
import { StakingApr } from '@onekeyhq/kit/src/views/Staking/components/StakingApr';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalReceiveRoutes,
  EModalRoutes,
  EModalSendRoutes,
  EModalSwapRoutes,
} from '@onekeyhq/shared/src/routes';
import { EModalAssetDetailRoutes } from '@onekeyhq/shared/src/routes/assetDetails';
import type { IModalAssetDetailsParamList } from '@onekeyhq/shared/src/routes/assetDetails';
import { buildExplorerAddressUrl } from '@onekeyhq/shared/src/utils/uriUtils';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';

import ActionBuy from './ActionBuy';
import ActionSell from './ActionSell';

import type { RouteProp } from '@react-navigation/core';

export function TokenDetails() {
  const intl = useIntl();
  const navigation = useAppNavigation();

  const route =
    useRoute<
      RouteProp<
        IModalAssetDetailsParamList,
        EModalAssetDetailRoutes.TokenDetails
      >
    >();

  const { copyText } = useClipboard();

  const [settings] = useSettingsPersistAtom();

  const {
    accountId,
    networkId,
    walletId,
    deriveInfo,
    deriveType,
    tokenInfo,
    isBlocked: tokenIsBlocked,
  } = route.params;

  const [isBlocked, setIsBlocked] = useState(!!tokenIsBlocked);
  const [initialized, setInitialized] = useState(false);

  const { network } = useAccountData({ accountId, networkId });

  const { result: tokenDetails, isLoading: isLoadingTokenDetails } =
    usePromiseResult(
      async () => {
        const tokensDetails =
          await backgroundApiProxy.serviceToken.fetchTokensDetails({
            accountId,
            networkId,
            contractList: [tokenInfo.address],
          });
        return tokensDetails[0];
      },
      [accountId, networkId, tokenInfo.address],
      {
        watchLoading: true,
      },
    );

  /**
   * since some tokens are slow to load history,
   * they are loaded separately from the token details
   * so as not to block the display of the top details.
   */
  const { result: tokenHistory, isLoading: isLoadingTokenHistory } =
    usePromiseResult(
      async () => {
        const r = await backgroundApiProxy.serviceHistory.fetchAccountHistory({
          accountId,
          networkId,
          tokenIdOnNetwork: tokenInfo.address,
        });
        setInitialized(true);
        return r;
      },
      [accountId, networkId, tokenInfo.address],
      { watchLoading: true },
    );

  const handleOnSwap = useCallback(async () => {
    navigation.pushModal(EModalRoutes.SwapModal, {
      screen: EModalSwapRoutes.SwapMainLand,
      params: {
        importNetworkId: networkId,
        importFromToken: {
          contractAddress: tokenInfo.address,
          symbol: tokenInfo.symbol,
          networkId,
          isNative: tokenInfo.isNative,
          decimals: tokenInfo.decimals,
          name: tokenInfo.name,
          logoURI: tokenInfo.logoURI,
          networkLogoURI: network?.logoURI,
        },
      },
    });
  }, [
    navigation,
    network?.logoURI,
    networkId,
    tokenInfo.address,
    tokenInfo.decimals,
    tokenInfo.isNative,
    tokenInfo.logoURI,
    tokenInfo.name,
    tokenInfo.symbol,
  ]);

  const handleReceivePress = useCallback(() => {
    navigation.pushModal(EModalRoutes.ReceiveModal, {
      screen: EModalReceiveRoutes.ReceiveToken,
      params: {
        networkId,
        accountId,
        walletId,
        deriveInfo,
        deriveType,
      },
    });
  }, [accountId, deriveInfo, deriveType, navigation, networkId, walletId]);

  const handleHistoryItemPress = useCallback(
    async (tx: IAccountHistoryTx) => {
      navigation.push(EModalAssetDetailRoutes.HistoryDetails, {
        accountId,
        networkId,
        accountAddress:
          await backgroundApiProxy.serviceAccount.getAccountAddressForApi({
            accountId,
            networkId,
          }),
        xpub: await backgroundApiProxy.serviceAccount.getAccountXpub({
          accountId,
          networkId,
        }),
        historyTx: tx,
      });
    },
    [accountId, navigation, networkId],
  );

  const handleSendPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.SendModal, {
      screen: EModalSendRoutes.SendDataInput,
      params: {
        networkId,
        accountId,
        isNFT: false,
        token: tokenDetails?.info ?? tokenInfo,
      },
    });
  }, [accountId, navigation, networkId, tokenDetails?.info, tokenInfo]);

  const handleToggleBlockedToken = useCallback(async () => {
    setIsBlocked(!isBlocked);
    if (isBlocked) {
      await backgroundApiProxy.serviceToken.unblockToken({
        networkId,
        tokenId: tokenInfo.address,
      });
    } else {
      await backgroundApiProxy.serviceToken.blockToken({
        networkId,
        tokenId: tokenInfo.address,
      });
    }
  }, [isBlocked, networkId, tokenInfo.address]);

  const headerRight = useCallback(() => {
    const sections: IActionListSection[] = [];

    if (!tokenInfo.isNative) {
      sections.push({
        items: [
          {
            label: intl.formatMessage({
              id: ETranslations.global_copy_token_contract,
            }),
            icon: 'Copy1Outline',
            onPress: () => copyText(tokenInfo.address),
          },
        ],
      });

      const tokenDetailsUrl = buildExplorerAddressUrl({
        network,
        address: tokenInfo.address,
      });

      if (tokenDetailsUrl !== '') {
        sections[0].items.push({
          label: intl.formatMessage({
            id: ETranslations.global_view_in_blockchain_explorer,
          }),
          icon: 'ShareOutline',
          onPress: () => openUrl(tokenDetailsUrl),
        });
      }
    }

    if (!tokenInfo.isNative) {
      sections.push({
        items: [
          {
            label: isBlocked
              ? intl.formatMessage({ id: ETranslations.global_unhide })
              : intl.formatMessage({ id: ETranslations.global_hide }),
            icon: isBlocked ? 'EyeOutline' : 'EyeOffOutline',
            onPress: handleToggleBlockedToken,
          },
        ],
      });
    }

    return isEmpty(sections) ? null : (
      <ActionList
        title={intl.formatMessage({ id: ETranslations.global_more })}
        renderTrigger={<HeaderIconButton icon="DotHorOutline" />}
        sections={sections}
      />
    );
  }, [
    copyText,
    handleToggleBlockedToken,
    intl,
    isBlocked,
    network,
    tokenInfo.address,
    tokenInfo.isNative,
  ]);

  // const renderTokenAddress = useCallback(() => {
  //   if (!tokenInfo.address) return null;
  //   return (
  //     <XGroup
  //       bg="$bgStrong"
  //       borderRadius="$2"
  //       separator={<Divider vertical borderColor="$bgApp" />}
  //     >
  //       <XStack
  //         alignItems="center"
  //         py="$0.5"
  //         px="$1.5"
  //         userSelect="none"
  //         style={{
  //           borderCurve: 'continuous',
  //         }}
  //         hoverStyle={{
  //           bg: '$bgHover',
  //         }}
  //         pressStyle={{
  //           bg: '$bgActive',
  //         }}
  //         $platform-native={{
  //           hitSlop: {
  //             top: 8,
  //             bottom: 8,
  //           },
  //         }}
  //         onPress={() =>
  //           Toast.success({
  //             title: 'Copied',
  //           })
  //         }
  //       >
  //         <Image
  //           width="$4"
  //           height="$4"
  //           source={{
  //             uri: network?.logoURI,
  //           }}
  //         />
  //         <SizableText pl="$1" size="$bodyMd" color="$textSubdued">
  //           {accountUtils.shortenAddress({ address: tokenInfo.address })}
  //         </SizableText>
  //       </XStack>
  //       {media.gtMd && (
  //         <Stack
  //           alignItems="center"
  //           justifyContent="center"
  //           py="$0.5"
  //           px="$1.5"
  //           hoverStyle={{
  //             bg: '$bgHover',
  //           }}
  //           pressStyle={{
  //             bg: '$bgActive',
  //           }}
  //           style={{
  //             borderCurve: 'continuous',
  //           }}
  //           $platform-native={
  //             {
  //               hitSlop: {
  //                 top: 8,
  //                 bottom: 8,
  //                 right: 8,
  //               },
  //             } as IStackProps
  //           }
  //         >
  //           <Icon size="$4" name="ShareOutline" color="$iconSubdued" />
  //         </Stack>
  //       )}
  //     </XGroup>
  //   );
  // }, [media.gtMd, network?.logoURI, tokenInfo.address]);

  const headerTitleStyle = useMemo(() => getFontToken('$headingLg'), []);
  return (
    <Page>
      <Page.Header
        headerTitle={tokenInfo.name ?? tokenDetails?.info.name}
        headerTitleStyle={
          headerTitleStyle as IPageHeaderProps['headerTitleStyle']
        }
        headerRight={headerRight}
      />
      <Page.Body>
        <ProviderJotaiContextHistoryList>
          <TxHistoryListView
            initialized={initialized}
            isLoading={isLoadingTokenHistory}
            data={tokenHistory ?? []}
            onPressHistory={handleHistoryItemPress}
            ListHeaderComponent={
              <>
                {isBlocked ? (
                  <Alert
                    icon="EyeOffOutline"
                    fullBleed
                    type="warning"
                    title={intl.formatMessage({
                      id: ETranslations.token_hidden_message,
                    })}
                    action={{
                      primary: intl.formatMessage({
                        id: ETranslations.global_unhide,
                      }),
                      onPrimaryPress: handleToggleBlockedToken,
                    }}
                    mb="$5"
                  />
                ) : null}

                {/* Overview */}
                <Stack px="$5" pb="$5">
                  {/* Balance */}
                  <XStack alignItems="center" mb="$5">
                    <Token
                      tokenImageUri={
                        tokenInfo.logoURI ?? tokenDetails?.info.logoURI
                      }
                      size="xl"
                    />
                    <Stack ml="$3" flex={1}>
                      {isLoadingTokenDetails ? (
                        <YStack>
                          <Stack py="$1.5">
                            <Skeleton h="$6" w="$40" />
                          </Stack>
                          <Stack py="$1">
                            <Skeleton h="$4" w="$28" />
                          </Stack>
                        </YStack>
                      ) : (
                        <>
                          <NumberSizeableText
                            size="$heading3xl"
                            formatter="balance"
                            formatterOptions={{ tokenSymbol: tokenInfo.symbol }}
                          >
                            {tokenDetails?.balanceParsed ?? '0'}
                          </NumberSizeableText>
                          <NumberSizeableText
                            formatter="value"
                            formatterOptions={{
                              currency: settings.currencyInfo.symbol,
                            }}
                            color="$textSubdued"
                            size="$bodyLgMedium"
                          >
                            {tokenDetails?.fiatValue ?? '0'}
                          </NumberSizeableText>
                        </>
                      )}
                    </Stack>
                  </XStack>
                  {/* Actions */}
                  <RawActions>
                    <ReviewControl>
                      <ActionBuy
                        networkId={networkId}
                        accountId={accountId}
                        tokenAddress={tokenInfo.address}
                      />
                    </ReviewControl>

                    <RawActions.Swap onPress={handleOnSwap} />

                    <RawActions.Send onPress={handleSendPress} />
                    <RawActions.Receive onPress={handleReceivePress} />
                    <ReviewControl>
                      <ActionSell
                        networkId={networkId}
                        accountId={accountId}
                        tokenAddress={tokenInfo.address}
                      />
                    </ReviewControl>
                  </RawActions>
                </Stack>

                <StakingApr
                  networkId={networkId}
                  accountId={accountId}
                  tokenAddress={tokenInfo.address}
                />

                {/* History */}
                <Divider />
              </>
            }
          />
        </ProviderJotaiContextHistoryList>
      </Page.Body>
    </Page>
  );
}
