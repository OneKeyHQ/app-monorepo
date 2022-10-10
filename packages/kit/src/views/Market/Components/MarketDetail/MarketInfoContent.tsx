import { Box, HStack, Typography, VStack } from '@onekeyhq/components/src';

import { FC } from 'react';
import { MarketEXplorer, MarketNews } from '../../../../store/reducers/market';
import { useWebController } from '../../../Discover/Explorer/Controller/useWebController';
import {
  formatMarketValueForComma,
  formatMarketValueForFiexd,
  formatMarketValueForMillionAndBillion,
} from '../../utils';
import { MarketInfoExplorer } from './MarketInfoExplorer';
import { MarketInfoNewsList } from './MarketInfoNewsList';

const BaseInfo = ({ title, value }: { title: string; value: string }) => (
  <Box my="2" justifyContent="space-between" w="115px" h="52px">
    <Typography.Body2 color="text-subdued">{title}</Typography.Body2>
    <Typography.Heading>{value}</Typography.Heading>
  </Box>
);

type MarketInfoContentProps = {
  low24h?: number;
  high24h?: number;
  volume24h?: number;
  marketCap?: number;
  expolorers?: MarketEXplorer[];
  news?: MarketNews[];
  about?: string;
};

export const MarketInfoContent: FC<MarketInfoContentProps> = ({
  low24h,
  high24h,
  volume24h,
  marketCap,
  expolorers,
  news,
  about,
}) => {
  const { gotoSite } = useWebController();
  return (
    <Box flex={1}>
      <VStack space={6} mt="6">
        <Box>
          <Typography.Heading>Info</Typography.Heading>
          <HStack space={6} flexWrap="wrap">
            <BaseInfo
              title="24H High"
              value={`$${formatMarketValueForComma(high24h)}`}
            />
            <BaseInfo
              title="24H Low"
              value={`$${formatMarketValueForComma(low24h)}`}
            />
            <BaseInfo
              title="24H Volume"
              value={`$${formatMarketValueForMillionAndBillion(volume24h)}`}
            />
            <BaseInfo
              title="Market Cap"
              value={`$${formatMarketValueForMillionAndBillion(marketCap)}`}
            />
          </HStack>
        </Box>
        <Box>
          <Typography.Heading>Explorers</Typography.Heading>
          <Box flexDirection="row" alignContent="flex-start" flexWrap="wrap">
            {expolorers?.map((e, i) => (
              <MarketInfoExplorer
                key={i}
                index={i}
                name={e.name}
                contractAddress={e.contractAddress}
                onPress={() => {
                  gotoSite({ url: e.url });
                }}
              />
            ))}
          </Box>
        </Box>
        <Box>
          <Typography.Heading mb="3">About</Typography.Heading>
          <Typography.Body2 noOfLines={5}>{about}</Typography.Body2>
        </Box>
        {news && news.length > 0 ? (
          <Box>
            <Typography.Heading>News</Typography.Heading>
            <MarketInfoNewsList news={news} />
          </Box>
        ) : null}
      </VStack>
    </Box>
  );
};
