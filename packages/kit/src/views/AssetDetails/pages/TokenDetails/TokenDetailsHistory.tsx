import { memo, useCallback, useEffect, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { TxHistoryListView } from '@onekeyhq/kit/src/components/TxHistoryListView';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ProviderJotaiContextHistoryList } from '@onekeyhq/kit/src/states/jotai/contexts/historyList';
import { POLLING_INTERVAL_FOR_HISTORY } from '@onekeyhq/shared/src/consts/walletConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EModalAssetDetailRoutes } from '@onekeyhq/shared/src/routes/assetDetails';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import type { IProps } from '.';

function TokenDetailsHistory(
  props: IProps & {
    setHistoryInit: (value: boolean) => void;
    historyInit: boolean;
  },
) {
  const navigation = useAppNavigation();

  const { accountId, networkId, tokenInfo, historyInit, setHistoryInit } =
    props;

  /**
   * since some tokens are slow to load history,
   * they are loaded separately from the token details
   * so as not to block the display of the top details.
   */
  const {
    result: tokenHistory,
    isLoading: isLoadingTokenHistory,
    run,
  } = usePromiseResult(
    async () => {
      const r = await backgroundApiProxy.serviceHistory.fetchAccountHistory({
        accountId,
        networkId,
        tokenIdOnNetwork: tokenInfo.address,
      });
      setHistoryInit(true);
      return r.txs;
    },
    [accountId, networkId, setHistoryInit, tokenInfo.address],
    {
      watchLoading: true,
      pollingInterval: POLLING_INTERVAL_FOR_HISTORY,
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
    <ProviderJotaiContextHistoryList>
      <TxHistoryListView
        hideValue
        initialized={historyInit}
        isLoading={isLoadingTokenHistory}
        data={tokenHistory ?? []}
        onPressHistory={handleHistoryItemPress}
      />
    </ProviderJotaiContextHistoryList>
  );
}

export default memo(TokenDetailsHistory);
