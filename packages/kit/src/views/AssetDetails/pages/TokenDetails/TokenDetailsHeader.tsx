import { memo, useCallback, useMemo } from 'react';

import { type IProps } from '.';

import { useIntl } from 'react-intl';

import {
  DebugRenderTracker,
  Divider,
  Icon,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  useTabIsRefreshingFocused,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { ReviewControl } from '@onekeyhq/kit/src/components/ReviewControl';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useCopyAccountAddress } from '@onekeyhq/kit/src/hooks/useCopyAccountAddress';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useReceiveToken } from '@onekeyhq/kit/src/hooks/useReceiveToken';
import { RawActions } from '@onekeyhq/kit/src/views/Home/components/WalletActions/RawActions';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { WALLET_TYPE_WATCHING } from '@onekeyhq/shared/src/consts/dbConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalRoutes,
  EModalSignatureConfirmRoutes,
  EModalSwapRoutes,
} from '@onekeyhq/shared/src/routes';
import { listItemPressStyle } from '@onekeyhq/shared/src/style';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import { WalletActionEarn } from '../../../Home/components/WalletActions/WalletActionEarn';

import ActionBuy from './ActionBuy';
import ActionSell from './ActionSell';
import { useTokenDetailsContext } from './TokenDetailsContext';

function TokenDetailsHeader(props: IProps) {
  const {
    accountId,
    networkId,
    walletId,
    deriveInfo,
    deriveType,
    tokenInfo,
    isAllNetworks,
    indexedAccountId,
    isTabView,
  } = props;
  const navigation = useAppNavigation();
  const intl = useIntl();
  const copyAccountAddress = useCopyAccountAddress();
  const {
    updateTokenMetadata,
    isLoadingTokenDetails,
    updateIsLoadingTokenDetails,
    tokenDetails: tokenDetailsContext,
    updateTokenDetails,
  } = useTokenDetailsContext();

  const [settings] = useSettingsPersistAtom();

  const { network, wallet, account } = useAccountData({
    accountId,
    networkId,
    walletId,
  });

  const { handleOnReceive } = useReceiveToken({
    accountId,
    networkId,
    walletId,
  });

  const { isFocused } = useTabIsRefreshingFocused();

  const { result: tokenDetailsResult } = usePromiseResult(
    async () => {
      updateIsLoadingTokenDetails({
        accountId,
        isLoading: true,
      });
      const tokensDetails =
        await backgroundApiProxy.serviceToken.fetchTokensDetails({
          accountId,
          networkId,
          contractList: [tokenInfo.address],
        });
      updateTokenMetadata({
        price: tokensDetails[0].price,
        priceChange24h: tokensDetails[0].price24h,
        coingeckoId: tokensDetails[0].info.coingeckoId,
      });
      updateTokenDetails({
        accountId,
        isInit: true,
        data: tokensDetails[0],
      });
      updateIsLoadingTokenDetails({
        accountId,
        isLoading: false,
      });
      return tokensDetails[0];
    },
    [
      accountId,
      updateIsLoadingTokenDetails,
      networkId,
      tokenInfo.address,
      updateTokenMetadata,
      updateTokenDetails,
    ],
    {
      overrideIsFocused: (isPageFocused) =>
        isPageFocused && (isTabView ? isFocused : true),
    },
  );

  const tokenDetails =
    tokenDetailsResult ?? tokenDetailsContext[accountId]?.data;

  const showLoadingState = useMemo(() => {
    if (tokenDetailsContext[accountId]?.init) {
      return false;
    }
    return isLoadingTokenDetails?.[accountId];
  }, [isLoadingTokenDetails, tokenDetailsContext, accountId]);

  const createSwapActionHandler = useCallback(
    (actionType?: ESwapTabSwitchType) => async () => {
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
          importDeriveType: deriveType,
          ...(actionType && {
            swapTabSwitchType: actionType,
          }),
        },
      });
    },
    [
      navigation,
      network?.logoURI,
      networkId,
      tokenInfo.address,
      tokenInfo.decimals,
      tokenInfo.isNative,
      tokenInfo.logoURI,
      tokenInfo.name,
      tokenInfo.symbol,
      deriveType,
    ],
  );

  const handleOnSwap = createSwapActionHandler(ESwapTabSwitchType.SWAP);
  const handleOnBridge = createSwapActionHandler(ESwapTabSwitchType.BRIDGE);

  const handleSendPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.SignatureConfirmModal, {
      screen: EModalSignatureConfirmRoutes.TxDataInput,
      params: {
        networkId,
        accountId,
        isNFT: false,
        token: tokenDetails?.info ?? tokenInfo,
        isAllNetworks,
      },
    });
  }, [
    accountId,
    isAllNetworks,
    navigation,
    networkId,
    tokenDetails?.info,
    tokenInfo,
  ]);

  const isReceiveDisabled = useMemo(
    () => wallet?.type === WALLET_TYPE_WATCHING,
    [wallet?.type],
  );

  const disableSwapAction = useMemo(
    () => accountUtils.isUrlAccountFn({ accountId }),
    [accountId],
  );

  const renderTokenIcon = useCallback(() => {
    if (showLoadingState) {
      return <Skeleton radius="round" h="$12" w="$12" />;
    }
    return (
      <Token
        tokenImageUri={tokenInfo.logoURI ?? tokenDetails?.info.logoURI}
        size="xl"
        networkImageUri={isAllNetworks ? network?.logoURI : ''}
        showNetworkIcon={isAllNetworks}
        networkId={networkId}
      />
    );
  }, [
    isAllNetworks,
    network?.logoURI,
    networkId,
    tokenDetails?.info.logoURI,
    tokenInfo.logoURI,
    showLoadingState,
  ]);

  return (
    <DebugRenderTracker timesBadgePosition="top-right">
      <>
        {/* Overview */}
        <Stack px="$5" pb="$5" pt={isTabView ? '$5' : '$0'}>
          {/* Balance */}
          <XStack alignItems="center" mb="$5">
            {renderTokenIcon()}
            <Stack ml="$3" flex={1}>
              {showLoadingState ? (
                <Skeleton.Group show>
                  <Skeleton.Heading3Xl />
                  <Skeleton.BodyLg />
                </Skeleton.Group>
              ) : (
                <>
                  <NumberSizeableTextWrapper
                    hideValue
                    size="$heading3xl"
                    formatter="balance"
                    formatterOptions={{ tokenSymbol: tokenInfo.symbol }}
                  >
                    {tokenDetails?.balanceParsed ?? '0'}
                  </NumberSizeableTextWrapper>
                  <NumberSizeableTextWrapper
                    hideValue
                    formatter="value"
                    formatterOptions={{
                      currency: settings.currencyInfo.symbol,
                    }}
                    color="$textSubdued"
                    size="$bodyLgMedium"
                  >
                    {tokenDetails?.fiatValue ?? '0'}
                  </NumberSizeableTextWrapper>
                </>
              )}
            </Stack>
          </XStack>
          {/* Actions */}
          <RawActions gap="$8" flexWrap="wrap" flexDirection="row">
            <ReviewControl>
              <ActionBuy
                networkId={networkId}
                accountId={accountId}
                walletType={wallet?.type}
                tokenAddress={tokenInfo.address}
              />
            </ReviewControl>

            <RawActions.Swap
              onPress={handleOnSwap}
              disabled={disableSwapAction}
            />
            <RawActions.Bridge
              onPress={handleOnBridge}
              disabled={disableSwapAction}
            />
            <ReviewControl>
              <ActionSell
                networkId={networkId}
                accountId={accountId}
                walletType={wallet?.type}
                tokenAddress={tokenInfo.address}
              />
            </ReviewControl>
            <RawActions.Send onPress={handleSendPress} />
            <RawActions.Receive
              disabled={isReceiveDisabled}
              onPress={() => handleOnReceive(tokenInfo)}
            />
            <WalletActionEarn
              accountId={accountId}
              tokenAddress={tokenInfo.address}
              networkId={networkId}
              indexedAccountId={indexedAccountId}
            />
            <Stack w={50} />
          </RawActions>
        </Stack>
        {!networkUtils.isLightningNetworkByNetworkId(networkId) ? (
          <>
            <Divider />
            <YStack
              onPress={() =>
                copyAccountAddress({
                  accountId,
                  networkId,
                })
              }
              px="$5"
              py="$3"
              {...listItemPressStyle}
            >
              <XStack
                alignItems="center"
                justifyContent="space-between"
                gap="$4"
              >
                <YStack gap="$1" flex={1}>
                  <SizableText size="$bodyMd" color="$textSubdued">
                    {intl.formatMessage({
                      id: ETranslations.global_my_address,
                    })}
                  </SizableText>
                  {showLoadingState ? (
                    <Skeleton.BodyMd />
                  ) : (
                    <SizableText size="$bodyMd" color="$text" flexWrap="wrap">
                      {accountUtils.isHwWallet({ walletId }) ||
                      accountUtils.isQrWallet({ walletId })
                        ? accountUtils.shortenAddress({
                            address: account?.address ?? '',
                          })
                        : account?.address}
                    </SizableText>
                  )}
                </YStack>
                <Icon name="Copy3Outline" color="$iconSubdued" />
              </XStack>
            </YStack>
          </>
        ) : null}
        {/* History */}
        <Divider mb="$3" />
      </>
    </DebugRenderTracker>
  );
}

export default memo(TokenDetailsHeader);
