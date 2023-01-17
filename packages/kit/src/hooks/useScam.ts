import { useEffect, useState } from 'react';

import type { IHistoryTx } from '@onekeyhq/engine/src/vaults/types';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import { useAppSelector } from './redux';

export function useFilterScamHistory({
  accountId,
  networkId,
  history,
}: {
  accountId: string | null | undefined;
  networkId: string | null | undefined;
  history: IHistoryTx[];
}) {
  const hideScamHistory = useAppSelector((s) => s.settings.hideScamHistory);
  const [filteredHistory, setFilteredHistory] = useState<IHistoryTx[]>([]);

  useEffect(() => {
    if (!hideScamHistory || !accountId || !networkId) {
      setFilteredHistory(history);
      return;
    }

    (async () => {
      const result: IHistoryTx[] = [];
      for (let i = 0; i < history.length; i += 1) {
        const isScam = await backgroundApiProxy.engine.checkIsScamHistory({
          accountId,
          networkId,
          history: history[i],
        });
        if (!isScam) {
          result.push(history[i]);
        }
      }
      setFilteredHistory(result);
    })();
  }, [accountId, networkId, history, hideScamHistory]);
  return {
    filteredHistory,
  };
}
