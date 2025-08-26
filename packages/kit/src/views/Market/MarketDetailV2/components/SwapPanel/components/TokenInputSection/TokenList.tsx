import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { isNil } from 'lodash';

import { YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { TokenListItem } from '@onekeyhq/kit/src/components/TokenListItem';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { presetNetworksMap } from '@onekeyhq/shared/src/config/presetNetworks';

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
  tokens?: IToken[];
  onTokenPress?: (token: IToken) => void;
  onTradePress: () => void;
}

export function TokenList({
  tokens = [],
  onTokenPress,
  onTradePress,
}: ITokenListProps) {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const [settingsPersistAtom] = useSettingsPersistAtom();
  const currencySymbol = settingsPersistAtom.currencyInfo.symbol;
  const currentNetworkId = tokens[0]?.networkId;

  // get network account
  const networkAccount = usePromiseResult(async () => {
    if (
      (!activeAccount?.indexedAccount?.id && !activeAccount?.account?.id) ||
      !currentNetworkId
    ) {
      return null;
    }

    return backgroundApiProxy.serviceAccount.getNetworkAccount({
      accountId: activeAccount?.indexedAccount?.id
        ? undefined
        : activeAccount?.account?.id,
      indexedAccountId: activeAccount?.indexedAccount?.id ?? '',
      networkId: currentNetworkId,
      deriveType: activeAccount.deriveType ?? 'default',
    });
  }, [
    activeAccount?.indexedAccount?.id,
    activeAccount?.account?.id,
    activeAccount.deriveType,
    currentNetworkId,
  ]);

  // fetch token details
  const tokensWithDetails = usePromiseResult(async (): Promise<
    IEnhancedToken[]
  > => {
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
  }, [tokens, networkAccount.result, currencySymbol]);

  const displayTokens = useMemo(() => {
    return tokens
      .map((token) => {
        const tokenWithDetail = tokensWithDetails?.result?.find(
          (detailToken) =>
            detailToken.networkId === token.networkId &&
            detailToken.contractAddress === token.contractAddress,
        );
        return { ...token, ...(tokenWithDetail ?? {}) };
      })
      .sort((a, b) => {
        const valueA = parseFloat(a.valueProps?.value || '0');
        const valueB = parseFloat(b.valueProps?.value || '0');
        return valueB - valueA;
      });
  }, [tokensWithDetails?.result, tokens]);

  return (
    <YStack gap="$1">
      <YStack gap="$1" px="$1" py="$1">
        {displayTokens?.map((token: IEnhancedToken) => (
          <TokenListItem
            isLoading={Boolean(isNil(token.balance) && !token.error)}
            key={`${token.networkId}-${token.contractAddress}`}
            tokenImageSrc={token.logoURI}
            networkImageSrc={token.networkImageSrc}
            tokenSymbol={token.symbol}
            tokenName={token.name}
            balance={token.balance}
            valueProps={token.valueProps}
            onPress={() => onTokenPress?.(token)}
            margin={0}
          />
        ))}
      </YStack>

      <SwitchToTradePrompt onTradePress={onTradePress} />
    </YStack>
  );
}
