import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIsFocused } from '@react-navigation/native';
import useSWR from 'swr';

import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import { getFiatEndpoint } from '@onekeyhq/engine/src/endpoint';
import type { NFTBTCAssetModel } from '@onekeyhq/engine/src/types/nft';
import { RestfulRequest } from '@onekeyhq/shared/src/request/RestfulRequest';

export function useBRC20Inscriptions({
  networkId,
  address,
  tokenAddress,
  isPolling,
  xpub,
  pollingInterval = 30 * 1000,
}: {
  networkId: string | undefined;
  address: string | undefined;
  tokenAddress: string | undefined;
  xpub: string | undefined;
  isPolling?: boolean;
  pollingInterval?: number;
}) {
  const [inscriptions, setInscriptions] = useState<NFTBTCAssetModel[]>();
  const [availableInscriptions, setAvailableInscriptions] =
    useState<NFTBTCAssetModel[]>();
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const isFocused = useIsFocused();

  const fetchBRC20Inscriptions = useCallback(async () => {
    const req = new RestfulRequest(getFiatEndpoint(), {}, 60 * 1000);

    const query = {
      chain: networkId,
      address,
      tokenAddress,
    };

    setIsLoading(true);

    try {
      const resp = (await req
        .get('/NFT/v2/list', query)
        .then((r) => r.json())) as { data: NFTBTCAssetModel[] };

      const archivedUtxos = await simpleDb.utxoAccounts.getCoinControlList(
        networkId ?? '',
        xpub ?? '',
      );

      const recycleUtxos = archivedUtxos.filter((utxo) => utxo.recycle);
      setInscriptions(resp.data);
      setAvailableInscriptions(
        resp.data.filter((inscription) => {
          const [inscriptionTxId, inscriptionVout] =
            inscription.output.split(':');

          return !recycleUtxos.find((utxo) => {
            const [txId, vout] = utxo.key.split('_');
            return inscriptionTxId === txId && inscriptionVout === vout;
          });
        }),
      );
    } catch (e) {
      // pass
      console.log('fetchBRC20Inscriptions error', e);
    }
    setIsLoading(false);
  }, [address, networkId, xpub, tokenAddress]);

  const shouldDoRefresh = useMemo((): boolean => {
    if (!networkId || !address || !tokenAddress || !isPolling || !xpub) {
      return false;
    }
    if (!isFocused) {
      return false;
    }
    return true;
  }, [address, isFocused, isPolling, networkId, tokenAddress, xpub]);

  const swrKey = 'fetchBRC20Inscriptions';
  const { mutate } = useSWR(swrKey, fetchBRC20Inscriptions, {
    refreshInterval: pollingInterval,
    revalidateOnMount: false,
    revalidateOnFocus: false,
    shouldRetryOnError: false,
    isPaused() {
      return !shouldDoRefresh;
    },
  });

  useEffect(() => {
    if (shouldDoRefresh) {
      mutate();
    } else {
      fetchBRC20Inscriptions();
    }
  }, [mutate, shouldDoRefresh, networkId, fetchBRC20Inscriptions]);

  return { inscriptions, availableInscriptions, isLoading, mutate, fetchBRC20Inscriptions };
}
