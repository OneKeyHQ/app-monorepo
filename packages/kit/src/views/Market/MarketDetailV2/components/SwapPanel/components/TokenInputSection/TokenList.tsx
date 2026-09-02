import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { Skeleton, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { TokenListItem } from '@onekeyhq/kit/src/components/TokenListItem';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { MarketTestIDs } from '@onekeyhq/kit/src/views/Market/testIDs';
import { presetNetworksMap } from '@onekeyhq/shared/src/config/presetNetworks';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { SwitchToTradePrompt } from './SwitchToTradePrompt';

import type { IToken } from '../../types';

type IEnhancedToken = IToken & {
  balance?: string;
  price?: string;
  networkImageSrc?: string;
  valueProps?: { value: string; currency: string };
  error?: string;
};

type ITokenDetailsResult = {
  accountId?: string;
  tokens: IEnhancedToken[];
};

interface ITokenListProps {
  tokens?: IEnhancedToken[];
  onTokenPress?: (token: IToken) => void;
  onTradePress: () => void;
  disabledOnSwitchToTrade?: boolean;
  currentSelectToken?: ISwapToken;
  disableNativeToken?: boolean;
  // Caller-owned selection rule (e.g. the stock stable-coin whitelist): a
  // token it returns true for renders grayed out and cannot be selected.
  isTokenDisabled?: (token: IToken) => boolean;
  disableInternalTokenDetailFetch?: boolean;
  tokenDetailsLoading?: boolean;
  sortTokensByValue?: boolean;
}

export function TokenList({
  tokens = [],
  onTokenPress,
  onTradePress,
  disabledOnSwitchToTrade,
  currentSelectToken,
  disableNativeToken,
  isTokenDisabled,
  disableInternalTokenDetailFetch,
  tokenDetailsLoading,
  sortTokensByValue = true,
}: ITokenListProps) {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const currencySymbol = '$';
  const currentNetworkId = tokens[0]?.networkId;
  const shouldFetchTokenDetails = !disableInternalTokenDetailFetch;

  // get network account
  const networkAccount = usePromiseResult(
    async () => {
      if (
        !shouldFetchTokenDetails ||
        (!activeAccount?.indexedAccount?.id && !activeAccount?.account?.id) ||
        !currentNetworkId
      ) {
        return null;
      }
      const defaultDeriveType =
        await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
          networkId: currentNetworkId ?? '',
        });
      return backgroundApiProxy.serviceAccount.getNetworkAccount({
        accountId: activeAccount?.indexedAccount?.id
          ? undefined
          : activeAccount?.account?.id,
        indexedAccountId: activeAccount?.indexedAccount?.id ?? '',
        networkId: currentNetworkId,
        deriveType: defaultDeriveType ?? 'default',
      });
    },
    [
      activeAccount?.indexedAccount?.id,
      activeAccount?.account?.id,
      currentNetworkId,
      shouldFetchTokenDetails,
    ],
    {
      watchLoading: shouldFetchTokenDetails,
      undefinedResultIfError: true,
      undefinedResultIfReRun: true,
    },
  );

  // fetch token details
  const tokensWithDetails = usePromiseResult(
    async (): Promise<ITokenDetailsResult> => {
      const accountId = networkAccount.result?.id;
      if (!shouldFetchTokenDetails) {
        return { accountId, tokens };
      }
      if (!tokens.length || !networkAccount.result) {
        return {
          accountId,
          tokens: tokens.map((token) => ({
            ...token,
            error: 'Failed to fetch details',
          })),
        };
      }
      const promises = tokens.map(async (token): Promise<IEnhancedToken> => {
        try {
          const details =
            await backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
              networkId: token.networkId,
              contractAddress: token.contractAddress,
              accountId: networkAccount.result?.id,
              accountAddress: networkAccount.result?.address,
              currency: 'usd',
            });

          const swapTokenDetail = details?.[0];
          const priceBN = new BigNumber(swapTokenDetail?.price || 0);
          const balanceBN = new BigNumber(swapTokenDetail?.balanceParsed || 0);
          const valueProps =
            swapTokenDetail?.price && parseFloat(swapTokenDetail.price) > 0
              ? {
                  value: priceBN.multipliedBy(balanceBN).toFixed(2),
                  currency: currencySymbol,
                }
              : undefined;
          return {
            ...token,
            balance: swapTokenDetail?.balanceParsed ?? '0',
            price: swapTokenDetail?.price,
            valueProps,
          };
        } catch (error) {
          console.error(`Failed to fetch details for ${token.symbol}:`, error);
          return { ...token, error: 'Failed to fetch details' };
        }
      });
      return { accountId, tokens: await Promise.all(promises) };
    },
    [tokens, networkAccount.result, currencySymbol, shouldFetchTokenDetails],
    { watchLoading: shouldFetchTokenDetails },
  );

  const displayTokens = useMemo(() => {
    const mergedTokens = tokens.map((token) => {
      const tokenWithDetail = tokensWithDetails?.result?.tokens.find(
        (detailToken) =>
          detailToken.networkId === token.networkId &&
          detailToken.contractAddress === token.contractAddress,
      );
      const networkConfig = Object.values(presetNetworksMap).find(
        (network) => network.id === token.networkId,
      );
      return {
        ...token,
        ...tokenWithDetail,
        networkImageSrc: token.networkImageSrc ?? networkConfig?.logoURI,
      };
    });
    if (!sortTokensByValue) {
      return mergedTokens;
    }
    return mergedTokens.toSorted((a, b) => {
      const valueA = parseFloat(a.valueProps?.value || '0');
      const valueB = parseFloat(b.valueProps?.value || '0');
      return valueB - valueA;
    });
  }, [sortTokensByValue, tokensWithDetails?.result?.tokens, tokens]);

  const isTokenDetailsLoading =
    tokenDetailsLoading ??
    (shouldFetchTokenDetails &&
      (activeAccount?.ready !== true ||
        networkAccount.isLoading !== false ||
        tokensWithDetails.isLoading !== false ||
        // The first details run can settle before the network account resolves.
        // Keep sorted rows hidden until the result belongs to the current account.
        tokensWithDetails.result?.accountId !== networkAccount.result?.id));

  return (
    <YStack gap="$1" testID={MarketTestIDs.swapPanelTokenSelectorList}>
      <YStack px="$1" py="$1">
        {sortTokensByValue && isTokenDetailsLoading
          ? Array.from({ length: tokens.length || 3 }, (_, index) => (
              <ListItem key={index} margin={0}>
                <Skeleton radius="round" w="$10" h="$10" />
                <YStack>
                  <YStack py="$1">
                    <Skeleton h="$4" w="$32" />
                  </YStack>
                  <YStack py="$1">
                    <Skeleton h="$3" w="$24" />
                  </YStack>
                </YStack>
              </ListItem>
            ))
          : displayTokens?.map((token: IEnhancedToken) => {
              const isCurrentToken = Boolean(
                currentSelectToken &&
                equalTokenNoCaseSensitive({
                  token1: currentSelectToken,
                  token2: token,
                }),
              );
              const isTokenUnavailable = Boolean(
                (disableNativeToken && token.isNative) ||
                isTokenDisabled?.(token),
              );
              const onPress = () => {
                if (isCurrentToken || isTokenUnavailable) return;
                onTokenPress?.(token);
              };
              return (
                <TokenListItem
                  isLoading={isTokenDetailsLoading}
                  key={`${token.networkId}-${token.contractAddress}`}
                  tokenImageSrc={token.logoURI}
                  networkImageSrc={token.networkImageSrc}
                  tokenSymbol={token.symbol}
                  tokenName={token.name}
                  tokenSize="md"
                  balance={token.balance}
                  valueProps={token.valueProps}
                  onPress={onPress}
                  margin={0}
                  disabled={isTokenUnavailable}
                />
              );
            })}
      </YStack>
      {disabledOnSwitchToTrade ? null : (
        <SwitchToTradePrompt onTradePress={onTradePress} />
      )}
    </YStack>
  );
}
