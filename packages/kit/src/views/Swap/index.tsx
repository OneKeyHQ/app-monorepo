import React from 'react';

import { Box } from '@onekeyhq/components';

import DemoInpageProvider from '../../../../inpage-provider/src/demo/DemoInpageProvider';

const Swap = () => (
  <Box flex="1" bg="background-hovered">
    <DemoInpageProvider src="https://swap.onekey.so/#/" />
  </Box>
);

export default Swap;
