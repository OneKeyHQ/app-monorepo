import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { debounce } from 'lodash';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useTokenListAtom } from '@onekeyhq/kit/src/states/jotai/contexts/tokenList';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import type { ICustomTokenItem } from '@onekeyhq/shared/types/token';

export function useTokenSearch({
  walletId,
  networkId,
}: {
  walletId: string;
  networkId: string;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [searchResult, setSearchResult] = useState<ICustomTokenItem[] | null>(
    null,
  );
  const debouncedFetchDataRef = useRef(
    debounce(
      async (params: {
        walletId: string;
        networkId: string;
        searchValue: string;
      }) => {
        setIsLoading(true);
        try {
          const r =
            await backgroundApiProxy.serviceCustomToken.searchTokenByKeywords({
              walletId: params.walletId,
              networkId: params.networkId,
              keywords: params.searchValue,
            });
          const formattedResult = r?.map((t) => {
            const { price, price24h, info } = t;

            return {
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
          });
          setSearchResult(formattedResult);
        } catch (error) {
          console.error('Error fetching search response:', error);
        } finally {
          setIsLoading(false);
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
      searchValue,
    });
    return () => {
      debouncedFetchDataRef.cancel();
    };
  }, [searchValue, networkId, walletId, debouncedFetchDataRef]);

  const isSearchMode = useMemo(
    () => searchValue && searchValue.length > 0,
    [searchValue],
  );
  return {
    searchValue,
    searchResult,
    isSearchMode,
    setSearchValue,
    isLoading,
  };
}
