import { useCallback, useEffect, useState } from 'react';

import BigNumber from 'bignumber.js';

import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import {
  getTaprootXpub,
  isTaprootXpubSegwit,
} from '@onekeyhq/engine/src/vaults/utils/btcForkChain/utils';
import { isBRC20Token } from '@onekeyhq/shared/src/utils/tokenUtils';

import { useBRC20AmountList } from './useBRC20AmountList';

function useBRC20TokenRecycleBalance({
  networkId,
  xpub,
  address,
  tokenAddress,
}: {
  networkId: string | undefined;
  xpub: string | undefined;
  address: string | undefined;
  tokenAddress: string | undefined;
}) {
  const [recycleBalance, setRecycleBalance] = useState<string>('0');

  const { amountList } = useBRC20AmountList({
    networkId,
    tokenAddress,
    address,
    xpub,
  });

  const refreshRecycleBalance = useCallback(async () => {
    const recycleUtxos = (
      await simpleDb.utxoAccounts.getCoinControlList(
        networkId ?? '',
        isTaprootXpubSegwit(xpub ?? '')
          ? getTaprootXpub(xpub ?? '')
          : xpub ?? '',
      )
    ).filter((utxo) => utxo.recycle);

    const recycleAmountList = amountList.filter((item) =>
      recycleUtxos.find((utxo) => {
        const [txid, output] = utxo.key.split('_');
        const amountId = item.inscriptionId.slice(0, -2);
        const amountOutout = item.inscriptionId.slice(-1);
        return txid === amountId && output === amountOutout;
      }),
    );

    setRecycleBalance(
      recycleAmountList.reduce(
        (acc, cur) => new BigNumber(acc).plus(cur.amount).toFixed(),
        '0',
      ),
    );
  }, [amountList, networkId, xpub]);

  useEffect(() => {
    if (
      networkId &&
      xpub &&
      address &&
      tokenAddress &&
      isBRC20Token(tokenAddress)
    ) {
      refreshRecycleBalance();
    }
  }, [address, refreshRecycleBalance, networkId, tokenAddress, xpub]);

  return { recycleBalance, refreshRecycleBalance };
}

export { useBRC20TokenRecycleBalance };
