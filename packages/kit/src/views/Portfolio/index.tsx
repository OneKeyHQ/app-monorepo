/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect, useState } from 'react';

import NetInfo, { NetInfoStateType } from '@react-native-community/netinfo';

import { Box, useLocale, useTheme } from '@onekeyhq/components';

import WebView from '../../components/WebView';
import OfflineView from '../Offline';

const Portfolio = () => {
  const { themeVariant } = useTheme();
  const { locale } = useLocale();
  // const url = `https://portfolio.test.onekey.so/?theme=${themeVariant}&locale=${locale}`;
  // const url = `https://swap.onekey.so/?utm_source=onekey#/swap`;
  const url = `https://metamask.github.io/test-dapp/`;
  // const url = `http://192.168.31.215:3000/`;
  // const url = `https://app.uniswap.org/#/swap?chain=mainnet`;
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setOffline(state.type === NetInfoStateType.none);
    });
    return unsubscribe;
  }, []);

  return (
    <Box flex="1" bg="background-default">
      <WebView src={url} openUrlInExt />
      <OfflineView offline={offline} />
    </Box>
  );
};

export default Portfolio;
