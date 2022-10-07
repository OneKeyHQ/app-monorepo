import { Box, HStack, Typography, VStack } from '@onekeyhq/components/src';

import { FC } from 'react';
import { MarketEXplorer, MarketNews } from '../../../../store/reducers/market';
import { useWebController } from '../../../Discover/Explorer/Controller/useWebController';
import { MarketInfoExplorer } from './MarketInfoExplorer';
import { MarketInfoNewsList } from './MarketInfoNewsList';

type BaseInfoProps = { title?: string; value?: number };
const BaseInfo: FC<BaseInfoProps> = ({ title, value }) => {
  const formatValue = value ? `${value}` : '';
  return (
    <Box my="2" justifyContent="space-between" w="100px" h="52px">
      <Typography.Body2 color="text-subdued">{title}</Typography.Body2>
      <Typography.Heading>{formatValue}</Typography.Heading>
    </Box>
  );
};

type MarkeInfoContentProps = {
  low24h?: number;
  high24h?: number;
  volume24h?: number;
  marketCap?: number;
  expolorers?: MarketEXplorer[];
  news?: MarketNews[];
  about?: Record<string, string>;
};

export const MarkeInfoContent: FC<MarkeInfoContentProps> = ({
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
      <VStack space={4} mt="6">
        <Typography.Heading>Info</Typography.Heading>
        <HStack space={6} flexWrap="wrap">
          <BaseInfo title="24H High" value={high24h} />
          <BaseInfo title="24H Low" value={low24h} />
          <BaseInfo title="24H Volume" value={volume24h} />
          <BaseInfo title="Market Cap" value={marketCap} />
        </HStack>
        <Typography.Heading>Explorers</Typography.Heading>
        <Box flexDirection="row" alignContent="flex-start" flexWrap="wrap">
          {expolorers?.map((e, i) => (
            <MarketInfoExplorer
              index={i}
              name={e.name}
              contractAddress={e.contractAddress}
              onPress={() => {
                gotoSite({ url: e.url });
              }}
            />
          ))}
        </Box>
        <Typography.Heading>About</Typography.Heading>
        <Typography.Body2 noOfLines={5}>
          {about ? about.en : ''}
        </Typography.Body2>
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
