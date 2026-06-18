import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { TokenListItem } from '@onekeyhq/kit/src/components/TokenListItem';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
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

interface ITokenListProps {
  tokens?: IEnhancedToken[];
  onTokenPress?: (token: IToken) => void;
  onTradePress: () => void;
  disabledOnSwitchToTrade?: boolean;
  currentSelectToken?: ISwapToken;
  disableNativeToken?: boolean;
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
  disableInternalTokenDetailFetch,
  tokenDetailsLoading,
  sortTokensByValue = true,
}: ITokenListProps) {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const currencySymbol = '$';
  const currentNetworkId = tokens[0]?.networkId;
  const shouldFetchTokenDetails = !disableInternalTokenDetailFetch;

  // get network account
  const networkAccount = usePromiseResult(async () => {
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
  }, [
    activeAccount?.indexedAccount?.id,
    activeAccount?.account?.id,
    currentNetworkId,
    shouldFetchTokenDetails,
  ]);

  // fetch token details
  const tokensWithDetails = usePromiseResult(
    async (): Promise<IEnhancedToken[]> => {
      if (!shouldFetchTokenDetails) {
        return tokens;
      }
      if (!tokens.length || !networkAccount.result) {
        return tokens.map((token) => ({
          ...token,
          error: 'Failed to fetch details',
        }));
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
          const networkConfig = Object.values(presetNetworksMap).find(
            (n) => n.id === token.networkId,
          );
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
            networkImageSrc: networkConfig?.logoURI,
            valueProps,
          };
        } catch (error) {
          console.error(`Failed to fetch details for ${token.symbol}:`, error);
          return { ...token, error: 'Failed to fetch details' };
        }
      });
      return Promise.all(promises);
    },
    [tokens, networkAccount.result, currencySymbol, shouldFetchTokenDetails],
    { watchLoading: shouldFetchTokenDetails },
  );

  const displayTokens = useMemo(() => {
    const mergedTokens = tokens.map((token) => {
      const tokenWithDetail = tokensWithDetails?.result?.find(
        (detailToken) =>
          detailToken.networkId === token.networkId &&
          detailToken.contractAddress === token.contractAddress,
      );
      return { ...token, ...tokenWithDetail };
    });
    if (!sortTokensByValue) {
      return mergedTokens;
    }
    return mergedTokens.toSorted((a, b) => {
      const valueA = parseFloat(a.valueProps?.value || '0');
      const valueB = parseFloat(b.valueProps?.value || '0');
      return valueB - valueA;
    });
  }, [sortTokensByValue, tokensWithDetails?.result, tokens]);

  const isTokenDetailsLoading =
    tokenDetailsLoading ??
    (!disableInternalTokenDetailFetch && tokensWithDetails.isLoading);

  return (
    <YStack gap="$1">
      <YStack px="$1" py="$1">
        {displayTokens?.map((token: IEnhancedToken) => {
          const isDisabled = Boolean(
            (currentSelectToken &&
              equalTokenNoCaseSensitive({
                token1: currentSelectToken,
                token2: token,
              })) ||
            (disableNativeToken && token.isNative),
          );
          const onPress = () => {
            if (isDisabled) return;
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
              disabled={isDisabled}
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
