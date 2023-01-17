import { useEffect, useState } from 'react';

import type { IHistoryTx } from '@onekeyhq/engine/src/vaults/types';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import { useAppSelector } from './redux';
import { useNetwork } from './useNetwork';

export function useFilterScamHistory({
  accountId,
  networkId,
  history,
}: {
  accountId: string | null | undefined;
  networkId: string | null | undefined;
  history: IHistoryTx[];
}) {
  const [filteredHistory, setFilteredHistory] = useState<IHistoryTx[]>([]);

  const hideScamHistory = useAppSelector((s) => s.settings.hideScamHistory);
  const { network } = useNetwork({ networkId });

  useEffect(() => {
    if (
      !hideScamHistory ||
      !accountId ||
      !network ||
      !network?.settings?.supportFilterScam
    ) {
      setFilteredHistory(history);
      return;
    }

    (async () => {
      const result: IHistoryTx[] = [];
      for (let i = 0; i < history.length; i += 1) {
        const isScam = await backgroundApiProxy.engine.checkIsScamHistoryTx({
          accountId,
          networkId: network.id,
          historyTx: history[i],
        });
        if (!isScam) {
          result.push(history[i]);
        }
      }
      setFilteredHistory(result);
    })();
  }, [accountId, network, history, hideScamHistory]);
  return {
    filteredHistory,
  };
}
