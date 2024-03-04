import { useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  ActionList,
  Alert,
  Divider,
  Heading,
  Icon,
  Page,
  SizableText,
  Stack,
  Toast,
  XStack,
} from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { Token } from '../../../components/Token';
import { TxHistoryListView } from '../../../components/TxHistoryListView';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { EModalRoutes } from '../../../routes/Modal/type';
import { getFormattedNumber } from '../../../utils/format';
import { RawActions } from '../../Home/components/WalletActions/RawActions';
import { EModalReceiveRoutes } from '../../Receive/router/type';
import { EModalSendRoutes } from '../../Send/router';
import { EModalAssetDetailRoutes } from '../router/types';

import type { IModalAssetDetailsParamList } from '../router/types';
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

  const [settings] = useSettingsPersistAtom();

  const {
    accountId,
    networkId,
    tokenInfo,
    isBlocked: tokenIsBlocked,
  } = route.params;

  const [isBlocked, setIsBlocked] = useState(!!tokenIsBlocked);

  const { result: [tokenHistory, tokenDetails, network] = [] } =
    usePromiseResult(async () => {
      const [account, serverNetwork] = await Promise.all([
        backgroundApiProxy.serviceAccount.getAccount({
          accountId,
          networkId,
        }),
        backgroundApiProxy.serviceNetwork.getNetwork({ networkId }),
      ]);
      if (!account) return;

      const [history, details] = await Promise.all([
        backgroundApiProxy.serviceHistory.fetchAccountHistory({
          accountId: account.id,
          accountAddress: account.address,
          networkId,
          tokenIdOnNetwork: tokenInfo.address,
        }),
        backgroundApiProxy.serviceToken.fetchTokensDetails({
          networkId,
          accountAddress: account.address,
          contractList: [tokenInfo.address],
        }),
      ]);

      return [history, details[0], serverNetwork];
    }, [accountId, networkId, tokenInfo.address]);

  const tokenValue = useMemo(
    () =>
      `${settings.currencyInfo.symbol}${intl.formatNumber(
        new BigNumber(tokenDetails?.fiatValue ?? 0).toNumber(),
      )}`,
    [intl, settings.currencyInfo.symbol, tokenDetails?.fiatValue],
  );

  const handleReceivePress = useCallback(() => {
    navigation.pushFullModal(EModalRoutes.ReceiveModal, {
      screen: EModalReceiveRoutes.LightingInvoice,
    });
  }, [navigation]);

  const handleHistoryItemPress = useCallback(() => {
    navigation.push(EModalAssetDetailRoutes.HistoryDetails);
  }, [navigation]);

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
    <Page scrollEnabled>
      <Page.Header
        headerTitle={tokenInfo.name ?? tokenDetails?.info.name}
        headerRight={headerRight}
      />
      <Page.Body>
        {isBlocked && (
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
        )}

        {/* Overview */}
        <Stack px="$5" pb="$5">
          {/* Balance */}
          <XStack alignItems="center" mb="$5">
            <Token
              tokenImageUri={tokenInfo.logoURI ?? tokenDetails?.info.logoURI}
              size="xl"
            />
            <Stack ml="$3">
              <Heading size="$heading3xl">
                {/* TODO: Loading state */}
                {getFormattedNumber(tokenDetails?.balanceParsed ?? 0) ?? 0}{' '}
                {tokenInfo.symbol}
              </Heading>
              <SizableText color="$textSubdued" size="$bodyLgMedium">
                {tokenValue}
              </SizableText>
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
        <Divider mb="$2.5" />
        <TxHistoryListView
          data={tokenHistory ?? []}
          onPressHistory={handleHistoryItemPress}
        />
      </Page.Body>
    </Page>
  );
}
