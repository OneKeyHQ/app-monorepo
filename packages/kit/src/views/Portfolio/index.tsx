import React from 'react';

import { Box } from '@onekeyhq/components';
import DemoInpageProvider from '@onekeyhq/inpage-provider/src/demo/DemoInpageProvider';

const Portfolio = () => (
  <Box flex="1" bg="background-hovered">
    <DemoInpageProvider src="https://portfolio.onekey.so/" />
  </Box>
);

export default Portfolio;
