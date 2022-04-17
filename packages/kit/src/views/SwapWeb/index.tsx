import React, { useEffect, useState } from 'react';

import NetInfo, { NetInfoStateType } from '@react-native-community/netinfo';

import { Box, useLocale, useTheme } from '@onekeyhq/components';

import WebView from '../../components/WebView';
import OfflineView from '../Offline';

const Swap = () => {
  const { themeVariant } = useTheme();
  const { locale } = useLocale();
  const url = `https://swap.test.onekey.so/#/swap?theme=${themeVariant}&locale=${locale}`;
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

export default Swap;
