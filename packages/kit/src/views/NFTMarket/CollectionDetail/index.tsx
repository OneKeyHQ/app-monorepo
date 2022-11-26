import React, { FC, useEffect, useLayoutEffect, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Box, Button, Hidden, IconButton } from '@onekeyhq/components';
import {
  ModalRoutes,
  ModalScreenProps,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { HomeRoutes } from '../../../routes/routesEnum';
import { HomeRoutesParams } from '../../../routes/types';
import {
  NFTAttributeFilterRoutes,
  NFTAttributeFilterRoutesParams,
} from '../NFTAttributesModal/type';

import {
  CollectionDetailContext,
  CollectionDetailContextValue,
} from './context';
import Screen from './Screen';

type NavigationProps = ModalScreenProps<NFTAttributeFilterRoutesParams>;

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
    filterAssetList: [],
    attributes: [],
    txList: [],
    networkId,
  });
  const navigation = useNavigation<NavigationProps['navigation']>();
  const intl = useIntl();

  useLayoutEffect(() => {
    navigation.setOptions({
      title: '',
    });
  }, [collection?.contractName, collection?.name, navigation, title]);

  const { collection: ctxCollection } = context;
  useEffect(() => {
    const FilterButton: FC<{ onPress?: () => void }> = ({ onPress }) => (
      <>
        <Hidden from="md">
          <IconButton
            name="FilterOutline"
            size="lg"
            type="plain"
            circle
            onPress={onPress}
          />
        </Hidden>
        <Hidden till="md">
          <Button leftIconName="FilterSolid" onPress={onPress}>
            {intl.formatMessage({ id: 'title__filter' })}
          </Button>
        </Hidden>
      </>
    );

    if (ctxCollection) {
      navigation.setOptions({
        headerRight: () => (
          <Box mr={platformEnv.isNative ? '16px' : '32px'}>
            <FilterButton
              onPress={() => {
                navigation.navigate(RootRoutes.Modal, {
                  screen: ModalRoutes.NFTAttributeFilter,
                  params: {
                    screen: NFTAttributeFilterRoutes.FilterModal,
                    params: {
                      collection: ctxCollection,
                      attributes: context.attributes,
                      onAttributeSelected: (attributes) => {
                        setContext((ctx) => ({
                          ...ctx,
                          attributes,
                        }));
                      },
                    },
                  },
                });
              }}
            />
          </Box>
        ),
      });
    }
  }, [context.attributes, ctxCollection, intl, navigation]);

  const { serviceNFT } = backgroundApiProxy;

  useEffect(() => {
    (async () => {
      const data = await serviceNFT.getCollection({
        chain: networkId,
        contractAddress,
        showStatistics: true,
      });
      if (data) {
        setContext((ctx) => ({
          ...ctx,
          collection: data,
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
