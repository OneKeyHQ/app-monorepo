import { useCallback } from 'react';

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
import {
  HomeRoutes,
  ModalRoutes,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/routesEnum';
import type {
  HomeRoutesParams,
  ModalScreenProps,
} from '@onekeyhq/kit/src/routes/types';

import { NFTMarketRoutes } from '../../Modals/type';
import { useCollectionDetail } from '../hook';

import type { NFTMarketRoutesParams } from '../../Modals/type';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type ModalNavigationProps = ModalScreenProps<NFTMarketRoutesParams>;
type NavigationProps = NativeStackNavigationProp<
  HomeRoutesParams,
  HomeRoutes.NFTPNLScreen
>;
const PageHeader = () => {
  const intl = useIntl();
  const modalNavigation = useNavigation<ModalNavigationProps['navigation']>();
  const navigation = useNavigation<NavigationProps>();
  const goToCollectionDetail = useCollectionDetail();

  const searchAction = useCallback(() => {
    modalNavigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.NFTMarket,
      params: {
        screen: NFTMarketRoutes.SearchModal,
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

  const nplAction = useCallback(() => {
    navigation.navigate(HomeRoutes.NFTPNLScreen);
  }, [navigation]);

  return (
    <HStack
      height={{ base: '56px', md: '64px' }}
      alignItems="center"
      pl={{ base: '16px', md: '32px' }}
      pr={{ base: '10px', md: '32px' }}
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
            <Button
              onPress={() => {
                nplAction();
              }}
              type="plain"
              leftIconName="DocumentChartBarMini"
              rightIcon={
                <Icon name="ChevronRightMini" color="icon-subdued" size={20} />
              }
              mx={-4}
            >
              {intl.formatMessage({ id: 'action__profit_and_loss' })}
            </Button>
          </HStack>
        </Hidden>
      </HStack>
      {/* Right */}
      <Hidden from="md">
        <HStack space="8px" alignItems="center">
          <Button
            leftIconName="DocumentChartBarMini"
            size="sm"
            onPress={() => {
              nplAction();
            }}
          >
            PnL
          </Button>
          <IconButton
            name="MagnifyingGlassOutline"
            type="plain"
            size="lg"
            circle
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
