import { useCallback, useEffect, useState } from 'react';

import { useSwapProJumpTokenAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/swap';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IMarketSearchV2Token } from '@onekeyhq/shared/types/market';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  useSwapProSelectTokenAtom,
  useSwapTypeSwitchAtom,
} from '../../../states/jotai/contexts/swap';

export function useSwapProInit() {
  const [, setSwapSwitchType] = useSwapTypeSwitchAtom();
  const [, setSwapProSelectToken] = useSwapProSelectTokenAtom();
  const [swapProJumpToken, setSwapProJumpToken] = useSwapProJumpTokenAtom();
  const swapSwitchProToken = useCallback(
    (payload: { token: ISwapToken }) => {
      setSwapSwitchType(ESwapTabSwitchType.LIMIT);
      setSwapProSelectToken(payload.token);
    },
    [setSwapSwitchType, setSwapProSelectToken],
  );
  useEffect(() => {
    if (swapProJumpToken.token) {
      swapSwitchProToken({ token: swapProJumpToken.token });
      setSwapProJumpToken({ token: undefined });
    }
  }, [swapProJumpToken, swapSwitchProToken, setSwapProJumpToken]);
}

export function useSwapProActions() {}

export function useSwapProTokenSearch(input: string) {
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchTokenList, setSearchTokenList] = useState<
    (IMarketSearchV2Token & { networkLogoURI: string })[]
  >([]);
  useEffect(() => {
    void (async () => {
      setSearchLoading(true);
      try {
        const searchRes =
          await backgroundApiProxy.serviceUniversalSearch.universalSearchOfV2MarketToken(
            input,
          );
        const searchTokenParse = searchRes?.map((t) => {
          const networkInfo = networkUtils.getLocalNetworkInfo(t.network);
          return {
            ...t,
            networkLogoURI: networkInfo?.logoURI ?? '',
          };
        });
        setSearchTokenList(searchTokenParse ?? []);
      } catch (e) {
        console.error(e);
      } finally {
        setSearchLoading(false);
      }
    })();
  }, [input]);
  return {
    searchLoading,
    searchTokenList,
  };
}
