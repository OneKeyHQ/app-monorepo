import React, { useCallback } from 'react';

import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'moti';
import { useIntl } from 'react-intl';

import {
  Box,
  HStack,
  Hidden,
  Icon,
  IconButton,
  Pressable,
  Text,
} from '@onekeyhq/components';
import {
  ModalRoutes,
  ModalScreenProps,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/types';

import {
  SearchNFTCollectionRoutes,
  SearchNFTCollectionRoutesParams,
} from '../../NFTSearchModal/type';
import { useCollectionDetail } from '../hook';

type NavigationProps = ModalScreenProps<SearchNFTCollectionRoutesParams>;

const PageHeader = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const goToCollectionDetail = useCollectionDetail();

  const searchAction = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.SearchNFT,
      params: {
        screen: SearchNFTCollectionRoutes.SearchModal,
        params: {
          onSelectCollection: ({ networkId, contractAddress }) => {
            goToCollectionDetail({
              networkId,
              contractAddress,
            });
          },
        },
      },
    });
  }, [goToCollectionDetail, navigation]);

  return (
    <SafeAreaView>
      <HStack
        height={{ base: '56px', md: '64px' }}
        alignItems="center"
        px={{ base: '16px', md: '32px' }}
      >
        {/* Left */}
        <HStack flex={1} alignItems="center">
          <Text typography={{ sm: 'PageHeading', md: 'Heading' }}>NFT</Text>
          <Hidden from="base" till="md">
            <HStack alignItems="center">
              <Box ml="16px" mr="8px" h="16px" w="1px" bgColor="divider" />
              <Pressable
                onPress={() => {
                  searchAction();
                }}
                flexDirection="row"
                p="8px"
                borderRadius="xl"
                _hover={{ bg: 'surface-hovered' }}
                _pressed={{ bg: 'surface-pressed' }}
              >
                <Icon name="SearchSolid" size={20} />
                <Text typography="Body2" color="text-subdued" ml={2}>
                  {intl.formatMessage({ id: 'form__nft_search_placeholder' })}
                </Text>
              </Pressable>
            </HStack>
          </Hidden>
        </HStack>
        {/* Right */}
        <Hidden from="md">
          <IconButton
            type="basic"
            size="sm"
            name="SearchSolid"
            circle
            hitSlop={8}
            onPress={() => {
              searchAction();
            }}
          />
        </Hidden>
      </HStack>
    </SafeAreaView>
  );
};

export default PageHeader;
