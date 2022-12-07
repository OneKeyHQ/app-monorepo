import React, {
  FC,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';

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

const FilterButton: FC<{ onPress?: () => void; isDisabled?: boolean }> = ({
  onPress,
  isDisabled,
}) => {
  const intl = useIntl();
  return (
    <>
      <Hidden from="md">
        <IconButton
          isDisabled={isDisabled}
          name="BarsShrinkMini"
          size="sm"
          circle
          onPress={onPress}
        />
      </Hidden>
      <Hidden till="md">
        <Button
          isDisabled={isDisabled}
          leftIconName="BarsShrinkMini"
          onPress={onPress}
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
  const intl = useIntl();

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
  useEffect(() => {
    if (ctxCollection) {
      let mr = platformEnv.isWeb ? '32px' : '16px';
      if (platformEnv.isNativeAndroid) {
        mr = '0px';
      }
      navigation.setOptions({
        headerRight: () => (
          <Box mr={mr}>
            <FilterButton
              isDisabled={
                ctxCollection.attributes &&
                ctxCollection.attributes.length === 0
              }
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
                top="-2px"
                right="0px"
                position="absolute"
                size="10px"
                bgColor="interactive-default"
                borderRadius="full"
                borderWidth="1px"
                borderColor="background-default"
              />
            )}
          </Box>
        ),
      });
    }
  }, [context.attributes, ctxCollection, intl, isFilter, navigation]);

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
