import { Box, Divider, Typography, VStack } from '@onekeyhq/components/src';
import { SCREEN_SIZE } from '@onekeyhq/components/src/Provider/device';
import { FC } from 'react';

import { MarketStats } from '../../../../store/reducers/market';
import { useGridBoxStyle } from '../../hooks/useMarketLayout';

type DataViewComponentProps = {
  title?: string;
  value?: string;
  subValue?: string;
  valueColor?: string;
  index?: number;
};
const DataViewComponent: FC<DataViewComponentProps> = ({
  title,
  value,
  subValue,
  valueColor,
  index,
}) => {
  const gridBoxStyle = useGridBoxStyle({
    index,
    outPadding: 32,
    maxW: SCREEN_SIZE.LARGE,
  });
  return (
    <Box {...gridBoxStyle}>
      <Box
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
        mb="3"
      >
        <Typography.Body2Strong color="text-subdued">
          {title}
        </Typography.Body2Strong>
        <Box alignItems="flex-end">
          <Typography.Body2Strong color={valueColor ?? 'text-default'}>
            {value}
          </Typography.Body2Strong>
          {subValue ? (
            <Typography.Caption color="text-subdued">
              {subValue}
            </Typography.Caption>
          ) : null}
        </Box>
      </Box>
      <Divider />
    </Box>
  );
};

export const MarketStatsContent: FC<MarketStats> = ({
  performance,
  marketCap,
  marketCapDominance,
  marketCapRank,
  trandingVolume,
  low24h,
  high24h,
  low7d,
  high7d,
  atl,
  ath,
}) => {
  console.log('MarketStatsContent');
  return (
    <Box flex={1}>
      <VStack space={3} mt="6">
        <Typography.Heading>Performance</Typography.Heading>
        <Box flexDirection="row" alignContent="flex-start" flexWrap="wrap">
          <DataViewComponent
            index={0}
            title="1h"
            value={`${performance?.priceChangePercentage1h ?? 0}%`}
            valueColor={
              performance?.priceChangePercentage1h &&
              performance?.priceChangePercentage1h >= 0
                ? 'text-success'
                : 'text-critical'
            }
          />
          <DataViewComponent
            index={1}
            title="24h"
            value={`${performance?.priceChangePercentage24h ?? 0}%`}
            valueColor={
              performance?.priceChangePercentage24h &&
              performance?.priceChangePercentage24h >= 0
                ? 'text-success'
                : 'text-critical'
            }
          />
          <DataViewComponent
            index={2}
            title="7d"
            value={`${performance?.priceChangePercentage7d ?? 0}%`}
            valueColor={
              performance?.priceChangePercentage7d &&
              performance?.priceChangePercentage7d >= 0
                ? 'text-success'
                : 'text-critical'
            }
          />
          <DataViewComponent
            index={3}
            title="14d"
            value={`${performance?.priceChangePercentage14d ?? 0}%`}
            valueColor={
              performance?.priceChangePercentage14d &&
              performance?.priceChangePercentage14d >= 0
                ? 'text-success'
                : 'text-critical'
            }
          />
          <DataViewComponent
            index={4}
            title="30d"
            value={`${performance?.priceChangePercentage30d ?? 0}%`}
            valueColor={
              performance?.priceChangePercentage30d &&
              performance?.priceChangePercentage30d >= 0
                ? 'text-success'
                : 'text-critical'
            }
          />
          <DataViewComponent
            index={5}
            title="1y"
            value={`${performance?.priceChangePercentage1y ?? 0}%`}
            valueColor={
              performance?.priceChangePercentage1y &&
              performance?.priceChangePercentage1y >= 0
                ? 'text-success'
                : 'text-critical'
            }
          />
        </Box>

        <Typography.Heading>Stats</Typography.Heading>
        <Box>
          <DataViewComponent title="Market Cap" value={`$${marketCap ?? 0}`} />
          <DataViewComponent
            title="Market Cap Dominanc"
            value={`${marketCapDominance ?? 0}`}
          />
          <DataViewComponent
            title="Market Cap Rank"
            value={`#${marketCapRank ?? 0}`}
          />
          <DataViewComponent
            title="Tranding Volume"
            value={`$${trandingVolume ?? 0}`}
          />
          <DataViewComponent title="7dLow" value={`${low7d ?? 0}`} />
          <DataViewComponent title="7dHigh" value={`${high7d ?? 0}`} />
          <DataViewComponent title="24hLow" value={`$${low24h ?? 0}`} />
          <DataViewComponent title="24hHigh" value={`$${high24h ?? 0}`} />
          <DataViewComponent
            title="All-Time Low"
            value={`$${atl?.value ?? 0}`}
            subValue={atl?.time}
          />
          <DataViewComponent
            title="All-Time High"
            value={`$${ath?.value ?? 0}`}
            subValue={ath?.time}
          />
        </Box>
      </VStack>
    </Box>
  );
};
