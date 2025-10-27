import { useEffect, useMemo, useRef, useState } from 'react';

import { debounce } from 'lodash';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AGGREGATE_TOKEN_MOCK_NETWORK_ID } from '@onekeyhq/shared/src/consts/networkConsts';
import {
  buildAggregateTokenListMapKeyForTokenList,
  buildAggregateTokenMapKeyForAggregateConfig,
} from '@onekeyhq/shared/src/utils/tokenUtils';
import type { ICustomTokenItem } from '@onekeyhq/shared/types/token';

export function useTokenSearch({
  walletId,
  networkId,
  accountId,
}: {
  walletId: string;
  networkId: string;
  accountId: string;
}) {
  const [isLoadingRemoteData, setIsLoadingRemoteData] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [searchResult, setSearchResult] = useState<ICustomTokenItem[] | null>(
    null,
  );
  const debouncedFetchDataRef = useRef(
    debounce(
      async (params: {
        walletId: string;
        accountId: string;
        networkId: string;
        searchValue: string;
      }) => {
        setIsLoadingRemoteData(true);
        try {
          const r =
            await backgroundApiProxy.serviceCustomToken.searchTokenByKeywords({
              walletId: params.walletId,
              accountId: params.accountId,
              networkId: params.networkId,
              keywords: params.searchValue,
            });

          const aggregateTokenConfigMap =
            await backgroundApiProxy.serviceToken.getAggregateTokenConfigMap();
          const aggregateTokenMap: Record<string, boolean> = {};

          const formattedResult = r
            ?.map((t) => {
              const { price, price24h, info } = t;

              let tokenInfo = {
                $key: `search__${info.networkId ?? ''}_${info.address}_${
                  info.isNative ? 'native' : 'token'
                }`,
                address: info.address,
                decimals: info.decimals,
                isNative: info.isNative,
                logoURI: info.logoURI,
                name: info.name,
                symbol: info.symbol,
                riskLevel: info.riskLevel,
                networkId: info.networkId,
                // Add price info
                price,
                price24h,
              } as ICustomTokenItem;

              const aggregateTokenConfigKey =
                buildAggregateTokenMapKeyForAggregateConfig({
                  networkId: info.networkId ?? networkId,
                  tokenAddress: info.address,
                });
              const aggregateTokenConfig =
                aggregateTokenConfigMap?.[aggregateTokenConfigKey];

              if (aggregateTokenConfig) {
                const aggregateTokenKey =
                  buildAggregateTokenListMapKeyForTokenList({
                    commonSymbol: aggregateTokenConfig?.commonSymbol ?? '',
                  });

                if (aggregateTokenMap[aggregateTokenKey]) {
                  return null;
                }

                aggregateTokenMap[aggregateTokenKey] = true;

                tokenInfo = {
                  ...tokenInfo,
                  $key: aggregateTokenKey,
                  networkId: AGGREGATE_TOKEN_MOCK_NETWORK_ID,
                  address: aggregateTokenKey,
                  isAggregateToken: true,
                  commonSymbol: aggregateTokenConfig?.commonSymbol ?? '',
                  logoURI: aggregateTokenConfig?.logoURI ?? '',
                  name: aggregateTokenConfig?.name ?? '',
                };
                return tokenInfo;
              }

              return tokenInfo;
            })
            .filter(Boolean);

          setSearchResult(formattedResult);
        } catch (error) {
          console.error('Error fetching search response:', error);
        } finally {
          setIsLoadingRemoteData(false);
        }
      },
      500,
    ),
  ).current;

  useEffect(() => {
    if (!searchValue) {
      setSearchResult(null);
      return;
    }
    void debouncedFetchDataRef({
      walletId,
      networkId,
      accountId,
      searchValue,
    });
    return () => {
      debouncedFetchDataRef.cancel();
    };
  }, [searchValue, networkId, walletId, accountId, debouncedFetchDataRef]);

  const isSearchMode = useMemo(
    () => searchValue && searchValue.length > 0,
    [searchValue],
  );
  return {
    searchValue,
    searchResult,
    isSearchMode,
    setSearchValue,
    isLoadingRemoteData,
  };
}
