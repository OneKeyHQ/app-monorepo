import type { Collection, INFTAsset } from '@onekeyhq/engine/src/types/nft';

import { getAppNavigation } from '../../../hooks/useAppNavigation';
import {
  CollectiblesModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '../../../routes/routesEnum';

export function convertToMoneyFormat(number: string) {
  const absValue = Math.abs(Number(number));
  const units = [
    { unit: 'B', value: 1.0e9 },
    { unit: 'M', value: 1.0e6 },
    { unit: 'K', value: 1.0e3 },
  ];
  for (const { unit, value } of units) {
    if (absValue >= value) {
      return `${(absValue / value)
        .toFixed(2)
        .replace(/([0-9]+(\.[0-9]+[1-9])?)(\.?0+$)/, '$1')}${unit}`;
    }
  }
  return absValue.toString();
}

function navigateToNFTCollection({
  accountId,
  networkId,
  collection,
}: {
  accountId: string;
  networkId: string;
  collection: Collection;
}) {
  const navigation = getAppNavigation();
  if (!accountId || !networkId) return;
  navigation.navigate(RootRoutes.Modal, {
    screen: ModalRoutes.Collectibles,
    params: {
      screen: CollectiblesModalRoutes.CollectionModal,
      params: {
        collectible: collection,
        networkId,
        accountId,
      },
    },
  });
}

function navigateToNFTDetail({
  accountId,
  networkId,
  asset,
}: {
  accountId: string;
  networkId: string;
  asset: INFTAsset;
}) {
  const navigation = getAppNavigation();
  if (!accountId || !networkId) return;
  navigation.navigate(RootRoutes.Modal, {
    screen: ModalRoutes.Collectibles,
    params: {
      screen: CollectiblesModalRoutes.NFTDetailModal,
      params: {
        asset,
        accountId,
        networkId,
        isOwner: true,
      },
    },
  });
}

export { navigateToNFTCollection, navigateToNFTDetail };
