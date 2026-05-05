import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { SectionList } from '@onekeyhq/components';
import { useTabIsRefreshingFocused } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { TxHistoryListView } from '@onekeyhq/kit/src/components/TxHistoryListView';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useHistoryListActions,
  withHistoryListProvider,
} from '@onekeyhq/kit/src/states/jotai/contexts/historyList';
import {
  useCurrencyPersistAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  POLLING_DEBOUNCE_INTERVAL,
  POLLING_INTERVAL_FOR_HISTORY,
} from '@onekeyhq/shared/src/consts/walletConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalAssetDetailRoutes } from '@onekeyhq/shared/src/routes/assetDetails';
import cacheUtils from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import type { IProps } from '.';

const tokenHistoryCache = new cacheUtils.LRUCache<string, IAccountHistoryTx[]>({
  max: 20,
  ttl: timerUtils.getTimeDurationMs({ minute: 5 }),
  ttlAutopurge: true,
});

function TokenDetailsHistory(props: IProps) {
  const navigation = useAppNavigation();

  const {
    accountId,
    networkId,
    walletId,
    indexedAccountId,
    tokenInfo,
    ListHeaderComponent,
    isTabView,
    inTabList,
  } = props;

  const ListComponentRef = useRef<typeof SectionList>(null);

  const recomputeLayout = useCallback(() => {
    if (!platformEnv.isNative) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      (ListComponentRef.current as any)?.recomputeLayout?.();
    }
  }, []);

  const { isFocused } = useTabIsRefreshingFocused();
  const [settings] = useSettingsPersistAtom();
  const [{ currencyMap }] = useCurrencyPersistAtom();
  const { updateAddressesInfo, setHasMoreOnChainHistory } =
    useHistoryListActions().current;
  const historyCacheKey = useMemo(
    () =>
      [
        accountId,
        networkId,
        tokenInfo.address ?? '',
        settings.isFilterScamHistoryEnabled ? '1' : '0',
        settings.isFilterLowValueHistoryEnabled ? '1' : '0',
        settings.currencyInfo.id,
      ].join('_'),
    [
      accountId,
      networkId,
      tokenInfo.address,
      settings.isFilterScamHistoryEnabled,
      settings.isFilterLowValueHistoryEnabled,
      settings.currencyInfo.id,
    ],
  );
  const cachedHistory = useMemo(
    () => tokenHistoryCache.get(historyCacheKey),
    [historyCacheKey],
  );

  const [historyInit, setHistoryInit] = useState(cachedHistory !== undefined);

  useEffect(() => {
    setHistoryInit(cachedHistory !== undefined);
  }, [cachedHistory]);

  /**
   * since some tokens are slow to load history,
   * they are loaded separately from the token details
   * so as not to block the display of the top details.
   */
  const historyPromiseOptions = useMemo(
    () => ({
      pollingInterval: POLLING_INTERVAL_FOR_HISTORY,
      debounced: POLLING_DEBOUNCE_INTERVAL,
      overrideIsFocused: (isPageFocused: boolean) =>
        isPageFocused && (isTabView ? isFocused : true),
      ...(cachedHistory !== undefined ? { initResult: cachedHistory } : {}),
    }),
    [cachedHistory, isFocused, isTabView],
  );
  const { result: tokenHistory, run } = usePromiseResult(
    async () => {
      try {
        const r = await backgroundApiProxy.serviceHistory.fetchAccountHistory({
          accountId,
          networkId,
          tokenIdOnNetwork: tokenInfo.address,
          filterScam: settings.isFilterScamHistoryEnabled,
          filterLowValue: settings.isFilterLowValueHistoryEnabled,
          sourceCurrency: settings.currencyInfo.id,
          currencyMap,
        });
        updateAddressesInfo({
          data: r.addressMap ?? {},
        });
        setHasMoreOnChainHistory(!!r.hasMoreOnChainHistory);
        tokenHistoryCache.set(historyCacheKey, r.txs ?? []);
        setTimeout(() => {
          recomputeLayout();
        }, 300);
        return r.txs ?? [];
      } finally {
        setHistoryInit(true);
      }
    },
    [
      accountId,
      networkId,
      tokenInfo.address,
      settings.isFilterScamHistoryEnabled,
      settings.isFilterLowValueHistoryEnabled,
      settings.currencyInfo.id,
      currencyMap,
      updateAddressesInfo,
      setHasMoreOnChainHistory,
      recomputeLayout,
      historyCacheKey,
    ],
    historyPromiseOptions,
  );

  const resolvedHistory = tokenHistory ?? cachedHistory ?? [];
  // Derive initialized synchronously to avoid one-frame flash of empty history
  // when historyCacheKey changes and cachedHistory becomes undefined
  const effectiveInit = historyInit || cachedHistory !== undefined;

  const handleHistoryItemPress = useCallback(
    async (tx: IAccountHistoryTx) => {
      if (
        tx.decodedTx.status === EDecodedTxStatus.Pending &&
        tx.isLocalCreated
      ) {
        const localTx =
          await backgroundApiProxy.serviceHistory.getLocalHistoryTxById({
            accountId,
            networkId,
            historyId: tx.id,
          });

        // tx has been replaced by another tx
        if (!localTx || localTx.replacedNextId) {
          return;
        }
      }

      navigation.push(EModalAssetDetailRoutes.HistoryDetails, {
        accountId,
        networkId,
        accountAddress:
          await backgroundApiProxy.serviceAccount.getAccountAddressForApi({
            accountId,
            networkId,
          }),
        xpub: await backgroundApiProxy.serviceAccount.getAccountXpub({
          accountId,
          networkId,
        }),
        historyTx: tx,
      });
    },
    [accountId, navigation, networkId],
  );

  useEffect(() => {
    const reloadCallback = () => run({ alwaysSetState: true });
    appEventBus.on(EAppEventBusNames.HistoryTxStatusChanged, reloadCallback);
    return () => {
      appEventBus.off(EAppEventBusNames.HistoryTxStatusChanged, reloadCallback);
    };
  }, [run]);

  return (
    <TxHistoryListView
      ref={ListComponentRef}
      hideValue
      showFooter
      walletId={walletId}
      accountId={accountId}
      networkId={networkId}
      indexedAccountId={indexedAccountId}
      inTabList={inTabList}
      initialized={effectiveInit}
      data={resolvedHistory}
      onPressHistory={handleHistoryItemPress}
      ListHeaderComponent={ListHeaderComponent as React.ReactElement}
      isSingleAccount
    />
  );
}

const TokenDetailsHistoryWithProvider = memo(
  withHistoryListProvider(TokenDetailsHistory),
);
TokenDetailsHistoryWithProvider.displayName = 'TokenDetailsHistoryWithProvider';

export default memo(TokenDetailsHistoryWithProvider);
