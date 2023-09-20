import type { FC } from 'react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Box, Button, Hidden, IconButton } from '@onekeyhq/components';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/routesEnum';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { NFTMarketRoutes } from '../Modals/type';

import { CollectionDetailContext } from './context';
import Screen from './Screen';

import type { HomeRoutes } from '../../../routes/routesEnum';
import type { HomeRoutesParams } from '../../../routes/types';
import type { NFTMarketRoutesParams } from '../Modals/type';
import type { CollectionDetailContextValue } from './context';
import type { RouteProp } from '@react-navigation/core';

type NavigationProps = ModalScreenProps<NFTMarketRoutesParams>;

const FilterButton: FC<{
  onPromise?: () => Promise<any>;
  isDisabled?: boolean;
}> = ({ onPromise, isDisabled }) => {
  const intl = useIntl();
  return (
    <>
      <Hidden from="md">
        <IconButton
          isDisabled={isDisabled}
          name="BarsShrinkOutline"
          size="lg"
          type="plain"
          circle
          onPromise={onPromise}
        />
      </Hidden>
      <Hidden till="md">
        <Button
          isDisabled={isDisabled}
          leftIconName="BarsShrinkMini"
          onPromise={onPromise}
        >
          {intl.formatMessage({ id: 'title__filter' })}
        </Button>
      </Hidden>
    </>
  );
};

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
  const { serviceNFT } = backgroundApiProxy;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: '',
    });
  }, [collection?.contractName, collection?.name, navigation, title]);

  const isFilter = useMemo(() => {
    const find = context.attributes.find(
      (item) => item.attribute_values.length > 0,
    );
    return !!find;
  }, [context.attributes]);
  const { collection: ctxCollection } = context;

  const headerRight = useCallback(() => {
    if (ctxCollection) {
      return (
        <Box mr={{ base: 2.5, md: 8 }}>
          <FilterButton
            isDisabled={!ctxCollection.hasAttributes}
            onPromise={async () => {
              if (
                typeof ctxCollection.attributes === 'undefined' ||
                ctxCollection.attributes.length === 0
              ) {
                const data = await serviceNFT.getCollectionAttributes({
                  chain: networkId,
                  contractAddress,
                });
                ctxCollection.attributes = data;
              }
              navigation.navigate(RootRoutes.Modal, {
                screen: ModalRoutes.NFTMarket,
                params: {
                  screen: NFTMarketRoutes.FilterModal,
                  params: {
                    collection: ctxCollection,
                    attributes: context.attributes,
                    onAttributeSelected: (attributes) => {
                      setContext((ctx) => ({
                        ...ctx,
                        refreshing: true,
                        attributes,
                      }));
                    },
                  },
                },
              });
            }}
          />
          {isFilter && (
            <Box
              top={{ base: 1, md: -1.5 }}
              right={{ base: 1, md: -1.5 }}
              position="absolute"
              size="12px"
              bgColor="interactive-default"
              borderRadius="full"
              borderWidth="2px"
              borderColor="background-default"
            />
          )}
        </Box>
      );
    }
  }, [
    context.attributes,
    contractAddress,
    ctxCollection,
    isFilter,
    navigation,
    networkId,
    serviceNFT,
  ]);

  useEffect(() => {
    if (ctxCollection) {
      navigation.setOptions({
        headerRight,
      });
    }
  }, [ctxCollection, headerRight, navigation]);

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

  const contextValue = useMemo(() => ({ context, setContext }), [context]);
  return (
    <CollectionDetailContext.Provider value={contextValue}>
      <Screen />
    </CollectionDetailContext.Provider>
  );
};

export default CollectionDetail;
