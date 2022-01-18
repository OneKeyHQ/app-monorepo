import React from 'react';

import { Box, useLocale, useTheme } from '@onekeyhq/components';

import WebView from '../../components/WebView';

const Portfolio = () => {
  const { themeVariant } = useTheme();
  const { locale } = useLocale();
  const url = `https://portfolio.test.onekey.so/?theme=${themeVariant}&locale=${locale}`;
  return (
    <Box flex="1" bg="background-default">
      <WebView src={url} openUrlInExt />
    </Box>
  );
};

export default Portfolio;
