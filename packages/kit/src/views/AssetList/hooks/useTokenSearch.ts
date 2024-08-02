import { useEffect, useMemo, useRef, useState } from 'react';

import { debounce } from 'lodash';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
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
