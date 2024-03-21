import { useCallback, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { StyleSheet } from 'react-native';

import {
  ActionList,
  Alert,
  Divider,
  Icon,
  NumberSizeableText,
  Page,
  Skeleton,
  Stack,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EModalRoutes, EModalSendRoutes } from '@onekeyhq/shared/src/routes';
import { EModalAssetDetailRoutes } from '@onekeyhq/shared/src/routes/assetDetails';
import type { IModalAssetDetailsParamList } from '@onekeyhq/shared/src/routes/assetDetails';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { Token } from '../../../components/Token';
import { TxHistoryListView } from '../../../components/TxHistoryListView';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { RawActions } from '../../Home/components/WalletActions/RawActions';
import { EModalReceiveRoutes } from '../../Receive/router/type';

import type { RouteProp } from '@react-navigation/core';

export function TokenDetails() {
  const navigation = useAppNavigation();

  const route =
    useRoute<
      RouteProp<
        IModalAssetDetailsParamList,
        EModalAssetDetailRoutes.TokenDetails
      >
    >();

  const [settings] = useSettingsPersistAtom();

  const {
    accountId,
    networkId,
    tokenInfo,
    isBlocked: tokenIsBlocked,
  } = route.params;

  const [isBlocked, setIsBlocked] = useState(!!tokenIsBlocked);
  const [initialized, setInitialized] = useState(false);

  const { result: [tokenHistory, tokenDetails, account] = [], isLoading } =
    usePromiseResult(
      async () => {
        const a = await backgroundApiProxy.serviceAccount.getAccount({
          accountId,
          networkId,
        });

        if (!a) return;
        const xpub = await backgroundApiProxy.serviceAccount.getAccountXpub({
          accountId,
          networkId,
        });
        const [history, details] = await Promise.all([
          backgroundApiProxy.serviceHistory.fetchAccountHistory({
            accountId: a.id,
            accountAddress: a.address,
            xpub,
            networkId,
            tokenIdOnNetwork: tokenInfo.address,
          }),
          backgroundApiProxy.serviceToken.fetchTokensDetails({
            networkId,
            xpub,
            accountAddress: a.address,
            contractList: [tokenInfo.address],
          }),
        ]);

        setInitialized(true);

        return [history, details[0], a];
      },
      [accountId, networkId, tokenInfo.address],
      {
        watchLoading: true,
      },
    );

  const handleReceivePress = useCallback(() => {
    navigation.pushFullModal(EModalRoutes.ReceiveModal, {
      screen: EModalReceiveRoutes.LightingInvoice,
    });
  }, [navigation]);

  const handleHistoryItemPress = useCallback(
    (tx: IAccountHistoryTx) => {
      navigation.push(EModalAssetDetailRoutes.HistoryDetails, {
        networkId,
        accountAddress: account?.address,
        historyTx: tx,
      });
    },
    [account?.address, navigation, networkId],
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

  const headerRight = useCallback(
    () => (
      <ActionList
        title="Actions"
        renderTrigger={<HeaderIconButton icon="DotHorOutline" />}
        sections={[
          {
            items: [
              {
                label: 'Copy Token Contrast',
                icon: 'Copy1Outline',
                onPress: () => Toast.success({ title: 'Copied' }),
              },
              {
                label: 'View on Etherscan',
                icon: 'ShareOutline',
              },
            ],
          },
          {
            items: [
              {
                label: isBlocked ? 'Unhide' : 'Hide',
                icon: isBlocked ? 'EyeOutline' : 'EyeOffOutline',
                onPress: handleToggleBlockedToken,
              },
            ],
          },
        ]}
      />
    ),
    [handleToggleBlockedToken, isBlocked],
  );

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

  return (
    <Page>
      <Page.Header
        headerTitle={tokenInfo.name ?? tokenDetails?.info.name}
        headerRight={headerRight}
      />
      <Page.Body>
        <TxHistoryListView
          initialized={initialized}
          isLoading={isLoading}
          data={tokenHistory ?? []}
          onPressHistory={handleHistoryItemPress}
          ListHeaderComponent={
            <>
              {isBlocked ? (
                <Alert
                  icon="EyeOffOutline"
                  fullBleed
                  type="warning"
                  title="This token is currently hidden and won't appear in the list"
                  action={{
                    primary: 'Unhide',
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
                  <Stack ml="$3">
                    {isLoading ? (
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
                  <RawActions.Send onPress={handleSendPress} />
                  <RawActions.Receive onPress={handleReceivePress} />
                  <RawActions.Swap onPress={() => {}} />
                  <RawActions.Buy onPress={() => {}} />
                  <RawActions.Sell onPress={() => {}} />
                </RawActions>
              </Stack>

              {/* Banner – if this token can be staked */}
              <ListItem
                drillIn
                onPress={() => console.log('clicked')}
                py="$3"
                px="$5"
                mx="$0"
                bg="$bgSuccessSubdued"
                borderTopWidth={StyleSheet.hairlineWidth}
                borderColor="$borderSubdued"
                borderRadius="$0"
              >
                <Stack p="$3" borderRadius="$full" bg="$bgSuccess">
                  <Icon name="ChartColumnar3Outline" color="$iconSuccess" />
                </Stack>
                <ListItem.Text
                  flex={1}
                  primary="Stake and Earn"
                  secondary="Up to 3.77% in Annual Rewards"
                  secondaryTextProps={{
                    size: '$bodyMdMedium',
                    color: '$textSuccess',
                  }}
                />
              </ListItem>

              {/* History */}
              <Divider />
            </>
          }
        />
      </Page.Body>
    </Page>
  );
}
