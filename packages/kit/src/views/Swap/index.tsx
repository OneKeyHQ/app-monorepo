import React from 'react';

import { Box } from '@onekeyhq/components';

import WebView from '../../components/WebView';

const Swap = () => (
  <Box flex="1" bg="background-hovered">
    <WebView showWalletActions src="https://swap.onekey.so/#/" />
  </Box>
);

export default Swap;
