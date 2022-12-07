import React, { useCallback } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  HStack,
  Hidden,
  Icon,
  IconButton,
  Pressable,
  Text,
} from '@onekeyhq/components';
import { IMPL_EVM } from '@onekeyhq/engine/src/constants';
import {
  HomeRoutes,
  HomeRoutesParams,
  ModalRoutes,
  ModalScreenProps,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/types';

import { useActiveWalletAccount } from '../../../../hooks';
import {
  SearchNFTCollectionRoutes,
  SearchNFTCollectionRoutesParams,
} from '../../NFTSearchModal/type';
import { useCollectionDetail } from '../hook';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type ModalNavigationProps = ModalScreenProps<SearchNFTCollectionRoutesParams>;
type NavigationProps = NativeStackNavigationProp<
  HomeRoutesParams,
  HomeRoutes.NFTNPLScreen
>;
const PageHeader = () => {
  const intl = useIntl();
  const modalNavigation = useNavigation<ModalNavigationProps['navigation']>();
  const navigation = useNavigation<NavigationProps>();
  const goToCollectionDetail = useCollectionDetail();

  const searchAction = useCallback(() => {
    modalNavigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.SearchNFT,
      params: {
        screen: SearchNFTCollectionRoutes.SearchModal,
        params: {
          onSelectCollection: ({ networkId, contractAddress, collection }) => {
            goToCollectionDetail({
              networkId,
              contractAddress,
              collection,
            });
          },
        },
      },
    });
  }, [goToCollectionDetail, modalNavigation]);
  const { account, network } = useActiveWalletAccount();

  const nplAction = useCallback(() => {
    navigation.navigate(HomeRoutes.NFTNPLScreen, {
      accountAddress: network?.impl === IMPL_EVM ? account?.address : undefined,
    });
  }, [account?.address, navigation, network?.impl]);

  return (
    <HStack
      height={{ base: '56px', md: '64px' }}
      alignItems="center"
      px={{ base: '16px', md: '32px' }}
    >
      {/* Left */}
      <HStack flex={1} alignItems="center">
        <Text typography={{ sm: 'PageHeading', md: 'Heading' }}>NFT</Text>
        <Hidden from="base" till="md">
          <HStack justifyContent="space-between" flex={1}>
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
                <Icon
                  name="MagnifyingGlassMini"
                  size={20}
                  color="icon-subdued"
                />
                <Text typography="Body2" color="text-subdued" ml={2}>
                  {intl.formatMessage({ id: 'form__nft_search_placeholder' })}
                </Text>
              </Pressable>
            </HStack>
            {/* <Button
              onPress={() => {
                nplAction();
              }}
            >
              PnL
            </Button> */}
          </HStack>
        </Hidden>
      </HStack>
      {/* Right */}
      <Hidden from="md">
        <HStack space="8px">
          <Button
            onPress={() => {
              nplAction();
            }}
            type="basic"
            size="sm"
          >
            PnL
          </Button>
          <IconButton
            type="basic"
            size="sm"
            name="MagnifyingGlassMini"
            circle
            hitSlop={8}
            onPress={() => {
              searchAction();
            }}
          />
        </HStack>
      </Hidden>
    </HStack>
  );
};

export default PageHeader;
