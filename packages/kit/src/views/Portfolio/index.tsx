import React from 'react';

import { Box } from '@onekeyhq/components';

import WebView from '../../components/WebView';

const Portfolio = () => (
  <Box flex="1" bg="background-hovered">
    <WebView showWalletActions src="https://portfolio.onekey.so/" />
  </Box>
);

export default Portfolio;
