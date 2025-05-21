import { useEffect, useMemo, useState } from 'react';

import { YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { TokenListItem } from '@onekeyhq/kit/src/components/TokenListItem';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { presetNetworksMap } from '@onekeyhq/shared/src/config/presetNetworks';

import { SwitchToTradePrompt } from './SwitchToTradePrompt';

import type { IToken } from '../../types';

interface ITokenListProps {
  tokens?: IToken[];
  onTokenPress?: (token: IToken) => void;
}

type IListToken = IToken & {
  balance?: string;
  price?: string;
  fiatValue?: string;
};

const LOG_PREFIX = '[TokenList]';

function log(...args: any[]) {
  console.log(LOG_PREFIX, ...args);
}

export function TokenList({
  tokens: initialTokens,
  onTokenPress,
}: ITokenListProps) {
  log('component rendered', { initialTokens });
  const [enrichedTokens, setEnrichedTokens] = useState<IToken[]>([]);
  const { activeAccount } = useActiveAccount({ num: 0 });
  const [settingsPersistAtom] = useSettingsPersistAtom();
  const currencySymbol = settingsPersistAtom.currencyInfo.symbol;

  useEffect(() => {
    log('useEffect triggered', {
      initialTokens,
      activeAccount: activeAccount.account,
    });
    const fetchTokenDetails = async () => {
      log('fetchTokenDetails called');
      if (
        !initialTokens ||
        initialTokens.length === 0 ||
        !activeAccount.account?.id
      ) {
        log(
          'fetchTokenDetails - no initialTokens or active account, setting enrichedTokens to initialTokens',
        );
        setEnrichedTokens(initialTokens || []);
        return;
      }

      const { id: accountId, address: accountAddress } = activeAccount.account;

      log('fetchTokenDetails - fetching details for account', {
        accountId,
        accountAddress,
      });

      const promises = initialTokens.map(async (token) => {
        try {
          const fetchTokenDetailsParams = {
            networkId: token.networkId,
            contractAddress: token.contractAddress,
            accountId,
            accountAddress: accountAddress || undefined,
          };

          log(
            'fetchTokenDetails - fetching for token',
            fetchTokenDetailsParams,
          );

          const details =
            await backgroundApiProxy.serviceSwap.fetchSwapTokenDetails(
              fetchTokenDetailsParams,
            );
          const swapTokenDetail = details?.[0];

          log('fetchTokenDetails - fetched details for token', {
            details,
            ...fetchTokenDetailsParams,
          });

          return {
            ...token,
            balance: swapTokenDetail?.balanceParsed,
            price: swapTokenDetail?.price,
            fiatValue: swapTokenDetail?.fiatValue,
          };
        } catch (e) {
          console.error(
            LOG_PREFIX,
            `Failed to fetch details for ${token.symbol} on ${token.networkId}`,
            e,
          );
          return token;
        }
      });
      const newEnrichedTokens = await Promise.all(promises);

      log(
        'fetchTokenDetails - all promises resolved, newEnrichedTokens:',
        newEnrichedTokens,
      );
      setEnrichedTokens(newEnrichedTokens);
    };

    void fetchTokenDetails();
  }, [initialTokens, activeAccount.account]);

  const displayTokens: (IListToken & {
    networkImageSrc?: string;
    valueProps?: { value: string; currency: string };
  })[] = useMemo(() => {
    log('useMemo displayTokens triggered', {
      initialTokens,
      enrichedTokens,
    });

    if (!initialTokens || initialTokens.length === 0) {
      log('useMemo displayTokens - no initialTokens, returning initialTokens');
      return initialTokens || [];
    }

    if (enrichedTokens.length === 0 && initialTokens.length > 0) {
      log(
        'useMemo displayTokens - no enrichedTokens but initialTokens exist, returning initialTokens',
      );
      return initialTokens.map((token) => {
        const networkConfig = Object.values(presetNetworksMap).find(
          (n) => n.id === token.networkId,
        );
        const tokenAsListToken = token as IListToken;
        const valueProps =
          tokenAsListToken.fiatValue &&
          parseFloat(tokenAsListToken.fiatValue) > 0
            ? {
                value: tokenAsListToken.fiatValue,
                currency: currencySymbol,
              }
            : undefined;
        return {
          ...token,
          networkImageSrc: networkConfig?.logoURI,
          valueProps,
        };
      });
    }

    const result = initialTokens.map((initialToken) => {
      const foundEnrichedToken = enrichedTokens.find(
        (et) =>
          et.networkId === initialToken.networkId &&
          et.contractAddress === initialToken.contractAddress,
      );
      const tokenToProcess = (foundEnrichedToken || initialToken) as IListToken;
      const networkConfig = Object.values(presetNetworksMap).find(
        (n) => n.id === tokenToProcess.networkId,
      );
      const valueProps =
        tokenToProcess.fiatValue && parseFloat(tokenToProcess.fiatValue) > 0
          ? {
              value: tokenToProcess.fiatValue,
              currency: currencySymbol,
            }
          : undefined;
      return {
        ...tokenToProcess,
        networkImageSrc: networkConfig?.logoURI,
        valueProps,
      };
    });

    log('useMemo displayTokens - calculated result:', result);
    return result;
  }, [initialTokens, enrichedTokens, currencySymbol]);

  log('TokenList displayTokens', displayTokens);

  return (
    <YStack gap="$1">
      <YStack gap="$1" px="$1" py="$1">
        {displayTokens?.map((token) => (
          <TokenListItem
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

      <SwitchToTradePrompt />
    </YStack>
  );
}
