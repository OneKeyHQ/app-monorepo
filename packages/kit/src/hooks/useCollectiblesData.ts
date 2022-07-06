import { useCallback, useEffect, useMemo } from 'react';

import { getUserAssets } from '@onekeyhq/engine/src/managers/moralis';
import {
  Collectible,
  MoralisMetadata,
  MoralisNFT,
  MoralisNFTsResp,
} from '@onekeyhq/engine/src/types/moralis';
import { Network } from '@onekeyhq/engine/src/types/network';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { cursorMapSet } from '../store/reducers/data';

import { useAppSelector } from './redux';

const cacheMainKey = (address: string, network: Network) =>
  `${address.toLowerCase()}-${network.id}`.toLowerCase();

// userAddress-networkId -> collectionName -> Collectible
const USER_COLLECTIBLE_CACHE = new Map<string, Map<string, Collectible>>();

export const getCollectibleCache = (key: string) => {
  const collectibles =
    USER_COLLECTIBLE_CACHE.get(key) ?? new Map<string, Collectible>();
  return Array.from(collectibles.values());
};

export const updateAssetDateToCache = (
  address: string,
  network: Network,
  asset: MoralisNFT,
  metadata: MoralisMetadata,
) => {
  if (asset.name) {
    const mainKey = cacheMainKey(address, network);
    const mainKeyData = USER_COLLECTIBLE_CACHE.get(mainKey);
    if (mainKeyData) {
      const collectionData = mainKeyData.get(asset.name);
      if (collectionData) {
        const { assets } = collectionData;
        if (assets && assets?.length > 0) {
          collectionData.assets = assets.map((item) => {
            if (
              item.tokenHash === asset.tokenHash &&
              item.tokenAddress === asset.tokenAddress
            ) {
              item.assetName = metadata.name ?? metadata.title;
              item.description = metadata.description;
              item.attributes = metadata.attributes;
            }
            return item;
          });
          mainKeyData.set(asset.name, collectionData);
          USER_COLLECTIBLE_CACHE.set(mainKey, mainKeyData);
        }
      }
    }
  }
};

export const useCollectibleCache = (
  userAddress: string,
  network: Network,
  collectionAddress: string,
) => {
  const mainKey = `${userAddress.toLowerCase()}-${network.id}`.toLowerCase();
  const cache = useMemo(
    () => USER_COLLECTIBLE_CACHE.get(mainKey)?.get(collectionAddress),
    [collectionAddress, mainKey],
  );
  return cache;
};

export const parseCollectiblesData = (
  nftsResp: MoralisNFTsResp,
  mainKey: string,
): Collectible[] => {
  const assets = nftsResp.result;
  const collectibles =
    USER_COLLECTIBLE_CACHE.get(mainKey) ?? new Map<string, Collectible>();

  if (assets) {
    assets.forEach((asset) => {
      const uniqueName = asset.name;
      if (uniqueName) {
        const collectible = collectibles.get(uniqueName);
        if (collectible) {
          if (
            !collectible.assets.find(
              (item) =>
                item.tokenAddress === asset.tokenAddress &&
                item.tokenId === asset.tokenId,
            )
          ) {
            collectible.assets.push(asset);
          }
        } else {
          collectibles.set(uniqueName, {
            id: uniqueName,
            chain: nftsResp.chain,
            assets: [asset],
            collection: {
              name: asset.name,
            },
          });
        }
      }
    });
  }
  // Use lowercase address in case of case-insensitive address
  USER_COLLECTIBLE_CACHE.set(mainKey, collectibles);
  return Array.from(collectibles.values());
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

const updateCursor = (key: string, cursor: string) => {
  backgroundApiProxy.dispatch(cursorMapSet({ key, cursor }));
};

const useCursorStatus = (key: string) => {
  const cursorMap = useAppSelector((s) => s.data.cursorMap);
  return cursorMap[key];
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

  const cursor = useCursorStatus(mainKey);

  const getData = useCallback(async () => {
    if (isCollectibleSupported && mainKey) {
      if (cursor !== '') {
        const result = await getUserAssets({
          address,
          network,
          cursor: cursor !== 'begin' ? cursor : undefined,
        });

        if (result.success === false || result.cursor === '') {
          updateCursor(mainKey, '');
        } else if (result.cursor) {
          parseCollectiblesData(result, mainKey);
          updateCursor(mainKey, result.cursor);
        }
      }
    }
  }, [address, cursor, isCollectibleSupported, mainKey, network]);

  const fetchData = useCallback(() => {
    if (mainKey) {
      updateCursor(mainKey, 'begin');
    }
  }, [mainKey]);

  useEffect(() => {
    getData();
  }, [getData, isCollectibleSupported, mainKey]);

  return useMemo(() => {
    if (!isCollectibleSupported || !mainKey) {
      return {
        fetchData,
        isLoading: false,
        collectibles: [],
      };
    }
    const collectibles = getCollectibleCache(mainKey);
    return {
      isLoading: cursor === 'begin' || cursor === undefined,
      fetchData,
      collectibles,
    };
  }, [cursor, fetchData, isCollectibleSupported, mainKey]);
};
