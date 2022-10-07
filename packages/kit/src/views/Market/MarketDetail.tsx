import React, { FC, useCallback, useLayoutEffect, useState } from 'react';

import { useNavigation } from '@react-navigation/core';

import {
  Box,
  useIsVerticalLayout,
  IconButton,
  Icon,
  Typography,
  Image,
  ScrollView,
  Center,
  Spinner,
  useThemeValue,
  useUserDevice,
} from '@onekeyhq/components/src';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';

import { MAX_PAGE_CONTAINER_WIDTH } from '@onekeyhq/kit/src/config';
import { MarkeInfoContent } from './Components/MarketDetail/MarketInfoContent';
import { MarketStatsContent } from './Components/MarketDetail/MarketStatsContent';
import { HomeRoutes, HomeRoutesParams } from '../../routes/types';
import { RouteProp, useRoute } from '@react-navigation/core';
import { useManageTokens } from '../../hooks';
import { useMarketTokenItem } from './hooks/useMarketToken';
import { useMarketDetail } from './hooks/useMarketDetail';
import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import MarketPriceChart from './Components/MarketDetail/MarketPriceChart';
import {
  MarketTokenDetail,
  MarketTokenItem,
} from '../../store/reducers/market';
import { SCREEN_SIZE } from '@onekeyhq/components/src/Provider/device';

type RouteProps = RouteProp<HomeRoutesParams, HomeRoutes.MarketDetail>;

const FavoritButton = ({ tokenItem }: { tokenItem?: MarketTokenItem }) => {
  const isVertical = useIsVerticalLayout();
  return (
    <Box>
      <IconButton
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
            </Box>
          </Box>
          {children}
        </ScrollView>
      </Box>
    </Box>
  );
};

const VERTICAL_HEADER_HEIGHT = 179;
const HORIZONTAL_HEDER_HEIGHT = 87;

type MarketDetailTabsProps = MarketTokenDetail & {
  isFetching?: boolean;
};

const MarketDetailTabs: FC<MarketDetailTabsProps> = ({
  isFetching,
  ...props
}) => {
  const [tabbarBgColor, borderDefault] = useThemeValue([
    'background-default',
    'border-subdued',
  ]);
  const [detailTabName, setdetailTabName] = useState<string | number>(
    () => 'info',
  );
  const { screenWidth } = useUserDevice();
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <Tabs.Container
      initialTabName={detailTabName}
      onTabChange={({ tabName }) => {
        setdetailTabName(tabName);
      }}
      headerContainerStyle={{
        shadowOffset: { width: 0, height: 0 },
        shadowColor: 'transparent',
        elevation: 0,
        borderBottomWidth: 1,
        borderBottomColor: borderDefault,
      }}
      width={isVerticalLayout ? screenWidth : screenWidth - 224}
      pagerProps={{ scrollEnabled: false }}
      containerStyle={{
        maxWidth: MAX_PAGE_CONTAINER_WIDTH,
        width: '100%',
        marginHorizontal: 'auto', // Center align vertically
        backgroundColor: tabbarBgColor,
        alignSelf: 'center',
        flex: 1,
      }}
      headerHeight={
        isVerticalLayout ? VERTICAL_HEADER_HEIGHT : HORIZONTAL_HEDER_HEIGHT
      }
    >
      <Tabs.Tab name="info">
        {isFetching ? (
          <Center flex={1}>
            <Spinner size="lg" />
          </Center>
        ) : (
          <MarkeInfoContent
            low24h={props.stats?.low24h}
            high24h={props.stats?.high24h}
            marketCap={props.stats?.marketCap}
            volume24h={props.stats?.volume24h}
            news={props.news}
            expolorers={props.explorers}
            about={props.about}
          />
        )}
      </Tabs.Tab>
      <Tabs.Tab name="state">
        <MarketStatsContent {...props.stats} />
      </Tabs.Tab>
    </Tabs.Container>
  );
};

const MarketDetail: FC = () => {
  const route = useRoute<RouteProps>();
  const { marketTokenId } = route.params;
  const { tokenDetail } = useMarketDetail({ coingeckoId: marketTokenId });
  return (
    <MarketDetailLayout marketTokenId={marketTokenId}>
      <MarketPriceChart coingeckoId={marketTokenId} />
      <MarketDetailTabs {...tokenDetail} isFetching={Boolean(!tokenDetail)} />
    </MarketDetailLayout>
  );
};
export default MarketDetail;
