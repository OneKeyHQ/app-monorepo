import { useEffect, useState } from 'react';

import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import type { CoinControlItem } from '@onekeyhq/engine/src/types/utxoAccounts';

function useCoinControlList({
  xpub,
  networkId,
}: {
  xpub: string | undefined;
  networkId: string | undefined;
}) {
  const [frozenUtxos, setFrozenUtxos] = useState<CoinControlItem[]>([]);
  const [recycleUtxos, setRecycleUtxos] = useState<CoinControlItem[]>([]);

  useEffect(() => {
    const fetchCoinControlList = async () => {
      if (xpub && networkId) {
        const archivedUtxos = await simpleDb.utxoAccounts.getCoinControlList(
          networkId,
          xpub,
        );
        setFrozenUtxos(archivedUtxos.filter((utxo) => utxo.frozen));
        setRecycleUtxos(archivedUtxos.filter((utxo) => utxo.recycle));
      }
    };
    fetchCoinControlList();
  });

  return {
    frozenUtxos,
    recycleUtxos,
  };
}

export { useCoinControlList };
