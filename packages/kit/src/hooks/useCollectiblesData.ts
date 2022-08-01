import { useCallback, useEffect, useMemo, useState } from 'react';

import { getAllNFTs } from '@onekeyhq/engine/src/managers/nftscan';
import { Network } from '@onekeyhq/engine/src/types/network';
import {
  Collectible,
  NFTScanNFTsResp,
} from '@onekeyhq/engine/src/types/nftscan';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { cursorMapSet } from '../store/reducers/data';

import { useAppSelector } from './redux';

const cacheMainKey = (address: string, network: Network) =>
  `${address.toLowerCase()}-${network.id}`.toLowerCase();

// userAddress-networkId -> collection Address -> Collection[]
const USER_COLLECTIBLE_CACHE = new Map<string, Collectible[]>();

export const getCollectibleCache = (key: string) => {
  const collectibles = USER_COLLECTIBLE_CACHE.get(key) ?? [];
  return collectibles;
};

// export const updateAssetDateToCache = (
//   address: string,
//   network: Network,
//   asset: MoralisNFT,
//   metadata: MoralisMetadata,
// ) => {
//   if (asset.name) {
//     const mainKey = cacheMainKey(address, network);
//     const mainKeyData = USER_COLLECTIBLE_CACHE.get(mainKey);
//     if (mainKeyData) {
//       const collectionData = mainKeyData.get(asset.name);
//       if (collectionData) {
//         const { assets } = collectionData;
//         if (assets && assets?.length > 0) {
//           collectionData.assets = assets.map((item) => {
//             if (
//               item.tokenHash === asset.tokenHash &&
//               item.tokenAddress === asset.tokenAddress
//             ) {
//               item.assetName = metadata.name ?? metadata.title;
//               item.description = metadata.description;
//               item.attributes = metadata.attributes;
//             }
//             return item;
//           });
//           mainKeyData.set(asset.name, collectionData);
//           USER_COLLECTIBLE_CACHE.set(mainKey, mainKeyData);
//         }
//       }
//     }
//   }
// };

export const useCollectibleCache = (userAddress: string, network: Network) => {
  const mainKey = cacheMainKey(userAddress, network);
  const cache = useMemo(() => USER_COLLECTIBLE_CACHE.get(mainKey), [mainKey]);
  return cache;
};

export const parseCollectiblesData = (
  nftsResp: NFTScanNFTsResp,
  mainKey: string,
) => {
  const collectibles = USER_COLLECTIBLE_CACHE.get(mainKey) ?? [];
  const { data } = nftsResp;
  if (collectibles) {
    USER_COLLECTIBLE_CACHE.set(mainKey, data ?? []);
  }
};

type UseCollectiblesDataArgs = {
  address?: string | null;
  network?: Network | null;
  isCollectibleSupported?: boolean;
};

type UseCollectiblesDataReturn = {
  collectibles: Collectible[];
  isLoading: boolean;
  fetchData: () => void;
};

// const updateCursor = (key: string, cursor: string) => {
//   backgroundApiProxy.dispatch(cursorMapSet({ key, cursor }));
// };

// const useCursorStatus = (key: string) => {
//   const cursorMap = useAppSelector((s) => s.data.cursorMap);
//   return cursorMap[key];
// };

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

  // const cursor = useCursorStatus(mainKey);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const getData = useCallback(async () => {
    if (isCollectibleSupported && mainKey) {
      const result = await getAllNFTs({
        address,
        network,
      });
      parseCollectiblesData(result, mainKey);
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCollectibleSupported, mainKey]);

  const fetchData = useCallback(() => {
    setIsLoading(true);
  }, []);

  useEffect(() => {
    if (isLoading) {
      getData();
    }
  }, [getData, isCollectibleSupported, isLoading, mainKey]);

  return useMemo(() => {
    console.log('return = ', mainKey);

    if (!isCollectibleSupported || !mainKey) {
      return {
        fetchData,
        isLoading: false,
        collectibles: [],
      };
    }
    const collectibles = getCollectibleCache(mainKey);
    return {
      isLoading,
      fetchData,
      collectibles,
    };
  }, [fetchData, isCollectibleSupported, isLoading, mainKey]);
};
