import { FC, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  HStack,
  Skeleton,
  Typography,
  VStack,
} from '@onekeyhq/components/src';
import {
  MarketEXplorer,
  MarketNews,
} from '@onekeyhq/kit/src/store/reducers/market';
import { openUrl } from '@onekeyhq/kit/src/utils/openUrl';

import { formatMarketValueForInfo } from '../../utils';

import { MarketInfoExplorer } from './MarketInfoExplorer';
import { MarketInfoNewsList } from './MarketInfoNewsList';

const BaseInfo = ({
  title,
  value,
  isFetching,
}: {
  title: string;
  value: string;
  isFetching: boolean;
}) => {
  const boxH = useMemo(() => (value.length > 9 ? '85px' : '55px'), [value]);
  return isFetching ? (
    <Box my="2" justifyContent="space-between" w="110px" h={boxH}>
      <Skeleton shape="Body2" />
      <Skeleton shape="Heading" />
    </Box>
  ) : (
    <Box my="2" justifyContent="space-between" w="110px" h={boxH}>
      <Typography.Body2 color="text-subdued">{title}</Typography.Body2>
      <Typography.Heading numberOfLines={2}>{value}</Typography.Heading>
    </Box>
  );
};

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
  px?: string;
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
  px,
}) => {
  const intl = useIntl();
  return (
    <Box px={px}>
      <VStack space={6} mt="6">
        <Box>
          <Typography.Heading>
            {intl.formatMessage({ id: 'content__info' })}
          </Typography.Heading>
          <HStack space={0} flexWrap="wrap">
            <BaseInfo
              isFetching={high24h === undefined}
              title={intl.formatMessage({ id: 'form__24h_high' })}
              value={`$${formatMarketValueForInfo(high24h)}`}
            />
            <BaseInfo
              isFetching={low24h === undefined}
              title={intl.formatMessage({ id: 'form__24h_low' })}
              value={`$${formatMarketValueForInfo(low24h)}`}
            />
            <BaseInfo
              isFetching={volume24h === undefined}
              title={intl.formatMessage({ id: 'form__24h_volume' })}
              value={`$${formatMarketValueForInfo(volume24h)}`}
            />
            <BaseInfo
              isFetching={high7d === undefined}
              title={intl.formatMessage({ id: 'form__7d_high' })}
              value={`$${formatMarketValueForInfo(high7d)}`}
            />
            <BaseInfo
              isFetching={low7d === undefined}
              title={intl.formatMessage({ id: 'form__7d_low' })}
              value={`$${formatMarketValueForInfo(low7d)}`}
            />
            <BaseInfo
              isFetching={marketCap === undefined}
              title={intl.formatMessage({ id: 'form__market_cap' })}
              value={`$${formatMarketValueForInfo(marketCap)}`}
            />
          </HStack>
        </Box>
        {expolorers && expolorers.length > 0 ? (
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
                    openUrl(
                      e.url ?? '',
                      intl.formatMessage({ id: 'form__explorers' }),
                      { modalMode: true },
                    );
                  }}
                />
              ))}
            </Box>
          </Box>
        ) : null}
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
