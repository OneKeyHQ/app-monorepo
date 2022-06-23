import { useMemo } from 'react';

import { pick } from 'lodash';
import useSWRInfinite, { SWRInfiniteResponse } from 'swr/infinite';

import { getUserAssets } from '@onekeyhq/engine/src/managers/opensea';
import { Network } from '@onekeyhq/engine/src/types/network';
import { Collectible, OpenSeaAsset } from '@onekeyhq/engine/src/types/opensea';

// userAddress -> collectionName -> Collectible
const USER_COLLECTIBLE_CACHE = new Map<string, Map<string, Collectible>>();

export const useCollectibleCache = (
  userAddress: string,
  collectionAddress: string,
) => {
  const cache = useMemo(
    () => USER_COLLECTIBLE_CACHE.get(userAddress)?.get(collectionAddress),
    [collectionAddress, userAddress],
  );
  return cache;
};

export const parseCollectiblesData = (
  assets: OpenSeaAsset[],
  address: string,
): Collectible[] => {
  const collectibles = new Map<string, Collectible>();

  for (const asset of assets) {
    // Ignore video and audio by now
    // Use lowercase address in case of case-insensitive address
    const uniqueName = asset.collection.name;
    // Skip if the unique name is undefined
    if (uniqueName) {
      const collectible = collectibles.get(uniqueName);
      if (collectible) {
        collectible.assets.push(asset);
      } else {
        collectibles.set(uniqueName, {
          id: uniqueName,
          chain: asset.chain,
          contract: asset.assetContract,
          assets: [asset],
          collection: pick(asset.collection, [
            'name',
            'slug',
            'description',
            'imageUrl',
            'bannerImageUrl',
            'largeImageUrl',
          ]),
        });
      }
    }
  }
  // Use lowercase address in case of case-insensitive address
  USER_COLLECTIBLE_CACHE.set(address.toLowerCase(), collectibles);
  return Array.from(collectibles.values());
};

// Type made for swr infinite request
type OpenSeaResponse = OpenSeaAsset[];
type CollectibleRequestParams = Parameters<typeof getUserAssets>[0];
type UseCollectiblesDataArgs = {
  address?: string | null;
  network?: Network | null;
  isCollectibleSupported?: boolean;
};
type UseCollectiblesDataReturn = {
  error?: SWRInfiniteResponse['error'];
  isLoading: boolean;
  collectibles: Collectible[];
  fetchData: () => void;
  loadMore?: () => void;
};
const ONEKEY_COLLECTIBLES_PAGE_SIZE = 50;

export const useCollectiblesData = ({
  address,
  network,
  isCollectibleSupported,
}: UseCollectiblesDataArgs): UseCollectiblesDataReturn => {
  const hasNoParams = !address || !network?.extraInfo?.networkVersion;

  // Collectibles data fetching
  const getKey = (size: number, previousPageData: OpenSeaResponse) => {
    if (!isCollectibleSupported) {
      return null;
    }
    // reached the end
    const isEndOfData = previousPageData && !previousPageData.length;
    if (isEndOfData || hasNoParams) return null;
    const params: CollectibleRequestParams = {
      account: address,
      chainId: network.extraInfo.networkVersion,
      offset: size * ONEKEY_COLLECTIBLES_PAGE_SIZE,
      limit: ONEKEY_COLLECTIBLES_PAGE_SIZE,
    };
    return params;
  };
  const assetsSwr = useSWRInfinite(getKey, (params: CollectibleRequestParams) =>
    getUserAssets(params),
  );

  return useMemo(() => {
    if (hasNoParams) {
      return {
        isLoading: false,
        fetchData: assetsSwr.mutate,
        collectibles: [],
      };
    }

    const assets = assetsSwr.data?.flat(1) ?? [];
    const collectibles = parseCollectiblesData(assets, address);
    const loadMore = () => {
      const isEmpty = !assetsSwr.data?.length;
      const isReachingEnd =
        isEmpty ||
        (assetsSwr.data &&
          assetsSwr.data[assetsSwr.data.length - 1].length <
            ONEKEY_COLLECTIBLES_PAGE_SIZE);

      if (!assetsSwr.isValidating && !isReachingEnd) {
        assetsSwr.setSize((preSize) => preSize + 1);
      }
    };

    return {
      loadMore,
      collectibles,
      fetchData: assetsSwr.mutate,
      isLoading: assetsSwr.isValidating,
    };
  }, [address, assetsSwr, hasNoParams]);
};
