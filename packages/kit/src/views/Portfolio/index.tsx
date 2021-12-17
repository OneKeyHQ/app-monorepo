import React from 'react';

import { Box, WebView } from '@onekeyhq/components';

const Portfolio = () => (
  <Box flex="1" bg="background-hovered">
    <WebView showWalletActions src="https://portfolio.onekey.so/" />
  </Box>
);

export default Portfolio;
