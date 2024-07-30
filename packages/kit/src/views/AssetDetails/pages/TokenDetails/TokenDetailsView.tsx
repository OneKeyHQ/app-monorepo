import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  Divider,
  NumberSizeableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ReviewControl } from '@onekeyhq/kit/src/components/ReviewControl';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { TxHistoryListView } from '@onekeyhq/kit/src/components/TxHistoryListView';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useReceiveToken } from '@onekeyhq/kit/src/hooks/useReceiveToken';
import { ProviderJotaiContextHistoryList } from '@onekeyhq/kit/src/states/jotai/contexts/historyList';
import { RawActions } from '@onekeyhq/kit/src/views/Home/components/WalletActions/RawActions';
import { StakingApr } from '@onekeyhq/kit/src/views/Staking/components/StakingApr';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  IAccountDeriveInfo,
  IAccountDeriveTypes,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { WALLET_TYPE_WATCHING } from '@onekeyhq/shared/src/consts/dbConsts';
import { POLLING_INTERVAL_FOR_HISTORY } from '@onekeyhq/shared/src/consts/walletConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EModalRoutes,
  EModalSendRoutes,
  EModalSwapRoutes,
} from '@onekeyhq/shared/src/routes';
import { EModalAssetDetailRoutes } from '@onekeyhq/shared/src/routes/assetDetails';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import type { IToken } from '@onekeyhq/shared/types/token';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import ActionBuy from './ActionBuy';
import ActionSell from './ActionSell';

type IProps = {
  accountId: string;
  networkId: string;
  walletId: string;
  deriveInfo: IAccountDeriveInfo;
  deriveType: IAccountDeriveTypes;
  tokenInfo: IToken;
  isBlocked?: boolean;
  riskyTokens?: string[];
  isAllNetworks?: boolean;
};

export function TokenDetailsViews(props: IProps) {
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

  const [initialized, setInitialized] = useState(false);

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

  /**
   * since some tokens are slow to load history,
   * they are loaded separately from the token details
   * so as not to block the display of the top details.
   */
  const {
    result: tokenHistory,
    isLoading: isLoadingTokenHistory,
    run,
  } = usePromiseResult(
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
    {
      watchLoading: true,
      pollingInterval: POLLING_INTERVAL_FOR_HISTORY,
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

  const handleHistoryItemPress = useCallback(
    async (tx: IAccountHistoryTx) => {
      if (
        tx.decodedTx.status === EDecodedTxStatus.Pending &&
        tx.isLocalCreated
      ) {
        const localTx =
          await backgroundApiProxy.serviceHistory.getLocalHistoryTxById({
            accountId,
            networkId,
            historyId: tx.id,
          });

        // tx has been replaced by another tx
        if (!localTx || localTx.replacedNextId) {
          return;
        }
      }

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

  const isReceiveDisabled = useMemo(
    () => wallet?.type === WALLET_TYPE_WATCHING,
    [wallet?.type],
  );

  useEffect(() => {
    const reloadCallback = () => run({ alwaysSetState: true });
    appEventBus.on(EAppEventBusNames.HistoryTxStatusChanged, reloadCallback);
    return () => {
      appEventBus.off(EAppEventBusNames.HistoryTxStatusChanged, reloadCallback);
    };
  }, [run]);

  return (
    <ProviderJotaiContextHistoryList>
      <TxHistoryListView
        initialized={initialized}
        isLoading={isLoadingTokenHistory}
        data={tokenHistory ?? []}
        onPressHistory={handleHistoryItemPress}
        ListHeaderComponent={
          <>
            {/* Overview */}
            <Stack px="$5" pb="$5">
              {/* Balance */}
              <XStack alignItems="center" mb="$5">
                <Token
                  tokenImageUri={
                    tokenInfo.logoURI ?? tokenDetails?.info.logoURI
                  }
                  size="xl"
                  networkImageUri={isAllNetworks ? network?.logoURI : ''}
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
  );
}
