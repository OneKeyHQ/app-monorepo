import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { CanceledError } from 'axios';

import {
  buildScopedActiveTokenListFromResponses,
  fetchFilteredTokenSelectorTokens,
} from '@onekeyhq/kit/src/components/TokenSelectorFilter/utils';
import { useIsDeFiEnabled } from '@onekeyhq/kit/src/hooks/useIsDeFiEnabled';
import { useTokenSelectorFilterPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { POLLING_INTERVAL_FOR_TOKEN } from '@onekeyhq/shared/src/consts/walletConsts';
import {
  EAppEventBusNames,
  type IEventBusPayloadAccountDataUpdate,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import {
  buildTokenSelectorDappTokenFilterParams,
  isTokenSelectorDappTokenFilterSupportedNetwork,
} from '@onekeyhq/shared/src/utils/tokenSelectorFilterUtils';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import { useActiveAccount } from '../../states/jotai/contexts/accountSelector';

import {
  buildHomeSpotAllCoverage,
  buildHomeSpotSingleCoverage,
  projectHomeSpotSectionSource,
} from './model/sections/spot/homeSpotSectionPolicy';
import {
  type IHomeSpotNativePayload,
  type IHomeSpotSourceSnapshot,
} from './model/sections/spot/homeSpotSourceAdapter';
import { buildNativeHomePortfolioScopeKey } from './nativeHomePortfolioRequestLifecycle';

import type { IHomeSpotEvidence } from './model/sections/spot/homeSpotSectionPolicy';

export interface INativeHomeLpTokenData {
  errorCode: string | undefined;
  initialized: boolean;
  isLoading: boolean;
  map: Record<string, ITokenFiat>;
  refresh: () => Promise<void>;
  setShowLpTokensOnly: (value: boolean) => void;
  showLpTokenFilterSwitch: boolean;
  showLpTokensOnly: boolean;
  spotSectionSource:
    | {
        scopeKey: string;
        snapshot: IHomeSpotSourceSnapshot<IHomeSpotNativePayload>;
      }
    | undefined;
  tokens: IAccountToken[];
}

const lpTokenFilterParams = buildTokenSelectorDappTokenFilterParams({
  lpToken: true,
});

export function useNativeHomeLpTokenData(): INativeHomeLpTokenData {
  const {
    activeAccount: {
      account,
      deriveInfoItems,
      indexedAccount,
      network,
      vaultSettings,
      wallet,
    },
  } = useActiveAccount({ num: 0 });
  const [tokenSelectorFilter, setTokenSelectorFilter] =
    useTokenSelectorFilterPersistAtom();
  const isDeFiEnabled = useIsDeFiEnabled(network?.id);
  const showLpTokenFilterSwitch =
    isTokenSelectorDappTokenFilterSupportedNetwork({
      network,
      isDeFiEnabled,
    });
  const showLpTokensOnly = showLpTokenFilterSwitch
    ? tokenSelectorFilter.homeShowLpTokensOnly
    : false;
  const [tokens, setTokens] = useState<IAccountToken[]>([]);
  const [map, setMap] = useState<Record<string, ITokenFiat>>({});
  const [initialized, setInitialized] = useState(!showLpTokensOnly);
  const [isLoading, setIsLoading] = useState(false);
  const [errorCode, setErrorCode] = useState<string>();
  const requestIdRef = useRef(0);
  const spotRequestSeqRef = useRef(0);
  const accountId = account?.id;
  const indexedAccountId = indexedAccount?.id;
  const networkId = network?.id;
  const walletId = wallet?.id;
  const isAllNetworks = Boolean(network?.isAllNetworks);
  const scopeKey = buildNativeHomePortfolioScopeKey({
    accountId,
    enabled: showLpTokensOnly,
    isAllNetworks,
    networkId,
    walletId,
  });
  const mergeDeriveAddressData =
    Boolean(vaultSettings?.mergeDeriveAssetsEnabled) &&
    !accountUtils.isOthersWallet({ walletId: walletId ?? '' }) &&
    deriveInfoItems.length > 1;
  const [spotSectionSource, setSpotSectionSource] =
    useState<INativeHomeLpTokenData['spotSectionSource']>();

  const publishSpotEvidence = useCallback(
    ({
      evidence,
      requestSeq,
    }: {
      evidence: IHomeSpotEvidence<IHomeSpotNativePayload>;
      requestSeq: number;
    }) => {
      if (!scopeKey) {
        return;
      }
      setSpotSectionSource({
        scopeKey,
        snapshot: projectHomeSpotSectionSource({
          authorityReady: Boolean(
            showLpTokensOnly &&
            showLpTokenFilterSwitch &&
            accountId &&
            networkId &&
            walletId,
          ),
          evidence,
          requestSeq,
          scopeMatches: true,
        }),
      });
    },
    [
      accountId,
      networkId,
      scopeKey,
      showLpTokenFilterSwitch,
      showLpTokensOnly,
      walletId,
    ],
  );

  const refresh = useCallback(async () => {
    if (
      !showLpTokensOnly ||
      !showLpTokenFilterSwitch ||
      !accountId ||
      !networkId
    ) {
      return;
    }
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    spotRequestSeqRef.current += 1;
    const requestSeq = spotRequestSeqRef.current;
    setIsLoading(true);
    setErrorCode(undefined);
    publishSpotEvidence({
      evidence: { kind: 'loading' },
      requestSeq,
    });
    try {
      const { responses } = await fetchFilteredTokenSelectorTokens({
        accountId,
        networkId,
        indexedAccountId,
        isAllNetworks,
        mergeDeriveAddressData,
        onlyBackendIndexedNetworks: true,
        tokenSelectorFilterParams: lpTokenFilterParams,
      });
      if (requestIdRef.current !== requestId) {
        return;
      }
      const result = buildScopedActiveTokenListFromResponses({
        responses,
        keySuffix: 'native-home-lp-dapp-token',
      });
      setTokens(result.tokenList.tokens);
      setMap(result.tokenListMap);
      setInitialized(true);
      const payload: IHomeSpotNativePayload = {
        customTokens: [],
        dataScopeKey: scopeKey,
        isEmptyAccount: result.tokenList.tokens.length === 0,
        map: result.tokenListMap,
        riskMap: {},
        riskTokens: [],
        smallBalanceMap: {},
        smallBalanceTokens: [],
        tokens: result.tokenList.tokens,
      };
      publishSpotEvidence({
        evidence: {
          kind: 'complete',
          confirmedEmpty: payload.isEmptyAccount,
          coverageFingerprint: isAllNetworks
            ? buildHomeSpotAllCoverage({
                expected: responses.length,
                failed: 0,
                requestSeq,
                settled: responses.length,
              })
            : buildHomeSpotSingleCoverage(requestSeq),
          data: payload,
          rowIds: payload.tokens.map((token) => token.$key),
        },
        requestSeq,
      });
    } catch (error) {
      if (requestIdRef.current === requestId) {
        if (error instanceof CanceledError) {
          publishSpotEvidence({
            evidence: {
              kind: 'partial',
              coverageFingerprint: isAllNetworks
                ? buildHomeSpotAllCoverage({
                    expected: 1,
                    failed: 0,
                    requestSeq,
                    settled: 0,
                  })
                : buildHomeSpotSingleCoverage(requestSeq),
            },
            requestSeq,
          });
          return;
        }
        setErrorCode('lp_token_fetch_failed');
        setInitialized(true);
        publishSpotEvidence({
          evidence: {
            kind: 'error',
            errorKind: 'source',
          },
          requestSeq,
        });
      }
    } finally {
      if (requestIdRef.current === requestId) {
        setIsLoading(false);
      }
    }
  }, [
    accountId,
    indexedAccountId,
    isAllNetworks,
    mergeDeriveAddressData,
    networkId,
    publishSpotEvidence,
    showLpTokenFilterSwitch,
    showLpTokensOnly,
    scopeKey,
  ]);

  useEffect(() => {
    requestIdRef.current += 1;
    setTokens([]);
    setMap({});
    setErrorCode(undefined);
    setInitialized(!showLpTokensOnly);
    setIsLoading(showLpTokensOnly);
    spotRequestSeqRef.current = 0;
    if (showLpTokensOnly && scopeKey) {
      setSpotSectionSource({
        scopeKey,
        snapshot: { kind: 'loading', requestSeq: 0 },
      });
    } else {
      setSpotSectionSource(undefined);
    }
    if (showLpTokensOnly) {
      void refresh();
    }
    return () => {
      requestIdRef.current += 1;
    };
  }, [accountId, networkId, refresh, scopeKey, showLpTokensOnly]);

  useEffect(() => {
    if (!showLpTokensOnly) {
      return;
    }
    const reload = () => {
      void refresh();
    };
    const reloadAccountData = (payload: IEventBusPayloadAccountDataUpdate) => {
      if (payload?.refreshSource === 'pull-to-refresh') {
        return;
      }
      reload();
    };
    appEventBus.on(EAppEventBusNames.AccountDataUpdate, reloadAccountData);
    appEventBus.on(EAppEventBusNames.NetworkDeriveTypeChanged, reload);
    const timer = setInterval(reload, POLLING_INTERVAL_FOR_TOKEN);
    return () => {
      clearInterval(timer);
      appEventBus.off(EAppEventBusNames.AccountDataUpdate, reloadAccountData);
      appEventBus.off(EAppEventBusNames.NetworkDeriveTypeChanged, reload);
    };
  }, [refresh, showLpTokensOnly]);

  const setShowLpTokensOnly = useCallback(
    (value: boolean) => {
      if (value === showLpTokensOnly) {
        return;
      }
      if (value) {
        setIsLoading(true);
        setInitialized(false);
      }
      setTokenSelectorFilter((previous) => ({
        ...previous,
        homeShowLpTokensOnly: value,
      }));
    },
    [setTokenSelectorFilter, showLpTokensOnly],
  );

  return useMemo(
    () => ({
      errorCode,
      initialized,
      isLoading,
      map,
      refresh,
      setShowLpTokensOnly,
      showLpTokenFilterSwitch,
      showLpTokensOnly,
      spotSectionSource,
      tokens,
    }),
    [
      errorCode,
      initialized,
      isLoading,
      map,
      refresh,
      setShowLpTokensOnly,
      showLpTokenFilterSwitch,
      showLpTokensOnly,
      spotSectionSource,
      tokens,
    ],
  );
}
