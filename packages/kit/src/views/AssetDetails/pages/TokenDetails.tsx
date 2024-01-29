import { useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import type { IStackProps } from '@onekeyhq/components';
import {
  ActionList,
  Alert,
  Button,
  Divider,
  Heading,
  HeightTransition,
  Icon,
  Image,
  Page,
  SizableText,
  Stack,
  Toast,
  XGroup,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { TxHistoryListView } from '../../../components/TxHistoryListView';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { EModalRoutes } from '../../../routes/Modal/type';
import { getFormattedNumber } from '../../../utils/format';
import { EModalReceiveRoutes } from '../../Receive/router/type';
import { EModalSendRoutes } from '../../Send/router';
import { EModalAssetDetailRoutes } from '../router/types';

import type { IModalAssetDetailsParamList } from '../router/types';
import type { RouteProp } from '@react-navigation/core';

export function TokenDetails() {
  const intl = useIntl();
  const [isBlocked, setIsBlocked] = useState(false);
  const navigation = useAppNavigation();
  const media = useMedia();

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
    tokenAddress,
    isNative,
    tokenSymbol,
    tokenLogoURI,
  } = route.params;

  const getAccount = useCallback(
    async () =>
      backgroundApiProxy.serviceAccount.getAccountOfWallet({
        accountId,
        indexedAccountId: '',
        networkId,
        deriveType: 'default',
      }),
    [accountId, networkId],
  );

  const network = usePromiseResult(
    () => backgroundApiProxy.serviceNetwork.getNetwork({ networkId }),
    [networkId],
  ).result;

  const tokenDetails = usePromiseResult(async () => {
    const account = await getAccount();
    if (!account || !network) return;
    const r = await backgroundApiProxy.serviceToken.fetchTokenDetails({
      networkId,
      accountAddress: account.address,
      address: tokenAddress,
      isNative: !!isNative,
    });

    void backgroundApiProxy.serviceToken.updateLocalTokens({
      networkId,
      tokens: [r.info],
    });

    return r;
  }, [getAccount, isNative, network, networkId, tokenAddress]).result;
  const tokenHistory = usePromiseResult(async () => {
    const account = await getAccount();
    if (!account || !network) return;
    const r = backgroundApiProxy.serviceHistory.fetchAccountHistory({
      accountId: account.id,
      accountAddress: account.address,
      networkId,
      tokenAddress,
    });
    return r;
  }, [getAccount, network, networkId, tokenAddress]).result;

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
        token: tokenDetails?.info,
      },
    });
  }, [accountId, navigation, networkId, tokenDetails]);

  const headerTitle = useCallback(
    () => (
      <XStack alignItems="center">
        <Image
          circular
          width="$6"
          height="$6"
          source={{
            uri: tokenLogoURI ?? tokenDetails?.info.logoURI,
          }}
        />
        <Heading pl="$2" size="$headingLg">
          {tokenSymbol ?? tokenDetails?.info.symbol}
        </Heading>
      </XStack>
    ),
    [
      tokenDetails?.info.logoURI,
      tokenDetails?.info.symbol,
      tokenLogoURI,
      tokenSymbol,
    ],
  );

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
                label: isBlocked ? 'Unblock' : 'Block',
                icon: isBlocked ? 'EyeOutline' : 'EyeOffOutline',
                onPress: () => {
                  setIsBlocked(!isBlocked);
                },
              },
            ],
          },
        ]}
      />
    ),
    [isBlocked],
  );

  const renderTokenAddress = useCallback(() => {
    if (!tokenAddress) return null;
    return (
      <XGroup
        bg="$bgStrong"
        borderRadius="$2"
        separator={<Divider vertical borderColor="$bgApp" />}
      >
        <XStack
          alignItems="center"
          py="$0.5"
          px="$1.5"
          userSelect="none"
          style={{
            borderCurve: 'continuous',
          }}
          hoverStyle={{
            bg: '$bgHover',
          }}
          pressStyle={{
            bg: '$bgActive',
          }}
          $platform-native={{
            hitSlop: {
              top: 8,
              bottom: 8,
            },
          }}
          onPress={() =>
            Toast.success({
              title: 'Copied',
            })
          }
        >
          <Image
            width="$4"
            height="$4"
            source={{
              uri: 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/eth.png',
            }}
          />
          <SizableText pl="$1" size="$bodyMd" color="$textSubdued">
            {accountUtils.shortenAddress({ address: tokenAddress })}
          </SizableText>
        </XStack>
        {media.gtMd && (
          <Stack
            alignItems="center"
            justifyContent="center"
            py="$0.5"
            px="$1.5"
            hoverStyle={{
              bg: '$bgHover',
            }}
            pressStyle={{
              bg: '$bgActive',
            }}
            style={{
              borderCurve: 'continuous',
            }}
            $platform-native={
              {
                hitSlop: {
                  top: 8,
                  bottom: 8,
                  right: 8,
                },
              } as IStackProps
            }
          >
            <Icon size="$4" name="ShareOutline" color="$iconSubdued" />
          </Stack>
        )}
      </XGroup>
    );
  }, [media.gtMd, tokenAddress]);
  return (
    <Page scrollEnabled>
      <Page.Header headerTitle={headerTitle} headerRight={headerRight} />
      <Page.Body>
        <HeightTransition>
          {isBlocked && (
            <Stack key="alert">
              <Alert
                icon="EyeOffOutline"
                fullBleed
                type="info"
                title="This token is currently blocked and won't appear in the list"
                action={{
                  primary: 'Unblock',
                  onPrimaryPress: () => {
                    setIsBlocked(false);
                  },
                }}
              />
              <Stack h="$5" />
            </Stack>
          )}
        </HeightTransition>
        <Stack px="$5" pb="$5">
          <XStack alignItems="center">
            <SizableText flex={1} color="$textSubdued">
              {intl.formatMessage({ id: 'content__balance' })}
            </SizableText>
            {renderTokenAddress()}
          </XStack>
          <Stack
            $gtMd={{
              flexDirection: 'row',
              alignItems: 'baseline',
              space: '$2',
            }}
          >
            <Heading size="$heading5xl">
              {getFormattedNumber(tokenDetails?.balanceParsed ?? 0) ?? 0}
            </Heading>
            <SizableText size="$bodyLgMedium">{tokenValue}</SizableText>
          </Stack>
          <XStack pt="$5" space="$2.5">
            <Button onPress={handleSendPress}>Send</Button>
            <Button onPress={handleReceivePress}>Receive</Button>
            <Button>Swap</Button>
            <Button icon="DotHorOutline" pl="$2.5" pr="$0.5" />
          </XStack>
        </Stack>
        <Divider />
        <ListItem
          py="$3.5"
          avatarProps={{
            src: 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/usdc.png',
          }}
          title="USDC"
          titleProps={{
            size: '$bodyMdMedium',
          }}
          subtitle="3.77% APR"
          subtitleProps={{
            size: '$bodyLgMedium',
            color: '$textSuccess',
          }}
        >
          <Button variant="primary">Stake</Button>
        </ListItem>
        <Divider mb="$2.5" />
        <TxHistoryListView
          data={tokenHistory ?? []}
          onPressHistory={handleHistoryItemPress}
        />
      </Page.Body>
    </Page>
  );
}
