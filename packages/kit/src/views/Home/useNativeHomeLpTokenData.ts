import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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

export interface INativeHomeLpTokenData {
  errorCode: string | undefined;
  initialized: boolean;
  isLoading: boolean;
  map: Record<string, ITokenFiat>;
  refresh: () => Promise<void>;
  setShowLpTokensOnly: (value: boolean) => void;
  showLpTokenFilterSwitch: boolean;
  showLpTokensOnly: boolean;
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
  const accountId = account?.id;
  const indexedAccountId = indexedAccount?.id;
  const networkId = network?.id;
  const isAllNetworks = Boolean(network?.isAllNetworks);
  const mergeDeriveAddressData =
    Boolean(vaultSettings?.mergeDeriveAssetsEnabled) &&
    !accountUtils.isOthersWallet({ walletId: wallet?.id ?? '' }) &&
    deriveInfoItems.length > 1;

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
    setIsLoading(true);
    setErrorCode(undefined);
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
    } catch {
      if (requestIdRef.current === requestId) {
        setErrorCode('lp_token_fetch_failed');
        setInitialized(true);
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
    showLpTokenFilterSwitch,
    showLpTokensOnly,
  ]);

  useEffect(() => {
    requestIdRef.current += 1;
    setTokens([]);
    setMap({});
    setErrorCode(undefined);
    setInitialized(!showLpTokensOnly);
    setIsLoading(showLpTokensOnly);
    if (showLpTokensOnly) {
      void refresh();
    }
    return () => {
      requestIdRef.current += 1;
    };
  }, [accountId, networkId, refresh, showLpTokensOnly]);

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
      tokens,
    ],
  );
}
