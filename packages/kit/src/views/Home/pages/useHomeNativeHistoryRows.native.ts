import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { uniqBy } from 'lodash';
import { useIntl } from 'react-intl';

import type {
  IHomeNativeHistoryRow,
  IHomeNativeRow,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IAllNetworkAccountInfo } from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';
import {
  useCurrencyPersistAtom,
  useSettingsPersistAtom,
  useSettingsValuePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { HISTORY_PAGE_SIZE } from '@onekeyhq/shared/src/consts/walletConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalAssetDetailRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import {
  formatTrayPendingTxAmount,
  getTrayPendingTxAmountInfo,
} from '@onekeyhq/shared/src/utils/trayDataUtils';
import { EHomeTab } from '@onekeyhq/shared/types';
import type { IAddressBadge } from '@onekeyhq/shared/types/address';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import {
  EDecodedTxActionType,
  EDecodedTxStatus,
  type IDecodedTxAction,
} from '@onekeyhq/shared/types/tx';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { useAccountOverviewActions } from '../../../states/jotai/contexts/accountOverview';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';

const NATIVE_HISTORY_ROW_PREFIX = 'history:tx:';

type IHistoryFetchResult = {
  allAccounts: IAllNetworkAccountInfo[];
  txs: IAccountHistoryTx[];
  accountsWithChangedTxs: {
    accountId: string;
    networkId: string;
  }[];
  addressMap?: Record<string, IAddressBadge>;
  hasMoreOnChainHistory?: boolean;
};

function getHistoryRowKey(history: IAccountHistoryTx) {
  return `${NATIVE_HISTORY_ROW_PREFIX}${history.id}`;
}

function getHistoryKeyFromNativeRowKey(rowKey: string) {
  return rowKey.startsWith(NATIVE_HISTORY_ROW_PREFIX)
    ? rowKey.slice(NATIVE_HISTORY_ROW_PREFIX.length)
    : '';
}

function getVisibleHistoryAction(history: IAccountHistoryTx) {
  return (
    history.decodedTx.actions.find((action) => !action.hidden) ??
    history.decodedTx.actions[0]
  );
}

function getHistoryTitle(history: IAccountHistoryTx) {
  const { decodedTx } = history;
  const action = getVisibleHistoryAction(history);
  const transfer = action?.assetTransfer;

  if (transfer?.isInternalSwap) {
    return transfer.label || 'Swap';
  }

  if (action?.type === EDecodedTxActionType.TOKEN_APPROVE) {
    return action.tokenApprove?.label || 'Approve';
  }

  if (action?.type === EDecodedTxActionType.FUNCTION_CALL) {
    return action.functionCall?.functionName || 'Contract';
  }

  return (
    transfer?.label ||
    transfer?.internalStakingLabel ||
    action?.unknownAction?.label ||
    decodedTx.payload?.label ||
    decodedTx.interactInfo?.name ||
    decodedTx.txid
  );
}

function getHistoryIconUri(history: IAccountHistoryTx) {
  const action = getVisibleHistoryAction(history);
  return (
    action?.assetTransfer?.receives?.[0]?.icon ||
    action?.assetTransfer?.sends?.[0]?.icon ||
    history.decodedTx.networkLogoURI
  );
}

function getHistoryValue(
  action: IDecodedTxAction | undefined,
  hideValue: boolean,
) {
  if (hideValue) {
    return '****';
  }

  const amountInfo = getTrayPendingTxAmountInfo(action);
  if (!amountInfo) {
    return '';
  }

  const formatted = formatTrayPendingTxAmount({ amountInfo });
  if (action?.assetTransfer?.receives?.[0]) {
    return `+${formatted}`;
  }
  if (action?.assetTransfer?.sends?.[0]) {
    return `-${formatted}`;
  }
  return formatted;
}

function getNativeHistoryStatus(
  status: EDecodedTxStatus,
): IHomeNativeHistoryRow['status'] {
  if (status === EDecodedTxStatus.Pending) {
    return 'pending';
  }
  if (status === EDecodedTxStatus.Confirmed) {
    return 'success';
  }
  if (
    status === EDecodedTxStatus.Failed ||
    status === EDecodedTxStatus.Dropped ||
    status === EDecodedTxStatus.Removed
  ) {
    return 'failed';
  }
  return 'unknown';
}

function sortHistoryTxs(txs: IAccountHistoryTx[]) {
  return txs
    .slice()
    .toSorted(
      (b, a) =>
        (a.decodedTx.updatedAt ?? a.decodedTx.createdAt ?? 0) -
        (b.decodedTx.updatedAt ?? b.decodedTx.createdAt ?? 0),
    )
    .slice(0, HISTORY_PAGE_SIZE);
}

function buildNativeHistoryRow({
  history,
  hideValue,
}: {
  history: IAccountHistoryTx;
  hideValue: boolean;
}): IHomeNativeHistoryRow {
  const action = getVisibleHistoryAction(history);
  return {
    type: 'history',
    key: getHistoryRowKey(history),
    txId: history.decodedTx.txid,
    title: getHistoryTitle(history),
    subtitle: history.decodedTx.status,
    value: getHistoryValue(action, hideValue),
    iconUri: getHistoryIconUri(history),
    status: getNativeHistoryStatus(history.decodedTx.status),
    estimatedHeight: 72,
  };
}

export function useHomeNativeHistoryRows() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const [settings] = useSettingsPersistAtom();
  const [settingsValue] = useSettingsValuePersistAtom();
  const [{ currencyMap }] = useCurrencyPersistAtom();
  const { updateAllNetworksState } = useAccountOverviewActions().current;
  const [historyData, setHistoryData] = useState<IAccountHistoryTx[]>([]);
  const [historyState, setHistoryState] = useState({
    initialized: false,
    isRefreshing: false,
  });
  const requestIdRef = useRef(0);
  const isManualRefreshRef = useRef(false);

  const {
    activeAccount: {
      account,
      network,
      wallet,
      indexedAccount,
      deriveInfoItems,
      vaultSettings,
    },
  } = useActiveAccount({ num: 0 });

  const mergeDeriveAddressData = !!(
    !accountUtils.isOthersWallet({ walletId: wallet?.id ?? '' }) &&
    deriveInfoItems.length > 1 &&
    vaultSettings?.mergeDeriveAssetsEnabled
  );
  const isSupported = !!(
    network?.id &&
    wallet?.id &&
    (account?.id || (mergeDeriveAddressData && indexedAccount?.id))
  );
  const ownerKey = `${account?.id ?? ''}__${indexedAccount?.id ?? ''}__${
    network?.id ?? ''
  }__${mergeDeriveAddressData ? 'merge' : 'single'}`;

  const applyHistoryData = useCallback((txs: IAccountHistoryTx[]) => {
    setHistoryData(txs);
    setHistoryState({
      initialized: true,
      isRefreshing: false,
    });
  }, []);

  const hydrateLocalHistory = useCallback(async () => {
    if (!network?.id || !wallet?.id) {
      return [];
    }

    if (mergeDeriveAddressData) {
      if (!indexedAccount?.id) {
        return [];
      }
      const { networkAccounts } =
        await backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes(
          {
            networkId: network.id,
            indexedAccountId: indexedAccount.id,
            excludeEmptyAccount: true,
          },
        );

      const resp = await Promise.all(
        networkAccounts.map((networkAccount) =>
          backgroundApiProxy.serviceHistory.getAccountsLocalHistoryTxs({
            accountId: networkAccount.account?.id ?? '',
            networkId: network.id,
            filterScam: settings.isFilterScamHistoryEnabled,
            filterLowValue: settings.isFilterLowValueHistoryEnabled,
            sourceCurrency: settings.currencyInfo.id,
            currencyMap,
          }),
        ),
      );
      return sortHistoryTxs(resp.flat());
    }

    if (!account?.id) {
      return [];
    }

    return backgroundApiProxy.serviceHistory.getAccountsLocalHistoryTxs({
      accountId: account.id,
      networkId: network.id,
      filterScam: settings.isFilterScamHistoryEnabled,
      filterLowValue: settings.isFilterLowValueHistoryEnabled,
      excludeTestNetwork: true,
      sourceCurrency: settings.currencyInfo.id,
      currencyMap,
    });
  }, [
    account?.id,
    currencyMap,
    indexedAccount?.id,
    mergeDeriveAddressData,
    network?.id,
    settings.currencyInfo.id,
    settings.isFilterLowValueHistoryEnabled,
    settings.isFilterScamHistoryEnabled,
    wallet?.id,
  ]);

  const refreshNativeHistory = useCallback(async () => {
    if (!isSupported || !network?.id) {
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const currentAccountId = mergeDeriveAddressData
      ? (indexedAccount?.id ?? '')
      : (account?.id ?? '');

    if (!currentAccountId) {
      return;
    }

    setHistoryState((prev) => ({
      initialized: prev.initialized,
      isRefreshing: true,
    }));
    appEventBus.emit(EAppEventBusNames.TabListStateUpdate, {
      isRefreshing: true,
      type: EHomeTab.HISTORY,
      accountId: currentAccountId,
      networkId: network.id,
    });

    try {
      let result: IHistoryFetchResult = {
        allAccounts: [],
        txs: [],
        accountsWithChangedTxs: [],
        addressMap: {},
        hasMoreOnChainHistory: false,
      };

      if (mergeDeriveAddressData) {
        const { networkAccounts } =
          await backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes(
            {
              networkId: network.id,
              indexedAccountId: indexedAccount?.id ?? '',
              excludeEmptyAccount: true,
            },
          );
        const resp = await Promise.all(
          networkAccounts.map((networkAccount) =>
            backgroundApiProxy.serviceHistory.fetchAccountHistory({
              accountId: networkAccount.account?.id ?? '',
              networkId: network.id,
              isManualRefresh: isManualRefreshRef.current,
              filterScam: settings.isFilterScamHistoryEnabled,
              filterLowValue: settings.isFilterLowValueHistoryEnabled,
              sourceCurrency: settings.currencyInfo.id,
              currencyMap,
            }),
          ),
        );

        for (const item of resp) {
          result = {
            allAccounts: [...result.allAccounts, ...item.allAccounts],
            txs: [...result.txs, ...item.txs],
            accountsWithChangedTxs: [
              ...result.accountsWithChangedTxs,
              ...item.accountsWithChangedTxs,
            ],
            addressMap: {
              ...result.addressMap,
              ...item.addressMap,
            },
            hasMoreOnChainHistory:
              result.hasMoreOnChainHistory || item.hasMoreOnChainHistory,
          };
        }
        result.txs = sortHistoryTxs(result.txs);
      } else {
        result = await backgroundApiProxy.serviceHistory.fetchAccountHistory({
          accountId: currentAccountId,
          networkId: network.id,
          isManualRefresh: isManualRefreshRef.current,
          filterScam: settings.isFilterScamHistoryEnabled,
          filterLowValue: settings.isFilterLowValueHistoryEnabled,
          excludeTestNetwork: true,
          sourceCurrency: settings.currencyInfo.id,
          currencyMap,
        });
      }

      if (requestIdRef.current !== requestId) {
        return;
      }

      updateAllNetworksState({
        visibleCount: uniqBy(result.allAccounts, 'networkId').length,
      });
      applyHistoryData(result.txs);
      if (result.accountsWithChangedTxs.length > 0) {
        appEventBus.emit(EAppEventBusNames.RefreshTokenList, {
          accounts: result.accountsWithChangedTxs,
        });
      }
    } catch (error) {
      console.error(error);
      setHistoryState({
        initialized: true,
        isRefreshing: false,
      });
    } finally {
      isManualRefreshRef.current = false;
      appEventBus.emit(EAppEventBusNames.TabListStateUpdate, {
        isRefreshing: false,
        type: EHomeTab.HISTORY,
        accountId: currentAccountId,
        networkId: network.id,
      });
    }
  }, [
    account?.id,
    applyHistoryData,
    currencyMap,
    indexedAccount?.id,
    isSupported,
    mergeDeriveAddressData,
    network?.id,
    settings.currencyInfo.id,
    settings.isFilterLowValueHistoryEnabled,
    settings.isFilterScamHistoryEnabled,
    updateAllNetworksState,
  ]);

  useEffect(() => {
    let cancelled = false;

    if (!isSupported) {
      setHistoryData([]);
      setHistoryState({
        initialized: true,
        isRefreshing: false,
      });
      return undefined;
    }

    const initHistory = async () => {
      setHistoryState({
        initialized: false,
        isRefreshing: true,
      });
      try {
        const localTxs = await hydrateLocalHistory();
        if (cancelled) {
          return;
        }
        if (localTxs.length > 0) {
          applyHistoryData(localTxs);
        }
      } catch (error) {
        if (!cancelled) {
          console.error(error);
        }
      } finally {
        if (!cancelled) {
          void refreshNativeHistory();
        }
      }
    };

    void initHistory();

    return () => {
      cancelled = true;
    };
  }, [
    applyHistoryData,
    hydrateLocalHistory,
    isSupported,
    ownerKey,
    refreshNativeHistory,
  ]);

  useEffect(() => {
    const refresh = () => {
      isManualRefreshRef.current = true;
      void refreshNativeHistory();
    };
    const clearPending = () => {
      setHistoryData((prev) =>
        prev.filter((tx) => tx.decodedTx.status !== EDecodedTxStatus.Pending),
      );
    };

    appEventBus.on(EAppEventBusNames.HistoryTxStatusChanged, refresh);
    appEventBus.on(EAppEventBusNames.ClearLocalHistoryPendingTxs, clearPending);
    appEventBus.on(EAppEventBusNames.AccountDataUpdate, refresh);
    appEventBus.on(EAppEventBusNames.NetworkDeriveTypeChanged, refresh);
    appEventBus.on(EAppEventBusNames.RefreshHistoryList, refresh);

    return () => {
      appEventBus.off(EAppEventBusNames.HistoryTxStatusChanged, refresh);
      appEventBus.off(
        EAppEventBusNames.ClearLocalHistoryPendingTxs,
        clearPending,
      );
      appEventBus.off(EAppEventBusNames.AccountDataUpdate, refresh);
      appEventBus.off(EAppEventBusNames.NetworkDeriveTypeChanged, refresh);
      appEventBus.off(EAppEventBusNames.RefreshHistoryList, refresh);
    };
  }, [refreshNativeHistory]);

  const historyRows = useMemo<IHomeNativeRow[]>(() => {
    const titleRow: IHomeNativeRow = {
      type: 'sectionHeader',
      key: 'history:title',
      title: intl.formatMessage({
        id: ETranslations.global_history,
      }),
    };

    if (!isSupported) {
      return [
        titleRow,
        {
          type: 'empty',
          key: 'history:no-wallet',
          title: intl.formatMessage({ id: ETranslations.global_no_wallet }),
          estimatedHeight: 88,
        },
      ];
    }

    if (historyState.isRefreshing && historyData.length === 0) {
      return [
        titleRow,
        {
          type: 'loading',
          key: 'history:loading',
          rows: 6,
          estimatedHeight: 72,
        },
      ];
    }

    if (historyState.initialized && historyData.length === 0) {
      return [
        titleRow,
        {
          type: 'empty',
          key: 'history:empty',
          title: intl.formatMessage({ id: ETranslations.global_no_data }),
          estimatedHeight: 88,
        },
      ];
    }

    return [
      titleRow,
      ...historyData.map((history) =>
        buildNativeHistoryRow({
          history,
          hideValue: settingsValue.hideValue,
        }),
      ),
    ];
  }, [
    historyData,
    historyState.initialized,
    historyState.isRefreshing,
    intl,
    isSupported,
    settingsValue.hideValue,
  ]);

  const historyById = useMemo(() => {
    const result: Record<string, IAccountHistoryTx> = {};
    for (const history of historyData) {
      result[history.id] = history;
    }
    return result;
  }, [historyData]);

  const handleHistoryRowPress = useCallback(
    async (rowKey: string) => {
      const historyId = getHistoryKeyFromNativeRowKey(rowKey);
      const history = historyById[historyId];

      if (!history || !account || !network) {
        return;
      }

      if (
        history.decodedTx.status === EDecodedTxStatus.Pending &&
        history.isLocalCreated
      ) {
        const localTx =
          await backgroundApiProxy.serviceHistory.getLocalHistoryTxById({
            accountId: history.decodedTx.accountId,
            networkId: history.decodedTx.networkId,
            historyId: history.id,
          });
        if (!localTx || localTx.replacedNextId) {
          return;
        }
      }

      navigation.pushModal(EModalRoutes.MainModal, {
        screen: EModalAssetDetailRoutes.HistoryDetails,
        params: {
          networkId: history.decodedTx.networkId,
          accountId: history.decodedTx.accountId,
          historyTx: history,
          isAllNetworks: network.isAllNetworks,
        },
      });
    },
    [account, historyById, navigation, network],
  );

  const refreshNativeHistoryManually = useCallback(async () => {
    isManualRefreshRef.current = true;
    await refreshNativeHistory();
  }, [refreshNativeHistory]);

  return {
    handleHistoryRowPress,
    historyRows,
    isRefreshing: historyState.isRefreshing,
    refreshNativeHistory: refreshNativeHistoryManually,
  };
}
