import type { PropsWithChildren } from 'react';
import { memo, useCallback, useMemo } from 'react';

import type { IXStackProps } from '@onekeyhq/components';
import { Divider, Skeleton, Stack, XStack, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { ReviewControl } from '@onekeyhq/kit/src/components/ReviewControl';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useReceiveToken } from '@onekeyhq/kit/src/hooks/useReceiveToken';
import { RawActions } from '@onekeyhq/kit/src/views/Home/components/WalletActions/RawActions';
import { TokenDetailStakingEntry } from '@onekeyhq/kit/src/views/Staking/components/TokenDetailStakingEntry';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { WALLET_TYPE_WATCHING } from '@onekeyhq/shared/src/consts/dbConsts';
import {
  EModalRoutes,
  EModalSendRoutes,
  EModalSwapRoutes,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import ActionBuy from './ActionBuy';
import ActionSell from './ActionSell';

import type { IProps } from '.';

function ActionsRowContainer(props: PropsWithChildren<IXStackProps>) {
  return (
    <XStack
      justifyContent="space-between"
      $gtSm={{
        gap: '$2',
        justifyContent: 'flex-start',
      }}
      {...props}
    />
  );
}

function TokenDetailsHeader(
  props: IProps & {
    setOverviewInit: (value: boolean) => void;
    overviewInit: boolean;
    historyInit: boolean;
  },
) {
  const {
    accountId,
    networkId,
    walletId,
    deriveInfo,
    deriveType,
    tokenInfo,
    isAllNetworks,
    indexedAccountId,
    setOverviewInit,
    overviewInit,
    historyInit,
  } = props;
  const navigation = useAppNavigation();

  const [settings] = useSettingsPersistAtom();

  const { network, wallet } = useAccountData({
    accountId,
    networkId,
    walletId,
  });

  const { handleOnReceive } = useReceiveToken({
    accountId,
    networkId,
    walletId,
    deriveInfo,
    deriveType,
  });

  const initialized = useMemo(
    () => overviewInit && historyInit,
    [overviewInit, historyInit],
  );

  const { result: tokenDetails, isLoading: isLoadingTokenDetails } =
    usePromiseResult(
      async () => {
        const tokensDetails =
          await backgroundApiProxy.serviceToken.fetchTokensDetails({
            accountId,
            networkId,
            contractList: [tokenInfo.address],
          });
        setOverviewInit(true);
        return tokensDetails[0];
      },
      [accountId, networkId, setOverviewInit, tokenInfo.address],
      {
        watchLoading: true,
      },
    );

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
    ],
  );

  const handleOnSwap = createSwapActionHandler(ESwapTabSwitchType.SWAP);
  const handleOnBridge = createSwapActionHandler(ESwapTabSwitchType.BRIDGE);

  const handleSendPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.SendModal, {
      screen: EModalSendRoutes.SendDataInput,
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
    if (isLoadingTokenDetails)
      return <Skeleton radius="round" h="$12" w="$12" />;
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
    isLoadingTokenDetails,
    network?.logoURI,
    networkId,
    tokenDetails?.info.logoURI,
    tokenInfo.logoURI,
  ]);

  return (
    <>
      {/* Overview */}
      <Stack px="$5" py="$5">
        {/* Balance */}
        <XStack alignItems="center" mb="$5">
          {renderTokenIcon()}
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
        <RawActions flexDirection="column" gap="$5">
          <ActionsRowContainer>
            <ReviewControl>
              <ActionBuy
                networkId={networkId}
                accountId={accountId}
                walletType={wallet?.type}
                tokenAddress={tokenInfo.address}
                disabled={!initialized}
              />
            </ReviewControl>

            <RawActions.Swap
              onPress={handleOnSwap}
              disabled={disableSwapAction || !initialized}
            />
            <RawActions.Bridge
              onPress={handleOnBridge}
              disabled={disableSwapAction || !initialized}
            />
            <ReviewControl>
              <ActionSell
                networkId={networkId}
                accountId={accountId}
                walletType={wallet?.type}
                tokenAddress={tokenInfo.address}
                disabled={!initialized}
              />
            </ReviewControl>
          </ActionsRowContainer>
          <ActionsRowContainer>
            <RawActions.Send
              onPress={handleSendPress}
              disabled={!initialized}
            />
            <RawActions.Receive
              disabled={isReceiveDisabled || !initialized}
              onPress={() => handleOnReceive(tokenInfo)}
            />
            <Stack
              w={50}
              $gtSm={{
                display: 'none',
              }}
            />
            <Stack
              w={50}
              $gtSm={{
                display: 'none',
              }}
            />
          </ActionsRowContainer>
        </RawActions>
      </Stack>
      <TokenDetailStakingEntry
        networkId={networkId}
        accountId={accountId}
        indexedAccountId={indexedAccountId}
        tokenAddress={tokenInfo.address}
      />
      {/* History */}
      <Divider mb="$3" />
    </>
  );
}

export default memo(TokenDetailsHeader);
