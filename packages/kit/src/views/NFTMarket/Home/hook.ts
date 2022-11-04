import { useCallback, useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';

import { OnekeyNetwork } from '@onekeyhq/engine/src/presets/networkIds';
import { Network } from '@onekeyhq/engine/src/types/network';
import { Collection } from '@onekeyhq/engine/src/types/nft';

import { useManageNetworks } from '../../../hooks';
import { HomeRoutes, HomeRoutesParams } from '../../../routes/types';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const ethNetwokId = OnekeyNetwork.eth;

type NavigationProps = NativeStackNavigationProp<
  HomeRoutesParams,
  HomeRoutes.NFTMarketCollectionScreen
>;

export function useDefaultNetWork() {
  const { enabledNetworks: networks } = useManageNetworks();
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
    }: {
      collection?: Collection;
      networkId: string;
      contractAddress: string;
    }) => {
      navigation.navigate(HomeRoutes.NFTMarketCollectionScreen, {
        networkId,
        contractAddress,
        collection,
      });
    },
    [navigation],
  );
  return goToCollectionDetail;
}
