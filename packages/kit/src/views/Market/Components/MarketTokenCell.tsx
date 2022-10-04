import { FC, useEffect, useMemo, useState } from 'react';

import { Image } from 'native-base';

import {
  Box,
  Button,
  Divider,
  Icon,
  IconButton,
  Pressable,
  Token,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components/src';

import { MarketTokenItem } from '../../../store/reducers/market';
import SparklineChart from './SparklineChart';
import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../../hooks';

interface MarketTokenCellProps {
  onPress?: () => void;
  marketItem: MarketTokenItem;
}

const MarketTokenCell: FC<MarketTokenCellProps> = ({ onPress, marketItem }) => {
  const isVerticalLayout = useIsVerticalLayout();
  // 异步获取 favorite状态 和 swap 网络支持
  const [swapImpl, setSwapImpl] = useState(() => []);
  // const [favorited, setFavorited] = useState(() => false);
  const categorys = useAppSelector((s) => s.market.categorys);
  const favorites = categorys.find((c) => c.categoryId === 'favorites');
  console.log('MarketTokenCell', marketItem.coingeckoId);
  const favorited = favorites?.coingeckoIds?.includes(marketItem.coingeckoId);
  //   useEffect(() => {
  //     (async () => {
  //       const impls = await backgroundApiProxy.serviceMarket.getTokenSupportImpl(
  //         marketItem.coingeckoId,
  //       );
  //       if (impls && impls.length > 0) {
  //         setSwapImpl(impls);
  //       }
  //     })();
  //   }, [marketItem]);
  return (
    <Pressable.Item onPress={onPress}>
      <Box height="64px" width="100%" bgColor="surface-default">
        <Box flex={1} flexDirection="row" alignItems="center">
          <Box
            flexDirection="row"
            alignItems="center"
            justifyContent="flex-end"
            width="52px"
          >
            <IconButton
              size="base"
              name="StarSolid"
              iconColor={favorited ? 'icon-warning' : 'icon-default'}
              iconSize={20}
              onPress={() => {
                if (favorited) {
                  backgroundApiProxy.serviceMarket.cancelMarketFavoriteCoin(
                    marketItem.coingeckoId,
                  );
                } else {
                  backgroundApiProxy.serviceMarket.saveMarketFavoriteCoin(
                    marketItem.coingeckoId,
                  );
                }
              }}
            />
            {/* <Typography.Body2Strong>2</Typography.Body2Strong> */}
          </Box>
          <Box
            ml="6"
            flexDirection="row"
            alignItems="center"
            width="100px"
            height="full"
          >
            <Token size={8} src={marketItem.image} />
            <Box flexDirection="column" ml="2">
              <Typography.Body2Strong>
                {marketItem.symbol}
              </Typography.Body2Strong>
              <Typography.Body2Strong color="text-subdued">
                {marketItem.name}
              </Typography.Body2Strong>
            </Box>
          </Box>
          <Box
            flexDirection="row"
            justifyContent="flex-end"
            ml="6"
            width="100px"
          >
            <Typography.Body2Strong textAlign="right" numberOfLines={1}>
              {`$${marketItem.price ? marketItem.price : 0}`}
            </Typography.Body2Strong>
          </Box>
          <Box
            flexDirection="row"
            justifyContent="flex-end"
            ml="6"
            width="100px"
          >
            <Typography.Body2Strong>
              {marketItem.priceChangePercentage24H}
            </Typography.Body2Strong>
          </Box>
          <Box
            flexDirection="row"
            justifyContent="flex-end"
            ml="6"
            width="120px"
          >
            <Typography.Body2Strong numberOfLines={1}>
              {marketItem.totalVolume}
            </Typography.Body2Strong>
          </Box>
          <Box
            flexDirection="row"
            justifyContent="flex-end"
            ml="6"
            width="128px"
          >
            <Typography.Body2Strong numberOfLines={1}>
              {marketItem.marketCap}
            </Typography.Body2Strong>
          </Box>
          <Box flexDirection="row" justifyContent="flex-end" width="100px">
            <SparklineChart
              data={marketItem.sparkline}
              width={50}
              height={40}
            />
          </Box>
          <Box flexDirection="row" ml="6">
            {swapImpl.length > 0 ? (
              <Button type="basic" size="xs">
                Swap
              </Button>
            ) : null}
            <IconButton ml="1" name="DotsVerticalSolid" iconSize={20} />
          </Box>
        </Box>
      </Box>
      <Divider />
    </Pressable.Item>
  );
};

export default MarketTokenCell;
