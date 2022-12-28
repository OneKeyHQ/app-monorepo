import type { FC } from 'react';
import { memo, useCallback, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  useIsVerticalLayout,
  useThemeValue,
  useUserDevice,
} from '@onekeyhq/components';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { MarketTokenDetail } from '@onekeyhq/kit/src/store/reducers/market';
import { SWAP_TAB_NAME } from '@onekeyhq/kit/src/store/reducers/market';
import { MAX_PAGE_CONTAINER_WIDTH } from '@onekeyhq/shared/src/config/appConfig';

import { useMarketTokenItem } from '../../hooks/useMarketToken';

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
        name="DotsHorizontalMini"
        onPress={() => {
          if (marketTokenItem) {
            showMarketDetailActionMoreMenu(marketTokenItem, {
              header: intl.formatMessage({ id: 'action__more' }),
            });
          }
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
  const contentPendding = isVerticalLayout ? '16px' : '0px';
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
      renderHeader={() => (
        <Box
          w="100%"
          p={contentPendding}
          flexDirection="column"
          bgColor={tabbarBgColor}
          h={MARKET_DETAIL_TAB_HEADER_H_VERTICAL}
        >
          {isVerticalLayout ? (
            <>
              <MarketPriceChart coingeckoId={marketTokenId} />
              <MarketDetailActionButton marketTokenId={marketTokenId} />
            </>
          ) : (
            <MarketPriceChart coingeckoId={marketTokenId} />
          )}
        </Box>
      )}
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
        <Tabs.FlatList
          data={null}
          showsVerticalScrollIndicator={false}
          renderItem={() => <Box />}
          ListEmptyComponent={() => (
            <MarketInfoContent
              low24h={tokenDetail?.stats?.low24h}
              high24h={tokenDetail?.stats?.high24h}
              marketCapDominance={tokenDetail?.stats?.marketCapDominance}
              marketCapRank={tokenDetail?.stats?.marketCapRank}
              marketCap={tokenDetail?.stats?.marketCap}
              volume24h={tokenDetail?.stats?.volume24h}
              news={tokenDetail?.news}
              expolorers={tokenDetail?.explorers}
              about={tokenDetail?.about}
              links={tokenDetail?.links}
              px={contentPendding}
            />
          )}
        />
      </Tabs.Tab>
      <Tabs.Tab
        name={MarketDetailTabName.Stats}
        label={intl.formatMessage({ id: 'title__stats' })}
      >
        <Tabs.FlatList
          data={null}
          showsVerticalScrollIndicator={false}
          renderItem={() => <Box />}
          ListEmptyComponent={() => (
            <MarketStatsContent px={contentPendding} {...tokenDetail?.stats} />
          )}
        />
      </Tabs.Tab>
    </Tabs.Container>
  );
};

export default memo(MarketDetailTabs);
