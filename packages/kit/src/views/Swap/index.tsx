import React from 'react';

import { Box, WebView } from '@onekeyhq/components';

const Swap = () => (
  <Box flex="1" bg="background-hovered">
    <WebView showWalletActions src="https://swap.onekey.so/#/" />
  </Box>
);

export default Swap;
