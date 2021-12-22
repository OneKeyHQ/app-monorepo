import React from 'react';

import { Box } from '@onekeyhq/components';

import WebView from '../../components/WebView';

const Discover = () => (
  <Box flex="1" bg="background-hovered">
    <WebView showWalletActions src="https://discover.onekey.so/" />
  </Box>
);

export default Discover;
