import React from 'react';

import { Box, useThemeValue } from '@onekeyhq/components';

import PriceChart from '../../PriceChart/PriceChart';

const PriceChartGallery = () => {
  const bg = useThemeValue('background-default');
  return (
    <Box w="full" h="full" bg={bg} p="10">
      <PriceChart />
    </Box>
  );
};

export default PriceChartGallery;
