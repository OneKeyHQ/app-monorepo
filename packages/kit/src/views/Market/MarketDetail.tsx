import React, { FC, useCallback, useLayoutEffect } from 'react';

import { useNavigation } from '@react-navigation/core';

import {
  Box,
  Icon,
  IconButton,
  Image,
  ScrollView,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components/src';
import MarketPriceChart from './Components/MarketDetail/MarketPriceChart';

import { HomeRoutes, HomeRoutesParams } from '../../routes/types';
import { RouteProp, useRoute } from '@react-navigation/core';

import { useMarketDetail } from './hooks/useMarketDetail';
import { useMarketTokenItem } from './hooks/useMarketToken';
import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { MarketTokenItem } from '../../store/reducers/market';
import { SCREEN_SIZE } from '@onekeyhq/components/src/Provider/device';
import MarketDetailTab from './Components/MarketDetail/MarketDetailTab';

type RouteProps = RouteProp<HomeRoutesParams, HomeRoutes.MarketDetail>;

const FavoritButton = ({ tokenItem }: { tokenItem?: MarketTokenItem }) => {
  const isVertical = useIsVerticalLayout();
  return (
    <Box>
      <IconButton
        ml={4}
        type={isVertical ? 'plain' : 'basic'}
        name={isVertical ? 'StarOutline' : 'StarSolid'}
        size={isVertical ? 'xl' : 'base'}
        circle={!isVertical}
        iconColor={tokenItem?.favorited ? 'icon-warning' : 'icon-default'}
        onPress={() => {
          if (tokenItem) {
            if (tokenItem.favorited) {
              backgroundApiProxy.serviceMarket.cancelMarketFavoriteToken(
                tokenItem.coingeckoId,
              );
            } else {
              backgroundApiProxy.serviceMarket.saveMarketFavoriteTokens([
                tokenItem.coingeckoId,
              ]);
            }
          }
        }}
      />
    </Box>
  );
};

const BellButton = ({ tokenItem }: { tokenItem?: MarketTokenItem }) => {
  console.log('BellButton');
  return (
    <Box>
      <IconButton
        ml={4}
        type="basic"
        name="BellOffSolid"
        size="base"
        circle
        iconColor="icon-default" // get subscribe status
        onPress={() => {
          // TODO subscribe
        }}
      />
    </Box>
  );
};

const HeaderTitle = ({ tokenItem }: { tokenItem?: MarketTokenItem }) => {
  const isVertical = useIsVerticalLayout();
  return (
    <Box flexDirection="row" alignItems="center">
      <Image
        borderRadius={isVertical ? 12 : 16}
        src={tokenItem?.image}
        alt={tokenItem?.image}
        key={tokenItem?.image}
        size={isVertical ? 6 : 8}
        fallbackElement={
          <Icon name="QuestionMarkOutline" size={isVertical ? 24 : 32} />
        }
      />
      <Typography.Heading ml="2">{tokenItem?.symbol}</Typography.Heading>
    </Box>
  );
};

type MarketDetailLayoutProps = {
  marketTokenId: string;
};
const MarketDetailLayout: FC<MarketDetailLayoutProps> = ({
  marketTokenId,
  children,
}) => {
  const navigation = useNavigation();
  const isVertical = useIsVerticalLayout();
  const marketTokenItem = useMarketTokenItem({ coingeckoId: marketTokenId });
  const onBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);
  useLayoutEffect(() => {
    if (!isVertical) {
      navigation.setOptions({ headerShown: false });
    } else {
      navigation.setOptions({
        headerRight: () => <FavoritButton tokenItem={marketTokenItem} />,
        headerTitle: () => <HeaderTitle tokenItem={marketTokenItem} />,
      });
    }
  });
  if (isVertical) {
    return (
      <Box
        bg="background-default"
        w="full"
        h="full"
        style={{ maxWidth: 768, marginHorizontal: 'auto' }}
      >
        <ScrollView flex={1} px="4">
          {children}
        </ScrollView>
      </Box>
    );
  }
  return (
    <Box bg="background-default" w="full" h="full" px="8">
      <Box w="full" flexDirection="row" alignItems="center" py="5">
        <IconButton onPress={onBack} type="plain" name="ArrowLeftOutline" />
      </Box>
      <Box flex={1} flexDirection="row" justifyContent="center">
        <ScrollView flex={1} maxW={SCREEN_SIZE.LARGE}>
          <Box
            display="flex"
            justifyContent="space-between"
            flexDirection="row"
            mb="8"
          >
            <HeaderTitle tokenItem={marketTokenItem} />
            <Box
              flexDirection="row"
              alignItems="center"
              justifyContent="space-around"
            >
              <FavoritButton tokenItem={marketTokenItem} />
              <BellButton tokenItem={marketTokenItem} />
            </Box>
          </Box>
          {children}
        </ScrollView>
      </Box>
    </Box>
  );
};

const MarketDetail: FC = () => {
  const route = useRoute<RouteProps>();
  const { marketTokenId } = route.params;
  const { tokenDetail } = useMarketDetail({ coingeckoId: marketTokenId });
  return (
    <MarketDetailLayout marketTokenId={marketTokenId}>
      <MarketPriceChart coingeckoId={marketTokenId} />
      <MarketDetailTab
        tokenDetail={tokenDetail}
        marketTokenId={marketTokenId}
      />
    </MarketDetailLayout>
  );
};
export default MarketDetail;
