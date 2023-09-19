/* eslint-disable  @typescript-eslint/no-unused-vars  */
import { useState } from 'react';

import { Box, Button, Center, TypeWriter } from '@onekeyhq/components';

import WebView from '../../../components/WebView';
import ProcessAutoTypingWebView from '../../Onboarding/screens/CreateWallet/BehindTheScene/ProcessAutoTypingWebView';

const TypeWriterGallery = () => (
  <Center minH="320px" minW="320px" flex="1" bg="#FF0033">
    <Box
      // w="90%"
      w="full"
      flex={1}
      bg="white"
    >
      {/* <WebView src="https://www.bing.com" /> */}
      {/* @ts-ignore */}
      <ProcessAutoTypingWebView />
    </Box>
  </Center>
);

export default TypeWriterGallery;
