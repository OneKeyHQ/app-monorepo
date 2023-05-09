import type { FC } from 'react';
import { memo, useCallback, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { RefreshControl } from 'react-native';

import {
  Box,
  Button,
  ScrollView,
  useIsVerticalLayout,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { MarketTokenDetail } from '@onekeyhq/kit/src/store/reducers/market';

import { useAppSelector } from '../../../../hooks';
import { TabRoutes } from '../../../../routes/routesEnum';
import { getDefaultLocale } from '../../../../utils/locale';
import { useMarketTokenItem } from '../../hooks/useMarketToken';

import { MarketDetailComponent } from './MarketDetailComponent';
import MarketPriceChart from './MarketPriceChart';

import type { TabRoutesParams } from '../../../../routes/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  TabRoutesParams,
  TabRoutes.Home
>;

const MarketDetailActionButton = ({
  marketTokenId,
}: {
  marketTokenId: string;
}) => {
  const intl = useIntl();
  const marketTokenItem = useMarketTokenItem({ coingeckoId: marketTokenId });
  const navigation = useNavigation<NavigationProps>();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const onBack = useCallback(() => {
    if (navigation?.canGoBack?.()) {
      navigation?.goBack();
    }
  }, [navigation]);
  const isDisabledSwap = useMemo(
    () => !marketTokenItem?.tokens?.length,
    [marketTokenItem],
  );
  return (
    <Box
      testID="MarketDetailActionButton"
      flexDirection="row"
      alignItems="center"
      pt="24px"
    >
      <Button
        flex={1}
        type="basic"
        size="lg"
        onPress={() => {
          if (marketTokenItem?.tokens?.length) {
            backgroundApiProxy.serviceSwap.buyToken(marketTokenItem.tokens[0]);
            navigation.pop();
            navigation.navigate(TabRoutes.Swap);
          }
        }}
        isDisabled={isDisabledSwap}
      >
        {intl.formatMessage({ id: 'Market__buy' })}
      </Button>
      <Button
        flex={1}
        ml={2}
        type="basic"
        size="lg"
        onPress={() => {
          if (marketTokenItem?.tokens?.length) {
            backgroundApiProxy.serviceSwap.sellToken(marketTokenItem.tokens[0]);
            navigation.pop();
            navigation.navigate(TabRoutes.Swap);
          }
        }}
        isDisabled={isDisabledSwap}
      >
        {intl.formatMessage({ id: 'Market__sell' })}
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

const MarketDetailContent: FC<MarketDetailTabsProps> = ({
  marketTokenId,
  tokenDetail,
}) => {
  const { bottom } = useSafeAreaInsets();
  const isVerticalLayout = useIsVerticalLayout();
  const [refreshing, setRefreshing] = useState(false);
  const contentPadding = isVerticalLayout ? '16px' : '0px';
  const locale = useAppSelector((s) => s.settings.locale);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await backgroundApiProxy.serviceMarket.fetchMarketDetail({
      coingeckoId: marketTokenId,
      locale: locale === 'system' ? getDefaultLocale() : locale,
    });
    setRefreshing(false);
  }, [locale, marketTokenId]);

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: bottom }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Box
        w="100%"
        p={contentPadding}
        flexDirection="column"
        bg="background-default"
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
      <MarketDetailComponent
        low24h={tokenDetail?.stats?.low24h}
        high24h={tokenDetail?.stats?.high24h}
        marketCapRank={tokenDetail?.stats?.marketCapRank}
        marketCap={tokenDetail?.stats?.marketCap}
        volume24h={tokenDetail?.stats?.volume24h}
        expolorers={tokenDetail?.explorers}
        about={tokenDetail?.about}
        links={tokenDetail?.links}
        atl={tokenDetail?.stats?.atl}
        ath={tokenDetail?.stats?.ath}
        px={contentPadding}
      />
    </ScrollView>
  );
};

export default memo(MarketDetailContent);
