import { useMemo, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useLocaleVariant } from '@onekeyhq/kit/src/hooks/useLocaleVariant';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  swrCacheUtils,
  swrKeys,
} from '@onekeyhq/shared/src/utils/swrCacheUtils';
import { normalizeTokenContractAddress } from '@onekeyhq/shared/src/utils/tokenUtils';

import { analyzeSecurityData, formatSecurityData } from '../utils';

import type {
  IUseTokenSecurityParams,
  IUseTokenSecurityResult,
} from '../types';

// A security verdict is a claim about right now: a token rated safe days ago
// may since have been re-rated. The persisted copy is only there to spare the
// first frame, so it is shown for minutes, not across sessions — past that the
// panel waits for this session's answer rather than presenting an old one as
// current.
const SECURITY_RESULT_MAX_AGE_MS = 5 * 60 * 1000;

export const useTokenSecurity = ({
  tokenAddress,
  networkId,
}: IUseTokenSecurityParams): IUseTokenSecurityResult => {
  const locale = useLocaleVariant().toLowerCase();
  // Set once this mount has an answer of its own. There is no polling here,
  // so a fetched report is stamped once and would otherwise age out of the
  // window below while it is still the only answer anyone has.
  const fetchedKeyRef = useRef<string | undefined>(undefined);
  // Every instance for the same token shares this key, so a component that
  // mounts after the first request settled starts from that result.
  const securitySwrKey =
    tokenAddress && networkId
      ? swrKeys.marketTokenSecurity({
          networkId,
          tokenAddress:
            normalizeTokenContractAddress({
              networkId,
              contractAddress: tokenAddress,
            }) ?? tokenAddress,
          locale,
        })
      : undefined;
  const { result: securityData } = usePromiseResult(
    async () => {
      if (!tokenAddress) {
        return null;
      }

      const batchData =
        await backgroundApiProxy.serviceMarketV2.fetchMarketTokenSecurity({
          contractAddress: tokenAddress,
          chainId: networkId,
        });

      const tokenSecurityData =
        batchData[tokenAddress] || batchData[tokenAddress.toLowerCase()];

      fetchedKeyRef.current = securitySwrKey;
      return tokenSecurityData || null;
    },
    [tokenAddress, networkId, securitySwrKey],
    {
      initResult: null,
      // A key change already swaps in that token's cached result or null.
      undefinedResultIfReRun: !securitySwrKey,
      swrKey: securitySwrKey,
    },
  );

  // The window only ever gates a replayed report. Once this mount has fetched
  // the report itself it is this session's answer and stays on screen for as
  // long as the page is open, however long that is.
  const hasFetchedThisSession = fetchedKeyRef.current === securitySwrKey;
  const isReplayedResultFresh = securitySwrKey
    ? swrCacheUtils.isFresh(securitySwrKey, SECURITY_RESULT_MAX_AGE_MS)
    : true;
  const currentSecurityData =
    hasFetchedThisSession || isReplayedResultFresh ? securityData : null;

  // Note: Removed trusted_token special handling since we now use dynamic structure
  // and rely on API's riskType directly. Backend should handle data filtering.

  const { securityStatus, riskCount, cautionCount, formattedData } =
    useMemo(() => {
      const {
        status,
        riskCount: risks,
        cautionCount: cautions,
      } = analyzeSecurityData(currentSecurityData);
      const formatted = formatSecurityData(currentSecurityData);

      return {
        securityStatus: status,
        riskCount: risks,
        cautionCount: cautions,
        formattedData: formatted,
      };
    }, [currentSecurityData]);

  return {
    securityData: currentSecurityData,
    securityStatus,
    riskCount,
    cautionCount,
    formattedData,
  };
};
