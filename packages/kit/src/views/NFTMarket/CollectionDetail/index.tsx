import React, { useEffect, useLayoutEffect, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { HomeRoutes } from '../../../routes/routesEnum';
import { HomeRoutesParams } from '../../../routes/types';

import {
  CollectionDetailContext,
  CollectionDetailContextValue,
} from './context';
import Screen from './Screen';

const CollectionDetail = () => {
  const route =
    useRoute<
      RouteProp<HomeRoutesParams, HomeRoutes.NFTMarketCollectionScreen>
    >();
  const { networkId, collection, contractAddress, title } = route.params;
  const [context, setContext] = useState<CollectionDetailContextValue>({
    selectedIndex: 0,
    collection,
    assetList: [],
    txList: [],
  });
  const navigation = useNavigation();

  console.log('title = ', title);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: '',
    });
  }, [collection?.contractName, collection?.name, navigation, title]);

  const { serviceNFT } = backgroundApiProxy;

  useEffect(() => {
    (async () => {
      setContext((ctx) => ({
        ...ctx,
        loading: true,
      }));
      const data = await serviceNFT.getCollection({
        chain: networkId,
        contractAddress,
        showStatistics: true,
      });
      if (data) {
        setContext((ctx) => ({
          ...ctx,
          collection: data,
          loading: false,
        }));
      }
    })();
  }, [contractAddress, networkId, serviceNFT]);

  return (
    <CollectionDetailContext.Provider value={{ context, setContext }}>
      <Screen />
    </CollectionDetailContext.Provider>
  );
};

export default CollectionDetail;
