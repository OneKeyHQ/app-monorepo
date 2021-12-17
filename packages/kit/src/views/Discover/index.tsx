import React from 'react';

import { Box, WebView } from '@onekeyhq/components';

const Discover = () => (
  <Box flex="1" bg="background-hovered">
    <WebView showWalletActions src="https://discover.onekey.so/" />
  </Box>
);

export default Discover;
