import { memo, useCallback, useMemo } from 'react';

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

import ActionBuy from './ActionBuy';
import ActionSell from './ActionSell';

import type { IProps } from '.';

function TokenDetailsHeader(props: IProps) {
  const {
    accountId,
    networkId,
    walletId,
    deriveInfo,
    deriveType,
    tokenInfo,
    isAllNetworks,
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

  const isReceiveDisabled = useMemo(
    () => wallet?.type === WALLET_TYPE_WATCHING,
    [wallet?.type],
  );

  const renderTokenIcon = useCallback(() => {
    if (isLoadingTokenDetails)
      return <Skeleton radius="round" h="$12" w="$12" />;
    return (
      <Token
        tokenImageUri={tokenInfo.logoURI ?? tokenDetails?.info.logoURI}
        size="xl"
        networkImageUri={isAllNetworks ? network?.logoURI : ''}
      />
    );
  }, [
    isAllNetworks,
    isLoadingTokenDetails,
    network?.logoURI,
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
        <RawActions>
          <ReviewControl>
            <ActionBuy
              networkId={networkId}
              accountId={accountId}
              walletType={wallet?.type}
              tokenAddress={tokenInfo.address}
            />
          </ReviewControl>

          <RawActions.Swap onPress={handleOnSwap} />

          <RawActions.Send onPress={handleSendPress} />
          <RawActions.Receive
            disabled={isReceiveDisabled}
            onPress={() => handleOnReceive(tokenInfo)}
          />
          <ReviewControl>
            <ActionSell
              networkId={networkId}
              accountId={accountId}
              walletType={wallet?.type}
              tokenAddress={tokenInfo.address}
            />
          </ReviewControl>
        </RawActions>
      </Stack>
      <TokenDetailStakingEntry
        networkId={networkId}
        accountId={accountId}
        tokenAddress={tokenInfo.address}
      />
      {/* History */}
      <Divider mb="$3" />
    </>
  );
}

export default memo(TokenDetailsHeader);
