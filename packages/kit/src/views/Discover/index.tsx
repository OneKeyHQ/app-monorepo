import React from 'react';

import { Box } from '@onekeyhq/components';
import DemoInpageProvider from '@onekeyhq/inpage-provider/src/demo/DemoInpageProvider';

const Discover = () => (
  <Box flex="1" bg="background-hovered">
    <DemoInpageProvider src="https://discover.onekey.so/" />
  </Box>
);

export default Discover;
