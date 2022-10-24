import React, { FC, useCallback, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  IconButton,
  ScrollView,
  useIsVerticalLayout,
  useThemeValue,
  useUserDevice,
} from '@onekeyhq/components/src';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { MAX_PAGE_CONTAINER_WIDTH } from '@onekeyhq/kit/src/config';
import {
  MarketTokenDetail,
  SWAP_TAB_NAME,
} from '@onekeyhq/kit/src/store/reducers/market';

import { useMarketTokenItem } from '../../hooks/useMarketToken';

import { showMarketDetailActionMoreMenu } from './MarketDetailActionMore';
import { MarketInfoContent } from './MarketInfoContent';
import MarketPriceChart from './MarketPriceChart';
import { MarketStatsContent } from './MarketStatsContent';

const MarketDetailActionButton = ({
  marketTokenId,
}: {
  marketTokenId: string;
}) => {
  const intl = useIntl();
  const marketTokenItem = useMarketTokenItem({ coingeckoId: marketTokenId });
  const navigation = useNavigation();
  const onBack = useCallback(() => {
    backgroundApiProxy.serviceMarket.switchMarketTopTab(SWAP_TAB_NAME);
    if (navigation?.canGoBack?.()) {
      navigation?.goBack();
    }
  }, [navigation]);
  const isDisabledSwap = useMemo(
    () => !marketTokenItem?.tokens?.length,
    [marketTokenItem],
  );
  return (
    <Box flexDirection="row" alignItems="center" py="24px">
      <Button
        flex={1}
        type="basic"
        size="lg"
        onPress={() => {
          if (marketTokenItem?.tokens?.length) {
            backgroundApiProxy.serviceSwap.setOutputToken(
              marketTokenItem.tokens[0],
            );
            onBack();
          }
        }}
        isDisabled={isDisabledSwap}
      >
        {intl.formatMessage({ id: 'action__buy' })}
      </Button>
      <Button
        flex={1}
        ml={2}
        type="basic"
        size="lg"
        onPress={() => {
          if (marketTokenItem?.tokens?.length) {
            backgroundApiProxy.serviceSwap.setInputToken(
              marketTokenItem.tokens[0],
            );
            onBack();
          }
        }}
        isDisabled={isDisabledSwap}
      >
        {intl.formatMessage({ id: 'action__sell' })}
      </Button>
      {/* <IconButton
        ml={2}
        name="DotsHorizontalSolid"
        onPress={() => {
          showMarketDetailActionMoreMenu(marketTokenItem, {
            header: intl.formatMessage({ id: 'action__more' }),
          });
        }}
        isDisabled={!marketTokenItem}
      /> */}
    </Box>
  );
};

type MarketDetailTabsProps = {
  marketTokenId: string;
  tokenDetail?: MarketTokenDetail;
};

enum MarketDetailTabName {
  Info = 'info',
  Stats = 'stats',
}

const MARKET_DETAIL_TAB_HEADER_H_VERTICAL = 440;
const MARKET_DETAIL_TAB_HEADER_H = 392;

const MarketDetailTabs: FC<MarketDetailTabsProps> = ({
  marketTokenId,
  tokenDetail,
}) => {
  const [tabbarBgColor, borderDefault] = useThemeValue([
    'background-default',
    'border-subdued',
  ]);
  const [detailTabName, setDetailTabName] = useState<string | number>(
    () => MarketDetailTabName.Info,
  );
  const intl = useIntl();
  const { screenWidth } = useUserDevice();
  const isVerticalLayout = useIsVerticalLayout();
  const [refreshing, setRefreshing] = useState(false);
  return (
    <Tabs.Container
      // @ts-ignore fix type when remove react-native-collapsible-tab-view
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await backgroundApiProxy.serviceMarket.fetchMarketDetail(marketTokenId);
        setRefreshing(false);
      }}
      initialTabName={detailTabName}
      onTabChange={({ tabName }) => {
        setDetailTabName(tabName);
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
      headerContainerStyle={{
        shadowOffset: { width: 0, height: 0 },
        shadowColor: 'transparent',
        elevation: 0,
        borderBottomWidth: 1,
        borderBottomColor: borderDefault,
      }}
      renderHeader={() =>
        isVerticalLayout ? (
          <Box h={MARKET_DETAIL_TAB_HEADER_H_VERTICAL} p="4">
            <MarketPriceChart coingeckoId={marketTokenId} />
            <MarketDetailActionButton marketTokenId={marketTokenId} />
          </Box>
        ) : (
          <Box h={MARKET_DETAIL_TAB_HEADER_H} p="4">
            <MarketPriceChart coingeckoId={marketTokenId} />
          </Box>
        )
      }
      headerHeight={
        isVerticalLayout
          ? MARKET_DETAIL_TAB_HEADER_H_VERTICAL
          : MARKET_DETAIL_TAB_HEADER_H
      }
    >
      <Tabs.Tab
        name={MarketDetailTabName.Info}
        label={intl.formatMessage({ id: 'content__info' })}
      >
        <ScrollView
          px="4"
          contentContainerStyle={{
            paddingBottom: 24,
          }}
        >
          <MarketInfoContent
            low24h={tokenDetail?.stats?.low24h}
            high24h={tokenDetail?.stats?.high24h}
            low7d={tokenDetail?.stats?.low7d}
            high7d={tokenDetail?.stats?.high7d}
            marketCap={tokenDetail?.stats?.marketCap}
            volume24h={tokenDetail?.stats?.volume24h}
            news={tokenDetail?.news}
            expolorers={tokenDetail?.explorers}
            about={tokenDetail?.about}
          />
        </ScrollView>
        {/* )} */}
      </Tabs.Tab>
      <Tabs.Tab
        name={MarketDetailTabName.Stats}
        label={intl.formatMessage({ id: 'title__stats' })}
      >
        {/* {!tokenDetail ? (
          <Center w="full" h="200px">
            <Spinner size="lg" />
          </Center>
        ) : ( */}
        <ScrollView
          px="4"
          contentContainerStyle={{
            paddingBottom: 24,
          }}
        >
          <MarketStatsContent {...tokenDetail?.stats} />
        </ScrollView>
        {/* )} */}
      </Tabs.Tab>
    </Tabs.Container>
  );
};

export default React.memo(MarketDetailTabs);
