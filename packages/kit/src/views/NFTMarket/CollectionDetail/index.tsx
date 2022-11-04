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
  const { networkId, collection, contractAddress } = route.params;
  const [context, setContext] = useState<CollectionDetailContextValue>({
    selectedIndex: 0,
    collection,
  });
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({
      title: collection?.contractName,
    });
  }, [collection?.contractName, navigation]);

  useEffect(() => {
    navigation.setOptions({
      title: context.collection?.contractName,
    });
  }, [context.collection?.contractName, navigation]);

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
