import { useCallback, useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';

import type { Network } from '@onekeyhq/engine/src/types/network';
import type { Collection } from '@onekeyhq/engine/src/types/nft';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

import { useNetworks } from '../../../hooks/redux';
import { HomeRoutes } from '../../../routes/routesEnum';

import type { HomeRoutesParams } from '../../../routes/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const ethNetwokId = OnekeyNetwork.eth;

type NavigationProps = NativeStackNavigationProp<
  HomeRoutesParams,
  HomeRoutes.NFTMarketCollectionScreen
>;

export function useDefaultNetWork() {
  const networks = useNetworks();
  return useMemo(() => {
    const ethNetWork = networks.find((n) => n.id === ethNetwokId);
    return ethNetWork as Network;
  }, [networks]);
}

export function useCollectionDetail() {
  const navigation = useNavigation<NavigationProps>();

  const goToCollectionDetail = useCallback(
    ({
      collection,
      networkId,
      contractAddress,
      title,
    }: {
      collection?: Collection;
      networkId: string;
      contractAddress: string;
      title?: string;
    }) => {
      navigation.navigate(HomeRoutes.NFTMarketCollectionScreen, {
        networkId,
        contractAddress,
        collection,
        title,
      });
    },
    [navigation],
  );
  return goToCollectionDetail;
}
