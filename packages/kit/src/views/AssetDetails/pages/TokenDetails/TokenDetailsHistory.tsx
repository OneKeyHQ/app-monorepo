import { memo, useCallback, useEffect, useRef, useState } from 'react';

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
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import type { IProps } from '.';

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

  const [historyInit, setHistoryInit] = useState(false);
  const { isFocused } = useTabIsRefreshingFocused();
  const [settings] = useSettingsPersistAtom();
  const [{ currencyMap }] = useCurrencyPersistAtom();
  const { updateAddressesInfo, setHasMoreOnChainHistory } =
    useHistoryListActions().current;

  /**
   * since some tokens are slow to load history,
   * they are loaded separately from the token details
   * so as not to block the display of the top details.
   */
  const {
    result: tokenHistory,
    run,
    isLoading,
  } = usePromiseResult(
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
        setTimeout(() => {
          recomputeLayout();
        }, 300);
        return r.txs;
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
    ],
    {
      pollingInterval: POLLING_INTERVAL_FOR_HISTORY,
      debounced: POLLING_DEBOUNCE_INTERVAL,
      overrideIsFocused: (isPageFocused) =>
        isPageFocused && (isTabView ? isFocused : true),
      watchLoading: true,
    },
  );

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
      initialized={historyInit}
      isLoading={isLoading}
      data={tokenHistory ?? []}
      onPressHistory={handleHistoryItemPress}
      ListHeaderComponent={ListHeaderComponent as React.ReactElement}
      isSingleAccount
    />
  );
}

const TokenDetailsHistoryWithProvider = memo(
  withHistoryListProvider(TokenDetailsHistory),
);

export default memo(TokenDetailsHistoryWithProvider);
