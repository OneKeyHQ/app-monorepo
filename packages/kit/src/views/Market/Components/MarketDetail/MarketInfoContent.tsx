import type { FC } from 'react';
import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  HStack,
  Skeleton,
  Typography,
  VStack,
} from '@onekeyhq/components';
import { useSettings } from '@onekeyhq/kit/src/hooks';
import type {
  MarketEXplorer,
  MarketLinks,
  MarketNews,
} from '@onekeyhq/kit/src/store/reducers/market';
import { openUrl } from '@onekeyhq/kit/src/utils/openUrl';

import { formatMarketValueForInfo, getFiatCodeUnit } from '../../utils';

import { MarketInfoExplorer } from './MarketInfoExplorer';
import { MarketInfoLinks } from './MarketInfoLinks';
import { MarketInfoNewsList } from './MarketInfoNewsList';

const WRAP_STRING_LENGTH = 9;
const WRAP_TITLE_STRING_LENGTH = 10;

const BaseInfo = ({
  title,
  value,
  isFetching,
}: {
  title: string;
  value: string;
  isFetching: boolean;
}) => {
  const boxH = useMemo(() => {
    if (
      value.length > WRAP_STRING_LENGTH &&
      title.length > WRAP_TITLE_STRING_LENGTH
    ) {
      return '125px';
    }
    return value.length > WRAP_STRING_LENGTH ||
      title.length > WRAP_TITLE_STRING_LENGTH
      ? '85px'
      : '55px';
  }, [value, title]);
  return (
    <Box mr="1" my="2" justifyContent="space-between" w="108px" h={boxH}>
      {isFetching ? (
        <>
          <Skeleton shape="Body2" />
          <Skeleton shape="Heading" />
        </>
      ) : (
        <>
          <Typography.Body2 numberOfLines={2} color="text-subdued">
            {title}
          </Typography.Body2>
          <Typography.Heading numberOfLines={2}>{value}</Typography.Heading>
        </>
      )}
    </Box>
  );
};

type MarketInfoContentProps = {
  low24h?: number;
  high24h?: number;
  marketCapDominance?: string;
  marketCapRank?: number;
  volume24h?: number;
  marketCap?: number;
  expolorers?: MarketEXplorer[];
  news?: MarketNews[];
  about?: string;
  links?: MarketLinks;
  px?: string;
};

export const MarketInfoContent: FC<MarketInfoContentProps> = ({
  low24h,
  high24h,
  volume24h,
  marketCapDominance,
  marketCapRank,
  marketCap,
  expolorers,
  news,
  about,
  links,
  px,
}) => {
  const intl = useIntl();
  const { selectedFiatMoneySymbol } = useSettings();
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
              value={`${getFiatCodeUnit(
                selectedFiatMoneySymbol,
              )}${formatMarketValueForInfo(high24h)}`}
            />
            <BaseInfo
              isFetching={low24h === undefined}
              title={intl.formatMessage({ id: 'form__24h_low' })}
              value={`${getFiatCodeUnit(
                selectedFiatMoneySymbol,
              )}${formatMarketValueForInfo(low24h)}`}
            />
            <BaseInfo
              isFetching={volume24h === undefined}
              title={intl.formatMessage({ id: 'form__24h_volume' })}
              value={`${getFiatCodeUnit(
                selectedFiatMoneySymbol,
              )}${formatMarketValueForInfo(volume24h)}`}
            />
            <BaseInfo
              isFetching={marketCap === undefined}
              title={intl.formatMessage({ id: 'form__market_cap' })}
              value={`${getFiatCodeUnit(
                selectedFiatMoneySymbol,
              )}${formatMarketValueForInfo(marketCap)}`}
            />
            <BaseInfo
              isFetching={marketCapRank === undefined}
              title={intl.formatMessage({ id: 'form__market_cap_rank' })}
              value={`#${marketCapRank ?? 0}`}
            />
            <BaseInfo
              isFetching={marketCapDominance === undefined}
              title={intl.formatMessage({ id: 'form__market_cap_dominance' })}
              value={`${marketCapDominance || 0}`}
            />
          </HStack>
        </Box>
        {expolorers?.length ? (
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
        {about?.length ? (
          <Box>
            <Typography.Heading mb="3">
              {intl.formatMessage({ id: 'title__about' })}
            </Typography.Heading>
            <Typography.Body2 noOfLines={5}>{about}</Typography.Body2>
          </Box>
        ) : null}
        {links ? <MarketInfoLinks links={links} /> : null}
        {news?.length ? (
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
