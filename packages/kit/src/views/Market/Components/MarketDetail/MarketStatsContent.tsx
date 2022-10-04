import { Box, Divider, Typography } from '@onekeyhq/components/src';
import { FC } from 'react';
import { MarketStats } from '../../../../store/reducers/market';

type DataViewComponentProps = {
  title?: string;
  value?: string;
  subValue?: string;
  maxW?: string;
};
const DataViewComponent: FC<DataViewComponentProps> = ({
  title,
  value,
  subValue,
  maxW,
}) => {
  console.log('Performance');
  return (
    <Box maxW={maxW ?? 'full'}>
      <Box
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
      >
        <Typography.Body2Strong>{title}</Typography.Body2Strong>
        <Box>
          <Typography.Body2Strong>{value}</Typography.Body2Strong>
          <Typography.Caption>{subValue}</Typography.Caption>
        </Box>
      </Box>
      <Divider />
    </Box>
  );
};

export const MarketStatsContent: FC<MarketStats> = ({
  performance,
  states,
}) => {
  console.log('MarketStatsContent');
  return (
    <Box flex={1}>
      <Box>
        <Typography.Heading>Performance</Typography.Heading>
        <Box flexDirection="row" alignContent="flex-start" flexWrap="wrap">
          <DataViewComponent title="1h" value="+0.5" />
          <DataViewComponent title="1h" value="+0.5" />
          <DataViewComponent title="1h" value="+0.5" />
          <DataViewComponent title="1h" value="+0.5" />
          <DataViewComponent title="1h" value="+0.5" />
          <DataViewComponent title="1h" value="+0.5" />
        </Box>
      </Box>
      <Typography.Heading>Stats</Typography.Heading>
      <Box>
        <DataViewComponent title="1h" value="+0.5" />
        <DataViewComponent title="1h" value="+0.5" />
        <DataViewComponent title="1h" value="+0.5" />
        <DataViewComponent title="1h" value="+0.5" />
        <DataViewComponent title="1h" value="+0.5" />
        <DataViewComponent title="1h" value="+0.5" />
        <DataViewComponent title="1h" value="+0.5" />
        <DataViewComponent title="1h" value="+0.5" />
        <DataViewComponent title="1h" value="+0.5" subValue="May 08,2019" />
        <DataViewComponent title="1h" value="+0.5" subValue="May 19,2021" />
      </Box>
    </Box>
  );
};
