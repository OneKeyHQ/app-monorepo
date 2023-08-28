import type { ComponentProps, FC, ReactElement } from 'react';

import { Box, Spinner } from '@onekeyhq/components';

import ChartView from '../ChartView';
import SvgNoPriceData from '../NoPriceData';

import type { MarketApiData } from '../chartService';

type ChartLayoutProps = {
  data: MarketApiData[] | null;
  header?: ReactElement;
  footer?: ReactElement;
  isFetching: boolean;
  onHover: ComponentProps<typeof ChartView>['onHover'];
  height: number;
  mt: number;
};

const ChartLayout: FC<ChartLayoutProps> = ({
  data,
  isFetching,
  header,
  footer,
  onHover,
  height,
  mt,
}) => {
  const chartView = data ? (
    <ChartView
      isFetching={isFetching}
      height={height}
      data={data}
      onHover={onHover}
    />
  ) : (
    <SvgNoPriceData width="100%" height="100%" preserveAspectRatio="none" />
  );
  const chartViewWithSpinner =
    data && data.length === 0 ? <Spinner /> : chartView;
  return (
    <>
      <Box>{header}</Box>
      <Box
        justifyContent="center"
        alignItems="center"
        h={`${height}px`}
        mt={`${mt}px`}
      >
        {chartViewWithSpinner}
      </Box>
      <Box>{footer}</Box>
    </>
  );
};
ChartLayout.displayName = 'ChartLayout';
export default ChartLayout;
