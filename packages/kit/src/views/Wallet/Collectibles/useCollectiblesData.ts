import { useCallback, useEffect, useMemo, useState } from 'react';

import { getUserNFTAssets } from '@onekeyhq/engine/src/managers/nft';
import { Network } from '@onekeyhq/engine/src/types/network';
import { Collection, NFTScanNFTsResp } from '@onekeyhq/engine/src/types/nft';

const cacheMainKey = (address: string, network: Network) =>
  `${address.toLowerCase()}-${network.id}`.toLowerCase();

// userAddress-networkId -> collection Address -> Collection[]
const USER_COLLECTIBLE_CACHE = new Map<string, Collection[]>();

export const getCollectibleCache = (key: string) => {
  const collectibles = USER_COLLECTIBLE_CACHE.get(key) ?? [];
  return collectibles;
};

export const useCollectibleCache = (userAddress: string, network: Network) => {
  const mainKey = cacheMainKey(userAddress, network);
  const cache = useMemo(() => USER_COLLECTIBLE_CACHE.get(mainKey), [mainKey]);
  return cache;
};

export const parseCollectiblesData = (
  nftsResp: NFTScanNFTsResp,
  mainKey: string,
) => {
  const { data } = nftsResp;
  if (data) {
    USER_COLLECTIBLE_CACHE.set(mainKey, data ?? []);
  }
};

type UseCollectiblesDataArgs = {
  address?: string | null;
  network?: Network | null;
  isCollectibleSupported?: boolean;
};

type UseCollectiblesDataReturn = {
  collectibles: Collection[];
  isLoading: boolean;
  fetchData: () => void;
};

export const useCollectiblesData = ({
  address,
  network,
  isCollectibleSupported,
}: UseCollectiblesDataArgs): UseCollectiblesDataReturn => {
  const mainKey = useMemo(() => {
    if (!address || !network) {
      return '';
    }
    return cacheMainKey(address, network);
  }, [address, network]);

  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [listData, updateListData] = useState<Collection[]>(
    getCollectibleCache(mainKey),
  );
  const getData = useCallback(async () => {
    if (isCollectibleSupported && mainKey) {
      updateListData(getCollectibleCache(mainKey));
      setIsLoading(true);
      const result = await getUserNFTAssets({
        address,
        network,
      });
      parseCollectiblesData(result, mainKey);
      updateListData(getCollectibleCache(mainKey));
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCollectibleSupported, mainKey]);

  useEffect(() => {
    let isSubscribed = true;
    if (isCollectibleSupported && mainKey) {
      updateListData(getCollectibleCache(mainKey));
      setIsLoading(true);
      getUserNFTAssets({
        address,
        network,
      }).then((result) => {
        if (isSubscribed) {
          parseCollectiblesData(result, mainKey);
          updateListData(getCollectibleCache(mainKey));
          setIsLoading(false);
        }
      });
    }
    return () => {
      isSubscribed = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCollectibleSupported, mainKey]);

  return useMemo(() => {
    if (!isCollectibleSupported || !mainKey) {
      return {
        fetchData: getData,
        isLoading: false,
        collectibles: [],
      };
    }

    return {
      isLoading,
      fetchData: getData,
      collectibles: listData,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getData, isLoading, listData, mainKey]);
};
