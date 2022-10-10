import React, { FC, useState, useEffect, useCallback } from 'react';

import { useNavigation } from '@react-navigation/core';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import {
  MarketTokenDetail,
  SWAP_TAB_NAME,
} from '@onekeyhq/kit/src/store/reducers/market';

import {
  useThemeValue,
  Center,
  Spinner,
  IconButton,
  Button,
  Box,
  useUserDevice,
  useIsVerticalLayout,
} from '@onekeyhq/components/src';
import { MAX_PAGE_CONTAINER_WIDTH } from '@onekeyhq/kit/src/config';

import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';
import { MarketInfoContent } from './MarketInfoContent';
import { MarketStatsContent } from './MarketStatsContent';

import { useMarketTokenItem } from '../../hooks/useMarketToken';

import { showMarketDetailActionMoreMenu } from './MarketDetailActionMore';

const MarketDetailActionButton = ({
  marketTokenId,
}: {
  marketTokenId: string;
}) => {
  const marketTokenItem = useMarketTokenItem({ coingeckoId: marketTokenId });
  const navigation = useNavigation();
  const onBack = useCallback(() => {
    backgroundApiProxy.serviceMarket.switchMarketTopTab(SWAP_TAB_NAME);
    if (navigation?.canGoBack?.()) {
      navigation?.goBack();
    }
  }, [navigation]);
  useEffect(() => {
    if (!marketTokenItem.tokens) {
      backgroundApiProxy.serviceMarket.fetchMarketTokenAllNetWorkTokens(
        marketTokenId,
      );
    }
  }, [marketTokenId, marketTokenItem.tokens]);
  return (
    <Box flex={1} flexDirection="row" alignItems="center" pb={12}>
      <Button
        flex={1}
        type="basic"
        size="lg"
        onPress={() => {
          if (marketTokenItem.tokens && marketTokenItem.tokens.length > 0) {
            backgroundApiProxy.serviceSwap.setOutputToken(
              marketTokenItem.tokens[0],
            );
            onBack();
          }
        }}
        isDisabled={!marketTokenItem.tokens}
      >
        Buy
      </Button>
      <Button
        flex={1}
        ml={2}
        type="basic"
        size="lg"
        onPress={() => {
          if (marketTokenItem.tokens && marketTokenItem.tokens.length > 0) {
            backgroundApiProxy.serviceSwap.setInputToken(
              marketTokenItem.tokens[0],
            );
            onBack();
          }
        }}
        isDisabled={!marketTokenItem.tokens}
      >
        Sell
      </Button>
      <IconButton
        ml={2}
        name="DotsHorizontalSolid"
        onPress={() => {
          showMarketDetailActionMoreMenu(marketTokenItem, { header: 'More' });
        }}
        isDisabled={!marketTokenItem}
      />
    </Box>
  );
};

type MarketDetailTabsProps = {
  marketTokenId: string;
  tokenDetail?: MarketTokenDetail;
};

const MarketDetailTabs: FC<MarketDetailTabsProps> = ({
  marketTokenId,
  tokenDetail,
}) => {
  const [tabbarBgColor, borderDefault] = useThemeValue([
    'background-default',
    'border-subdued',
  ]);
  const [detailTabName, setDetailTabName] = useState<string | number>(
    () => 'info',
  );
  const { screenWidth } = useUserDevice();
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <Tabs.Container
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
          <MarketDetailActionButton marketTokenId={marketTokenId} />
        ) : null
      }
      headerHeight={isVerticalLayout ? 90 : 1}
    >
      <Tabs.Tab name="info">
        {!tokenDetail ? (
          <Center w="full" h={200}>
            <Spinner size="lg" />
          </Center>
        ) : (
          <MarketInfoContent
            low24h={tokenDetail.stats?.low24h}
            high24h={tokenDetail.stats?.high24h}
            marketCap={tokenDetail.stats?.marketCap}
            volume24h={tokenDetail.stats?.volume24h}
            news={tokenDetail.news}
            expolorers={tokenDetail.explorers}
            about={tokenDetail.about}
          />
        )}
      </Tabs.Tab>
      <Tabs.Tab name="state">
        {!tokenDetail ? (
          <Center w="full" h={200}>
            <Spinner size="lg" />
          </Center>
        ) : (
          <MarketStatsContent {...tokenDetail.stats} />
        )}
      </Tabs.Tab>
    </Tabs.Container>
  );
};

export default React.memo(MarketDetailTabs);
