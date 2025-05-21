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
  onTradePress: () => void;
}

type IListToken = IToken & {
  balance?: string;
  price?: string;
  networkImageSrc?: string;
  valueProps?: { value: string; currency: string };
};

const LOG_PREFIX = '[TokenList]';

function log(...args: any[]) {
  console.log(LOG_PREFIX, ...args);
}

export function TokenList({
  tokens: initialTokens,
  onTokenPress,
  onTradePress,
}: ITokenListProps) {
  log('component rendered', { initialTokens });
  const [detailedTokens, setDetailedTokens] = useState<IListToken[]>([]);
  const { activeAccount } = useActiveAccount({ num: 0 });
  const [settingsPersistAtom] = useSettingsPersistAtom();
  const currencySymbol = settingsPersistAtom.currencyInfo.symbol;
  const innerTokens: IListToken[] = useMemo(() => {
    return (
      initialTokens?.map((token) => {
        return {
          ...token,
          price: undefined,
          balance: undefined,
          networkImageSrc: undefined,
          valueProps: undefined,
        };
      }) ?? []
    );
  }, [initialTokens]);

  useEffect(() => {
    log('useEffect triggered for fetchTokenDetails', {
      innerTokensLength: innerTokens.length,
      activeAccountId: activeAccount.account?.id,
    });
    const fetchTokenDetails = async () => {
      log('fetchTokenDetails called');
      if (
        !innerTokens ||
        innerTokens.length === 0 ||
        !activeAccount.account?.id
      ) {
        log(
          'fetchTokenDetails - no innerTokens or active account, setting detailedTokens to innerTokens structure or empty array',
        );
        setDetailedTokens(innerTokens || []);
        return;
      }

      const { id: accountId, address: accountAddress } = activeAccount.account;

      log('fetchTokenDetails - fetching details for account', {
        accountId,
        accountAddress,
      });

      const promises = innerTokens.map(async (token) => {
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
          } as IListToken;
        } catch (e) {
          console.error(
            LOG_PREFIX,
            `Failed to fetch details for ${token.symbol} on ${token.networkId}`,
            e,
          );
          return token;
        }
      });
      const newDetailedTokens = await Promise.all(promises);

      log(
        'fetchTokenDetails - all promises resolved, newDetailedTokens count:',
        newDetailedTokens.length,
      );
      setDetailedTokens(newDetailedTokens);
    };

    void fetchTokenDetails();
  }, [innerTokens, activeAccount.account]);

  const displayTokens: IListToken[] = useMemo(() => {
    log('useMemo displayTokens triggered', {
      innerTokensLength: innerTokens.length,
      detailedTokensLength: detailedTokens.length,
      currencySymbol,
    });

    if (detailedTokens.length === 0) {
      return innerTokens;
    }

    return innerTokens.map((iToken) => {
      const dToken = detailedTokens.find(
        (dt) =>
          dt.networkId === iToken.networkId &&
          dt.contractAddress === iToken.contractAddress,
      );

      const priceToUse = dToken?.price;
      const balanceToUse = dToken?.balance;

      const networkConfig = Object.values(presetNetworksMap).find(
        (n) => n.id === iToken.networkId,
      );

      const valueProps =
        priceToUse && parseFloat(priceToUse) > 0
          ? {
              value: priceToUse,
              currency: currencySymbol,
            }
          : undefined;

      const displayTokenItem: IListToken = {
        ...iToken,
        balance: balanceToUse ?? iToken.balance,
        price: priceToUse ?? iToken.price,
        networkImageSrc: networkConfig?.logoURI,
        valueProps,
      };
      return displayTokenItem;
    });
  }, [innerTokens, detailedTokens, currencySymbol]);

  log('TokenList displayTokens count:', displayTokens.length);

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

      <SwitchToTradePrompt onTradePress={onTradePress} />
    </YStack>
  );
}
