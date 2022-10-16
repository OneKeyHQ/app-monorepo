import { Box, HStack, Typography, VStack } from '@onekeyhq/components/src';

import { FC } from 'react';
import { useIntl } from 'react-intl';
import { MarketEXplorer, MarketNews } from '../../../../store/reducers/market';
import { useWebController } from '../../../Discover/Explorer/Controller/useWebController';
import { formatMarketValueForInfo } from '../../utils';
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
  low7d?: string;
  high7d?: string;
  volume24h?: number;
  marketCap?: number;
  expolorers?: MarketEXplorer[];
  news?: MarketNews[];
  about?: string;
};

export const MarketInfoContent: FC<MarketInfoContentProps> = ({
  low24h,
  high24h,
  low7d,
  high7d,
  volume24h,
  marketCap,
  expolorers,
  news,
  about,
}) => {
  const { gotoSite } = useWebController();
  const intl = useIntl();
  return (
    <Box flex={1}>
      <VStack space={6} mt="6">
        <Box>
          <Typography.Heading>Info</Typography.Heading>
          <HStack space={6} flexWrap="wrap">
            <BaseInfo
              title={intl.formatMessage({ id: 'form__24h_high' })}
              value={`$${formatMarketValueForInfo(high24h)}`}
            />
            <BaseInfo
              title={intl.formatMessage({ id: 'form__24h_low' })}
              value={`$${formatMarketValueForInfo(low24h)}`}
            />
            <BaseInfo
              title={intl.formatMessage({ id: 'form__24h_volume' })}
              value={`$${formatMarketValueForInfo(volume24h)}`}
            />
            <BaseInfo
              title={intl.formatMessage({ id: 'form__7d_high' })}
              value={`$${formatMarketValueForInfo(high7d)}`}
            />
            <BaseInfo
              title={intl.formatMessage({ id: 'form__7d_low' })}
              value={`$${formatMarketValueForInfo(low7d)}`}
            />
            <BaseInfo
              title={intl.formatMessage({ id: 'form__market_cap' })}
              value={`$${formatMarketValueForInfo(marketCap)}`}
            />
          </HStack>
        </Box>
        <Box>
          <Typography.Heading>
            {intl.formatMessage({ id: 'form__explorers' })}
          </Typography.Heading>
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
        {about && about.length > 0 ? (
          <Box>
            <Typography.Heading mb="3">
              {intl.formatMessage({ id: 'title__about' })}
            </Typography.Heading>
            <Typography.Body2 noOfLines={5}>{about}</Typography.Body2>
          </Box>
        ) : null}
        {news && news.length > 0 ? (
          <Box>
            <Typography.Heading>
              {intl.formatMessage({ id: 'title__news' })}
            </Typography.Heading>
            <MarketInfoNewsList news={news} />
          </Box>
        ) : null}
      </VStack>
    </Box>
  );
};
