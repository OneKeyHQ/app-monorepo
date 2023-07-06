import type { Account } from '@onekeyhq/engine/src/types/account';
import type { Network } from '@onekeyhq/engine/src/types/network';
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
  account,
  network,
  collection,
}: {
  account: Account;
  network: Network;
  collection: Collection;
}) {
  const navigation = getAppNavigation();
  if (!account || !network) return;
  navigation.navigate(RootRoutes.Modal, {
    screen: ModalRoutes.Collectibles,
    params: {
      screen: CollectiblesModalRoutes.CollectionModal,
      params: {
        collectible: collection,
        network,
      },
    },
  });
}

function navigateToNFTDetail({
  account,
  network,
  asset,
}: {
  account: Account;
  network: Network;
  asset: INFTAsset;
}) {
  const navigation = getAppNavigation();
  if (!account || !network) return;
  if (!network) return;
  navigation.navigate(RootRoutes.Modal, {
    screen: ModalRoutes.Collectibles,
    params: {
      screen: CollectiblesModalRoutes.NFTDetailModal,
      params: {
        asset,
        network,
        isOwner: true,
      },
    },
  });
}

export { navigateToNFTCollection, navigateToNFTDetail };
